require("dotenv").config();
const http = require("http");
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { Server } = require("socket.io");
const db = require("./database");
const { sendOtpEmail } = require("./emailService");
const aiService = require("./aiService");

const app = express();
app.use(express.json({ limit: "15mb" }));
app.use(express.urlencoded({ limit: "15mb", extended: true }));

const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // Allow up to 100MB for image transfers
});

// VideoSDK Configuration
const VIDEOSDK_API_KEY = process.env.VIDEOSDK_API_KEY;
const VIDEOSDK_SECRET_KEY = process.env.VIDEOSDK_SECRET_KEY;

function generateVideoSDKToken(roomId = null, participantId = null) {
    if (!VIDEOSDK_API_KEY || !VIDEOSDK_SECRET_KEY) {
        throw new Error("VideoSDK API credentials are not configured in environment variables");
    }
    const options = {
        expiresIn: "24h",
        algorithm: "HS256"
    };
    const payload = {
        apikey: VIDEOSDK_API_KEY,
        permissions: ["allow_join"],
        version: 2
    };
    if (roomId) payload.roomId = roomId;
    if (participantId) payload.participantId = participantId;
    return jwt.sign(payload, VIDEOSDK_SECRET_KEY, options);
}

async function createVideoSDKRoom(token) {
    const url = "https://api.videosdk.live/v2/rooms";
    const response = await fetch(url, {
        method: "POST",
        headers: {
            Authorization: token,
            "Content-Type": "application/json"
        },
        body: JSON.stringify({})
    });
    if (!response.ok) {
        const errText = await response.text();
        throw new Error(`VideoSDK room creation failed (${response.status}): ${errText}`);
    }
    const data = await response.json();
    return data.roomId;
}

// Track connected users: socketId -> { username, color }
const users = new Map();

// Helper to generate a consistent avatar color
const AVATAR_COLORS = [
    "#6366f1", "#ec4899", "#8b5cf6", "#10b981", 
    "#f59e0b", "#3b82f6", "#14b8a6", "#f43f5e"
];

function getRandomColor() {
    return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

// Helper to format clean 12-hour time with AM/PM (e.g. "2:30 PM", "9:05 AM")
function format12HourTime(date = new Date()) {
    const d = typeof date === 'number' || typeof date === 'string' ? new Date(date) : date;
    let hours = d.getHours();
    const minutes = d.getMinutes();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12;
    hours = hours ? hours : 12;
    const minutesStr = minutes < 10 ? '0' + minutes : minutes;
    return `${hours}:${minutesStr} ${ampm}`;
}

// Broadcast full active users list
function broadcastUsersList() {
    const list = Array.from(users.entries()).map(([id, u]) => ({
        id: id,
        username: u.username,
        color: u.color,
        avatarUrl: u.avatarUrl || ''
    }));
    io.emit("users-list", list);
    io.emit("users-count", list.length);
}

// Helper to find connected socketId by username
function findSocketIdByUsername(username) {
    if (!username) return null;
    const clean = username.trim().toLowerCase();
    for (const [id, u] of users.entries()) {
        if (u.username && u.username.trim().toLowerCase() === clean) {
            return id;
        }
    }
    return null;
}

// Socket.io handlers
io.on("connection", (socket) => {
    // Send current online count immediately
    socket.emit("users-count", users.size);
    broadcastUsersList();

    // User joins with a chosen username or authenticated user
    socket.on("user-join", async (data) => {
        const rawName = typeof data === "string" ? data : (data?.username || "");
        const cleanName = rawName.trim() ? rawName.trim().slice(0, 20) : `User-${socket.id.slice(0, 4)}`;
        
        let color = typeof data === "object" && data.color ? data.color : null;
        let avatarUrl = typeof data === "object" && data.avatarUrl ? data.avatarUrl : null;
        if (!color || avatarUrl === null) {
            const dbUser = await db.getUserByUsername(cleanName);
            if (dbUser) {
                if (!color) color = dbUser.color;
                if (avatarUrl === null) avatarUrl = dbUser.avatarUrl || '';
            } else {
                if (!color) color = getRandomColor();
                if (avatarUrl === null) avatarUrl = '';
            }
        }

        const userObj = {
            username: cleanName,
            color: color,
            avatarUrl: avatarUrl || ''
        };
        users.set(socket.id, userObj);
        socket.join(`user:${cleanName.toLowerCase()}`);

        // Notify client with their own profile details
        socket.emit("join-success", {
            id: socket.id,
            username: cleanName,
            color: userObj.color,
            avatarUrl: userObj.avatarUrl
        });

        // Mark any unread/pending messages as delivered for this user
        try {
            await db.markDmAsDelivered(cleanName);
            socket.broadcast.emit("messages-status-update", {
                recipientUsername: cleanName,
                status: "delivered"
            });
        } catch (_) {}

        // Send persisted General Room history from SQLite / Turso
        const history = await db.getGeneralHistory(100);
        socket.emit("chat-history", { type: "general", messages: history });

        // Send user their blocked list from DB
        try {
            const blockedUsers = db.getBlockedUsersFor(cleanName);
            socket.emit("blocked-users-list", blockedUsers);
        } catch (_) {}

        // Send active statuses
        try {
            const activeStatuses = await db.getActiveStatuses();
            socket.emit("statuses-list", activeStatuses);
        } catch (_) {}

        // Broadcast active users list
        broadcastUsersList();

        // Broadcast join system message (General room)
        socket.broadcast.emit("user-status", {
            username: cleanName,
            status: "joined",
            time: format12HourTime(new Date())
        });
    });

    // Handle user profile updates in real-time
    socket.on("user-update-profile", (data) => {
        if (!data || !socket.id) return;
        const existing = users.get(socket.id);
        if (existing) {
            if (data.username) {
                existing.username = data.username;
                socket.join(`user:${data.username.toLowerCase()}`);
            }
            if (data.color) existing.color = data.color;
            if (data.avatarUrl !== undefined) existing.avatarUrl = data.avatarUrl;
            users.set(socket.id, existing);
            broadcastUsersList();
        }
    });

    // Request active users list on demand
    socket.on("get-users", () => {
        broadcastUsersList();
    });

    // Receive message from client (Text, Image, or Voice Note) - Instant 0ms broadcast + async DB save
    socket.on("user-message", (data) => {
        const messageText = typeof data === "string" ? data : (data?.text || "");
        const image = data?.image || null;
        const audio = data?.audio || null;
        const audioDuration = data?.audioDuration || null;
        const file = data?.file || null;
        const fileName = data?.fileName || null;
        const fileSize = data?.fileSize || null;
        const fileType = data?.fileType || null;
        const isViewOnce = Boolean(data?.isViewOnce);
        const recipientId = data?.recipientId || null;
        let recipientUsername = (data?.recipientUsername || "").trim() || null;

        const hasText = messageText && messageText.trim().length > 0;
        const hasImage = Boolean(image);
        const hasAudio = Boolean(audio);
        const hasFile = Boolean(file);

        if (!hasText && !hasImage && !hasAudio && !hasFile) return;

        const user = users.get(socket.id) || { username: "Guest", color: "#6366f1", avatarUrl: "" };
        const senderUsername = user.username || "Guest";

        let targetSocketId = recipientId;
        if (!targetSocketId && recipientUsername) {
            targetSocketId = findSocketIdByUsername(recipientUsername);
        } else if (targetSocketId && !recipientUsername) {
            const rUser = users.get(targetSocketId);
            if (rUser) recipientUsername = rUser.username;
        }

        const isPrivateDm = Boolean(recipientUsername || targetSocketId);

        // Check blocking rules for DM
        if (isPrivateDm && recipientUsername) {
            // Check if sender has blocked recipient
            if (db.isUserBlocked(senderUsername, recipientUsername)) {
                socket.emit("chat-error", {
                    message: `You have blocked ${recipientUsername}. Unblock to send messages.`
                });
                return;
            }

            // Check if recipient has blocked sender (WhatsApp behavior: single tick 'sent', recipient NEVER sees it)
            if (db.isUserBlocked(recipientUsername, senderUsername)) {
                const now = Date.now();
                const blockedPayload = {
                    id: `${socket.id}-${now}`,
                    senderId: socket.id,
                    recipientId: targetSocketId,
                    recipientUsername: recipientUsername,
                    username: senderUsername,
                    avatarColor: user.color,
                    avatarUrl: user.avatarUrl || '',
                    status: 'sent',
                    isBlockedSend: 1, // Excluded from recipient's DM history and recent chats!
                    text: hasText ? messageText.trim() : "",
                    image: hasImage ? image : null,
                    audio: hasAudio ? audio : null,
                    audioDuration: hasAudio ? audioDuration : null,
                    file: hasFile ? file : null,
                    fileName: hasFile ? fileName : null,
                    fileSize: hasFile ? fileSize : null,
                    fileType: hasFile ? fileType : null,
                    replyTo: data?.replyTo || null,
                    isViewOnce: isViewOnce,
                    openedBy: [],
                    time: format12HourTime(now),
                    createdAt: now
                };

                // Asynchronously save in background with isBlockedSend: 1 (only sender will ever see it)
                db.saveMessage(blockedPayload).catch((err) => console.error("Error saving blocked message:", err));

                // Send back ONLY to sender
                socket.emit("message", blockedPayload);
                return;
            }
        }

        const recipientRoom = recipientUsername ? io.sockets.adapter.rooms.get(`user:${recipientUsername.toLowerCase()}`) : null;
        const isRecipientOnline = Boolean((recipientRoom && recipientRoom.size > 0) || (targetSocketId && targetSocketId !== socket.id && users.has(targetSocketId)));
        const initialStatus = isPrivateDm ? (isRecipientOnline ? 'delivered' : 'sent') : 'sent';

        const now = Date.now();
        const messagePayload = {
            id: `${socket.id}-${now}`,
            senderId: socket.id,
            recipientId: targetSocketId,
            recipientUsername: recipientUsername,
            username: senderUsername,
            avatarColor: user.color,
            avatarUrl: user.avatarUrl || '',
            status: initialStatus,
            isBlockedSend: 0,
            text: hasText ? messageText.trim() : "",
            image: hasImage ? image : null,
            audio: hasAudio ? audio : null,
            audioDuration: hasAudio ? audioDuration : null,
            file: hasFile ? file : null,
            fileName: hasFile ? fileName : null,
            fileSize: hasFile ? fileSize : null,
            fileType: hasFile ? fileType : null,
            replyTo: data?.replyTo || null,
            isViewOnce: isViewOnce,
            openedBy: [],
            time: format12HourTime(now),
            createdAt: now
        };

        // IMMEDIATE EMIT (0ms latency - instant real-time message delivery!)
        if (isPrivateDm) {
            // Echo back to sender
            socket.emit("message", messagePayload);

            // Broadcast to recipient user room (delivers to ALL recipient tabs/devices immediately!)
            if (recipientUsername) {
                io.to(`user:${recipientUsername.toLowerCase()}`).emit("message", messagePayload);
            }
            // Fallback to socket ID if connected
            if (targetSocketId && targetSocketId !== socket.id && users.has(targetSocketId)) {
                socket.to(targetSocketId).emit("message", messagePayload);
            }
        } else {
            // General Room: Broadcast to everyone
            io.emit("message", messagePayload);
        }

        // Persist message to SQLite / Turso asynchronously in the background
        db.saveMessage(messagePayload).catch((err) => {
            console.error("Async DB saveMessage error:", err);
        });
    });

    // Live Vibe / Status Handlers
    socket.on("get-statuses", async () => {
        try {
            const activeStatuses = await db.getActiveStatuses();
            socket.emit("statuses-list", activeStatuses);
        } catch (err) {
            console.error("Error sending active statuses:", err);
        }
    });

    socket.on("post-status", async (statusData) => {
        try {
            const user = users.get(socket.id) || { username: "Guest", color: "#6366f1", avatarUrl: "" };
            const statusPayload = {
                id: `status_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
                userId: user.id || null,
                username: user.username || statusData?.username || "User",
                avatarColor: user.color || '#10b981',
                avatarUrl: user.avatarUrl || '',
                type: statusData?.type || 'text',
                text: statusData?.text || '',
                bgGradient: statusData?.bgGradient || 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                audio: statusData?.audio || null,
                audioDuration: statusData?.audioDuration || null,
                image: statusData?.image || null,
                createdAt: Date.now(),
                expiresAt: Date.now() + 24 * 60 * 60 * 1000
            };

            await db.saveStatus(statusPayload);
            io.emit("status-new", statusPayload);
        } catch (err) {
            console.error("Error posting status:", err);
        }
    });

    socket.on("delete-status", async ({ statusId }) => {
        try {
            const user = users.get(socket.id);
            if (!user || !statusId) return;
            await db.deleteStatus(statusId, user.username);
            io.emit("status-deleted", { statusId });
        } catch (err) {
            console.error("Error deleting status:", err);
        }
    });

    // Clear DM History in Database & notify both clients
    socket.on("clear-dm-history", async ({ partnerUsername }) => {
        const user = users.get(socket.id);
        if (!user || !partnerUsername) return;
        await db.clearDmHistory(user.username, partnerUsername);
        socket.emit("dm-cleared", { partnerUsername });
        io.to(`user:${partnerUsername.toLowerCase()}`).emit("dm-cleared", { partnerUsername: user.username });
    });

    // Delete DM Chat in Database
    socket.on("delete-dm-chat", async ({ partnerUsername }) => {
        const user = users.get(socket.id);
        if (!user || !partnerUsername) return;
        await db.clearDmHistory(user.username, partnerUsername);
        socket.emit("dm-deleted", { partnerUsername });
    });

    // Block User in Database
    socket.on("block-user", async (data) => {
        const targetUsername = typeof data === "string" ? data : data?.targetUsername;
        const user = users.get(socket.id);
        const blockerUsername = user?.username || data?.blockerUsername;
        if (!blockerUsername || !targetUsername) return;
        await db.blockUser(blockerUsername, targetUsername);
        const blockedList = db.getBlockedUsersFor(blockerUsername);
        io.to(`user:${blockerUsername.toLowerCase()}`).emit("blocked-users-list", blockedList);
    });

    // Unblock User in Database
    socket.on("unblock-user", async (data) => {
        const targetUsername = typeof data === "string" ? data : data?.targetUsername;
        const user = users.get(socket.id);
        const blockerUsername = user?.username || data?.blockerUsername;
        if (!blockerUsername || !targetUsername) return;
        await db.unblockUser(blockerUsername, targetUsername);
        const blockedList = db.getBlockedUsersFor(blockerUsername);
        io.to(`user:${blockerUsername.toLowerCase()}`).emit("blocked-users-list", blockedList);
    });

    // Get Blocked Users
    socket.on("get-blocked-users", () => {
        const user = users.get(socket.id);
        if (!user) return;
        const blockedList = db.getBlockedUsersFor(user.username);
        socket.emit("blocked-users-list", blockedList);
    });

    // Mark DM messages as read by recipient
    socket.on("mark-messages-read", async ({ partnerUsername }) => {
        const user = users.get(socket.id);
        if (!user || !partnerUsername) return;
        try {
            await db.markDmAsRead(user.username, partnerUsername);
            io.to(`user:${partnerUsername.toLowerCase()}`).emit("messages-status-update", {
                partnerUsername: user.username,
                status: "read"
            });
        } catch (e) {
            console.error("Error in mark-messages-read:", e);
        }
    });

    // Retrieve DM history on demand
    socket.on("get-dm-history", async ({ partnerUsername }) => {
        const user = users.get(socket.id);
        if (!user || !partnerUsername) return;

        // Auto mark messages from this partner as read upon opening chat
        try {
            await db.markDmAsRead(user.username, partnerUsername);
            const partnerSocketId = findSocketIdByUsername(partnerUsername);
            if (partnerSocketId) {
                io.to(partnerSocketId).emit("messages-status-update", {
                    partnerUsername: user.username,
                    status: "read"
                });
            }
        } catch (e) {}

        const dmHistory = await db.getDmHistory(user.username, partnerUsername, 100);
        socket.emit("chat-history", { type: "dm", partnerUsername, messages: dmHistory });
    });

    // Delete Message (For Everyone)
    socket.on("message-delete", async ({ messageId, recipientId }) => {
        if (!messageId) return;

        // Delete in SQLite / Turso
        await db.deleteMessage(messageId);

        const payload = { messageId, deletedBy: socket.id };
        if (recipientId && users.has(recipientId)) {
            if (recipientId === socket.id) {
                socket.emit("message-deleted", payload);
            } else {
                socket.to(recipientId).emit("message-deleted", payload);
                socket.emit("message-deleted", payload);
            }
        } else {
            io.emit("message-deleted", payload);
        }
    });

    // Edit Message
    socket.on("message-edit", async ({ messageId, newText, recipientId }) => {
        if (!messageId || !newText || !newText.trim()) return;

        // Update in SQLite / Turso
        await db.editMessage(messageId, newText.trim());

        const payload = { messageId, newText: newText.trim(), editedBy: socket.id };
        if (recipientId && users.has(recipientId)) {
            if (recipientId === socket.id) {
                socket.emit("message-edited", payload);
            } else {
                socket.to(recipientId).emit("message-edited", payload);
                socket.emit("message-edited", payload);
            }
        } else {
            io.emit("message-edited", payload);
        }
    });

    // View Once Image Opened
    socket.on("view-once-opened", ({ messageId }) => {
        if (!messageId) return;
        io.emit("view-once-status-update", {
            messageId,
            openerId: socket.id
        });
    });

    // Message Reactions
    socket.on("message-reaction", ({ messageId, emoji }) => {
        if (!messageId || !emoji) return;
        io.emit("message-reaction-update", {
            messageId,
            emoji,
            userId: socket.id
        });
    });

    // Typing indicators (General or DM)
    socket.on("typing", (data) => {
        const user = users.get(socket.id);
        const name = user ? user.username : "Someone";
        const recipientId = data?.recipientId || null;

        if (recipientId) {
            socket.to(recipientId).emit("user-typing", { id: socket.id, username: name, recipientId });
        } else {
            socket.broadcast.emit("user-typing", { id: socket.id, username: name });
        }
    });

    socket.on("stop-typing", (data) => {
        const recipientId = data?.recipientId || null;
        if (recipientId) {
            socket.to(recipientId).emit("user-stop-typing", { id: socket.id, recipientId });
        } else {
            socket.broadcast.emit("user-stop-typing", { id: socket.id });
        }
    });

    // --- VideoSDK & WebRTC 1-on-1 Audio / Video Calling Signaling ---
    socket.on("call-offer", ({ to, toUsername, roomId, offer, isVideo }) => {
        const caller = users.get(socket.id);
        let targetSocketId = null;
        if (toUsername) {
            targetSocketId = findSocketIdByUsername(toUsername);
        }
        if (!targetSocketId && to && users.has(to)) {
            targetSocketId = to;
        }
        if (!targetSocketId || !users.has(targetSocketId)) {
            socket.emit("call-failed", { reason: `${toUsername || "User"} is currently offline or unavailable` });
            return;
        }
        socket.to(targetSocketId).emit("incoming-call", {
            from: socket.id,
            fromName: caller ? caller.username : "Caller",
            fromColor: caller ? caller.color : "#00a884",
            roomId: roomId || null,
            offer: offer || null,
            isVideo: Boolean(isVideo)
        });
    });

    socket.on("call-answer", ({ to, toUsername, roomId, answer }) => {
        let targetSocketId = null;
        if (toUsername) {
            targetSocketId = findSocketIdByUsername(toUsername);
        }
        if (!targetSocketId && to && users.has(to)) {
            targetSocketId = to;
        }
        if (targetSocketId) {
            socket.to(targetSocketId).emit("call-answered", {
                from: socket.id,
                roomId: roomId || null,
                answer: answer || null
            });
        }
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
        if (to && candidate && users.has(to)) {
            socket.to(to).emit("ice-candidate", {
                from: socket.id,
                candidate
            });
        }
    });

    socket.on("call-reject", ({ to, roomId, reason }) => {
        if (to && users.has(to)) {
            socket.to(to).emit("call-rejected", { from: socket.id, roomId, reason: reason || "declined" });
        }
        if (roomId) {
            db.updateCallStatus(roomId, "rejected", 0).catch(() => {});
        }
    });

    socket.on("call-end", ({ to, roomId, durationSeconds = 0 }) => {
        if (to && users.has(to)) {
            socket.to(to).emit("call-ended", { from: socket.id, roomId });
        }
        if (roomId) {
            db.updateCallStatus(roomId, "completed", durationSeconds).catch(() => {});
        }
    });

    // Disconnect event
    socket.on("disconnect", () => {
        if (users.has(socket.id)) {
            const user = users.get(socket.id);
            users.delete(socket.id);

            broadcastUsersList();
            io.emit("user-status", {
                username: user.username,
                status: "left",
                time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
            });
            socket.broadcast.emit("user-stop-typing", { id: socket.id });
        }
    });
});

// --- Password Hashing & Token Verification ---
function hashPassword(password) {
    const salt = crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(password, salt, 64).toString("hex");
    return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
    if (!stored || !stored.includes(":")) return false;
    const [salt, hash] = stored.split(":");
    const check = crypto.scryptSync(password, salt, 64).toString("hex");
    return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(check, "hex"));
}

const JWT_SECRET = process.env.JWT_SECRET || "chathub-secret-token-key-2026";

function hashOtp(otp) {
    return crypto.createHmac("sha256", JWT_SECRET).update(String(otp).trim()).digest("hex");
}

function createToken(user) {
    const payload = JSON.stringify({
        id: user.id,
        username: user.username,
        email: user.email || null,
        exp: Date.now() + 30 * 24 * 3600 * 1000
    });
    const b64 = Buffer.from(payload).toString("base64url");
    const sig = crypto.createHmac("sha256", JWT_SECRET).update(b64).digest("base64url");
    return `${b64}.${sig}`;
}

function verifyToken(token) {
    if (!token || !token.includes(".")) return null;
    const [b64, sig] = token.split(".");
    const checkSig = crypto.createHmac("sha256", JWT_SECRET).update(b64).digest("base64url");
    if (sig !== checkSig) return null;
    try {
        const data = JSON.parse(Buffer.from(b64, "base64url").toString("utf-8"));
        if (data.exp < Date.now()) return null;
        return data;
    } catch (e) {
        return null;
    }
}

function createResetToken(email) {
    const payload = JSON.stringify({
        email: email.toLowerCase().trim(),
        purpose: "password_reset",
        exp: Date.now() + 15 * 60 * 1000 // 15 min expiry
    });
    const b64 = Buffer.from(payload).toString("base64url");
    const sig = crypto.createHmac("sha256", JWT_SECRET).update(b64).digest("base64url");
    return `${b64}.${sig}`;
}

function verifyResetToken(token) {
    if (!token || !token.includes(".")) return null;
    const [b64, sig] = token.split(".");
    const checkSig = crypto.createHmac("sha256", JWT_SECRET).update(b64).digest("base64url");
    if (sig !== checkSig) return null;
    try {
        const data = JSON.parse(Buffer.from(b64, "base64url").toString("utf-8"));
        if (data.exp < Date.now() || data.purpose !== "password_reset") return null;
        return data;
    } catch (e) {
        return null;
    }
}

// --- REST API Authentication Endpoints ---

// 0. Public Auth Configuration (Google Client ID)
app.get("/api/auth/config", (req, res) => {
    res.json({
        googleClientId: (process.env.GOOGLE_CLIENT_ID || "").trim()
    });
});

// 1. Send Registration OTP
app.get("/api/debug/smtp", async (req, res) => {
    const nodemailer = require("nodemailer");
    const results = { timestamp: new Date().toISOString() };
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASSWORD;

    results.env = {
        hasUser: Boolean(process.env.EMAIL_USER),
        hasPass: Boolean(process.env.EMAIL_PASSWORD),
        host: process.env.EMAIL_HOST || "smtp.gmail.com",
        port: process.env.EMAIL_PORT || 465
    };

    // Test Port 465 (Direct SSL)
    try {
        const t465 = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 465,
            secure: true,
            auth: { user, pass },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 8000
        });
        await t465.verify();
        results.port465 = "VERIFIED_OK";
    } catch (err465) {
        results.port465 = { error: err465.message, code: err465.code };
    }

    // Test Port 587 (STARTTLS)
    try {
        const t587 = nodemailer.createTransport({
            host: "smtp.gmail.com",
            port: 587,
            secure: false,
            auth: { user, pass },
            connectionTimeout: 8000,
            greetingTimeout: 8000,
            socketTimeout: 8000
        });
        await t587.verify();
        results.port587 = "VERIFIED_OK";
    } catch (err587) {
        results.port587 = { error: err587.message, code: err587.code };
    }

    return res.json(results);
});

app.post("/api/auth/send-signup-otp", async (req, res) => {
    try {
        const { fullName, email, username, password } = req.body;

        if (!fullName || typeof fullName !== "string" || fullName.trim().length < 2) {
            return res.status(400).json({ error: "Please enter your full name." });
        }
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }
        if (!username || typeof username !== "string" || username.trim().length < 3) {
            return res.status(400).json({ error: "Username must be at least 3 characters." });
        }
        if (!password || typeof password !== "string" || password.length < 6) {
            return res.status(400).json({ error: "Password must be at least 6 characters." });
        }

        const cleanEmail = email.trim().toLowerCase();
        const cleanUsername = username.trim().slice(0, 25);

        // Check for existing users
        const existingUsername = await db.getUserByUsername(cleanUsername);
        if (existingUsername) {
            return res.status(409).json({ error: "This username is already taken. Please choose another." });
        }
        const existingEmail = await db.getUserByEmail(cleanEmail);
        if (existingEmail) {
            return res.status(409).json({ error: "An account with this email already exists. Please log in." });
        }

        // Generate cryptographically secure random 6-digit OTP
        const otpCode = crypto.randomInt(100000, 999999).toString();
        const otpHash = hashOtp(otpCode);
        const pwdHash = hashPassword(password);
        const avatarColor = getRandomColor();

        // Store OTP with registration payload (User is only created upon OTP verification)
        await db.saveOtp({
            email: cleanEmail,
            otpHash,
            purpose: "signup",
            payload: {
                fullName: fullName.trim(),
                username: cleanUsername,
                passwordHash: pwdHash,
                avatarColor
            },
            expiresInMinutes: 5
        });

        // Send OTP email with timeout and resilience
        let emailRes = { success: false };
        try {
            emailRes = await sendOtpEmail({
                toEmail: cleanEmail,
                otpCode,
                purpose: "signup"
            });
        } catch (emailErr) {
            console.error("sendOtpEmail error:", emailErr.message);
        }

        if (!emailRes.success) {
            return res.status(502).json({
                error: emailRes.error || "Could not deliver verification email to your inbox. Please verify your email configuration."
            });
        }

        return res.json({
            success: true,
            message: "A 6-digit verification code has been sent to your email.",
            email: cleanEmail
        });
    } catch (err) {
        console.error("send-signup-otp error:", err);
        return res.status(500).json({ error: "Failed to generate verification code. Please try again." });
    }
});

// 2. Verify Registration OTP and Create User
app.post("/api/auth/verify-signup-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: "Email and 6-digit verification code are required." });
        }

        const cleanEmail = email.trim().toLowerCase();
        const otpRecord = await db.getLatestOtp(cleanEmail, "signup");

        if (!otpRecord) {
            return res.status(400).json({ error: "Verification code has expired or is invalid. Please request a new code." });
        }

        if (otpRecord.attempts >= 5) {
            await db.deleteOtp(otpRecord.id);
            return res.status(429).json({ error: "Too many failed attempts. Please request a new code." });
        }

        const submittedHash = hashOtp(otp);
        if (submittedHash !== otpRecord.otpHash) {
            await db.incrementOtpAttempts(otpRecord.id);
            return res.status(400).json({ error: "Incorrect verification code. Please check and try again." });
        }

        // OTP verified successfully -> Activate/Create User
        const payload = otpRecord.payload;
        if (!payload) {
            return res.status(400).json({ error: "Invalid registration state. Please register again." });
        }

        // Delete used OTP
        await db.deleteOtp(otpRecord.id);

        // Check once more for race condition on username or email
        const clash = await db.getUserByUsername(payload.username);
        if (clash) {
            return res.status(409).json({ error: "Username already taken." });
        }

        const user = await db.createUser({
            fullName: payload.fullName,
            email: cleanEmail,
            username: payload.username,
            passwordHash: payload.passwordHash,
            avatarColor: payload.avatarColor,
            isVerified: 1
        });

        const token = createToken(user);

        return res.status(201).json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName,
                email: user.email,
                color: user.color
            },
            token
        });
    } catch (err) {
        console.error("verify-signup-otp error:", err);
        return res.status(500).json({ error: "Verification failed. Please try again." });
    }
});

// 3. Resend OTP (for signup or forgot_password)
app.post("/api/auth/resend-otp", async (req, res) => {
    try {
        const { email, purpose = "signup" } = req.body;
        if (!email) {
            return res.status(400).json({ error: "Email is required." });
        }

        const cleanEmail = email.trim().toLowerCase();
        const existingRecord = await db.getLatestOtp(cleanEmail, purpose);

        // Rate limit: Enforce at least 30 seconds cooldown between resends
        if (existingRecord && (Date.now() - existingRecord.createdAt) < 30 * 1000) {
            const waitSeconds = Math.ceil((30 * 1000 - (Date.now() - existingRecord.createdAt)) / 1000);
            return res.status(429).json({ error: `Please wait ${waitSeconds} seconds before requesting a new code.` });
        }

        const newOtpCode = crypto.randomInt(100000, 999999).toString();
        const newOtpHash = hashOtp(newOtpCode);

        // Preserve previous payload if signup
        const payload = existingRecord ? existingRecord.payload : null;

        await db.saveOtp({
            email: cleanEmail,
            otpHash: newOtpHash,
            purpose,
            payload,
            expiresInMinutes: 5
        });

        let emailRes = { success: false };
        try {
            emailRes = await sendOtpEmail({
                toEmail: cleanEmail,
                otpCode: newOtpCode,
                purpose
            });
        } catch (emailErr) {
            console.error("resend-otp email error:", emailErr.message);
        }

        if (!emailRes.success) {
            return res.status(502).json({
                error: emailRes.error || "Failed to resend code to your email. Please try again later."
            });
        }

        return res.json({
            success: true,
            message: "A new verification code has been sent to your email."
        });
    } catch (err) {
        console.error("resend-otp error:", err);
        return res.status(500).json({ error: "Failed to resend code. Please try again." });
    }
});

// 4. Login (Supports Username OR Email)
app.post("/api/auth/login", async (req, res) => {
    try {
        const { identifier, username, password } = req.body;
        const loginId = (identifier || username || "").trim();

        if (!loginId || !password) {
            return res.status(400).json({ error: "Username/Email and password are required." });
        }

        const user = await db.getUserByIdentifier(loginId);
        if (!user || !user.passwordHash || !verifyPassword(password, user.passwordHash)) {
            return res.status(401).json({ error: "Invalid username/email or password." });
        }

        const token = createToken(user);
        return res.json({
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName || user.username,
                email: user.email,
                dob: user.dob || '',
                bio: user.bio || '',
                color: user.color,
                avatarUrl: user.avatarUrl || '',
                createdAt: user.createdAt
            },
            token
        });
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ error: "Login failed. Please try again." });
    }
});

// 5. Forgot Password - Request Recovery OTP
app.post("/api/auth/forgot-password", async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
            return res.status(400).json({ error: "Please enter a valid email address." });
        }

        const cleanEmail = email.trim().toLowerCase();
        const user = await db.getUserByEmail(cleanEmail);

        // For security, generic response is returned even if account doesn't exist
        if (user) {
            const otpCode = crypto.randomInt(100000, 999999).toString();
            const otpHash = hashOtp(otpCode);

            await db.saveOtp({
                email: cleanEmail,
                otpHash,
                purpose: "forgot_password",
                payload: { userId: user.id },
                expiresInMinutes: 5
            });

            try {
                await sendOtpEmail({
                    toEmail: cleanEmail,
                    otpCode,
                    purpose: "forgot_password"
                });
            } catch (emailErr) {
                console.error("forgot-password email error:", emailErr.message);
            }
        }

        return res.json({
            success: true,
            message: "If an account with that email exists, a password reset code has been sent."
        });
    } catch (err) {
        console.error("forgot-password error:", err);
        return res.status(500).json({ error: "Could not process password recovery. Please try again." });
    }
});

// 6. Verify Forgot Password OTP
app.post("/api/auth/verify-reset-otp", async (req, res) => {
    try {
        const { email, otp } = req.body;
        if (!email || !otp) {
            return res.status(400).json({ error: "Email and verification code are required." });
        }

        const cleanEmail = email.trim().toLowerCase();
        const otpRecord = await db.getLatestOtp(cleanEmail, "forgot_password");

        if (!otpRecord) {
            return res.status(400).json({ error: "Reset code has expired or is invalid. Please request a new code." });
        }

        if (otpRecord.attempts >= 5) {
            await db.deleteOtp(otpRecord.id);
            return res.status(429).json({ error: "Too many failed attempts. Please request a new reset code." });
        }

        const submittedHash = hashOtp(otp);
        if (submittedHash !== otpRecord.otpHash) {
            await db.incrementOtpAttempts(otpRecord.id);
            return res.status(400).json({ error: "Incorrect verification code." });
        }

        // Delete used OTP
        await db.deleteOtp(otpRecord.id);

        // Issue short-lived, single-use password-reset authorization token
        const resetToken = createResetToken(cleanEmail);

        return res.json({
            success: true,
            resetToken
        });
    } catch (err) {
        console.error("verify-reset-otp error:", err);
        return res.status(500).json({ error: "Failed to verify reset code." });
    }
});

// 7. Reset Password with Reset Token
app.post("/api/auth/reset-password", async (req, res) => {
    try {
        const { email, resetToken, newPassword } = req.body;
        if (!email || !resetToken || !newPassword) {
            return res.status(400).json({ error: "Email, reset token and new password are required." });
        }

        if (typeof newPassword !== "string" || newPassword.length < 6) {
            return res.status(400).json({ error: "New password must be at least 6 characters." });
        }

        const cleanEmail = email.trim().toLowerCase();
        const decoded = verifyResetToken(resetToken);

        if (!decoded || decoded.email !== cleanEmail) {
            return res.status(401).json({ error: "Password reset authorization has expired. Please restart the recovery process." });
        }

        const user = await db.getUserByEmail(cleanEmail);
        if (!user) {
            return res.status(404).json({ error: "Account not found." });
        }

        const newHash = hashPassword(newPassword);
        await db.updateUserPassword(user.id, newHash);

        return res.json({
            success: true,
            message: "Your password has been reset successfully. Please log in with your new password."
        });
    } catch (err) {
        console.error("reset-password error:", err);
        return res.status(500).json({ error: "Failed to reset password. Please try again." });
    }
});

// 8. Google Authentication (Google Identity Services)
app.post("/api/auth/google", async (req, res) => {
    try {
        const { credential } = req.body;
        if (!credential) {
            return res.status(400).json({ error: "Google credential token is required." });
        }

        // Verify token with Google's tokeninfo API
        const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(credential)}`);
        if (!googleRes.ok) {
            return res.status(401).json({ error: "Invalid Google authentication token." });
        }

        const payload = await googleRes.json();
        const googleId = payload.sub;
        const email = payload.email?.toLowerCase();
        const fullName = payload.name || "Google User";
        const emailVerified = payload.email_verified === "true" || payload.email_verified === true;

        if (!googleId || !email || !emailVerified) {
            return res.status(400).json({ error: "Unverified Google account or missing email." });
        }

        // 1. Check if user already exists by googleId
        let user = await db.getUserByGoogleId(googleId);

        // 2. If not, check if user exists by verified email
        if (!user) {
            user = await db.getUserByEmail(email);
            if (user) {
                // Safely link Google ID to existing verified account
                await db.linkGoogleAccount(user.id, googleId);
            }
        }

        // 3. First time user: Create user record
        if (!user) {
            // Generate unique username from email prefix
            let baseUsername = email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "").slice(0, 15);
            if (baseUsername.length < 3) baseUsername = "user";
            let chosenUsername = baseUsername;
            let count = 1;
            while (await db.getUserByUsername(chosenUsername)) {
                chosenUsername = `${baseUsername}${count++}`;
            }

            user = await db.createUser({
                fullName,
                email,
                username: chosenUsername,
                passwordHash: "",
                avatarColor: getRandomColor(),
                avatarUrl: payload.picture || "",
                googleId,
                isVerified: 1
            });
        }

        const token = createToken(user);
        return res.json({
            success: true,
            user: {
                id: user.id,
                username: user.username,
                fullName: user.fullName || user.username,
                email: user.email,
                dob: user.dob || '',
                bio: user.bio || '',
                color: user.color,
                avatarUrl: user.avatarUrl || payload.picture || '',
                createdAt: user.createdAt
            },
            token
        });
    } catch (err) {
        console.error("Google auth error:", err);
        return res.status(500).json({ error: "Google sign-in failed. Please try again." });
    }
});

// 9. Legacy register fallback
app.post("/api/auth/register", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || typeof username !== "string" || username.trim().length < 3) {
            return res.status(400).json({ error: "Username must be at least 3 characters." });
        }
        if (!password || typeof password !== "string" || password.length < 4) {
            return res.status(400).json({ error: "Password must be at least 4 characters." });
        }

        const cleanUsername = username.trim().slice(0, 20);
        const existing = await db.getUserByUsername(cleanUsername);
        if (existing) {
            return res.status(409).json({ error: "Username already exists. Please pick another one or log in." });
        }

        const pwdHash = hashPassword(password);
        const user = await db.createUser({
            fullName: cleanUsername,
            email: `${cleanUsername}@local.pulse`,
            username: cleanUsername,
            passwordHash: pwdHash,
            avatarColor: getRandomColor(),
            isVerified: 1
        });
        const token = createToken(user);

        return res.status(201).json({
            user: { id: user.id, username: user.username, color: user.color },
            token
        });
    } catch (err) {
        console.error("Legacy register error:", err);
        return res.status(500).json({ error: "Registration failed. Please try again." });
    }
});

// 10. Get current authenticated user
app.get("/api/auth/me", async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: "Invalid or expired session" });
    }

    const user = await db.getUserByUsername(decoded.username);
    if (!user) {
        return res.status(404).json({ error: "User not found" });
    }

    return res.json({
        user: {
            id: user.id,
            username: user.username,
            fullName: user.fullName || user.username,
            email: user.email,
            dob: user.dob || '',
            bio: user.bio || '',
            color: user.color,
            avatarUrl: user.avatarUrl || '',
            createdAt: user.createdAt
        }
    });
});

// 11. Update Profile (Name, Username, Date of Birth, Bio, Avatar Color)
app.post("/api/user/profile", async (req, res) => {
    try {
        const authHeader = req.headers.authorization;
        let tokenUsername = null;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const decoded = verifyToken(authHeader.split(" ")[1]);
            if (decoded) tokenUsername = decoded.username;
        }

        const { userId, currentUsername, fullName, username, dob, bio, color, avatarUrl } = req.body;
        const targetUsername = currentUsername || tokenUsername;
        if (!targetUsername) {
            return res.status(401).json({ error: "Unauthorized: Missing username." });
        }

        const result = await db.updateUserProfile({
            userId,
            currentUsername: targetUsername,
            fullName: fullName ? fullName.trim() : "",
            username: username ? username.trim() : targetUsername,
            dob: dob ? dob.trim() : "",
            bio: bio ? bio.trim() : "",
            avatarColor: color || null,
            avatarUrl: avatarUrl !== undefined ? avatarUrl : null
        });

        if (!result.success) {
            return res.status(400).json({ error: result.error });
        }

        const updatedUser = result.user;
        const newToken = createToken(updatedUser);

        return res.json({
            success: true,
            user: {
                id: updatedUser.id,
                username: updatedUser.username,
                fullName: updatedUser.fullName,
                email: updatedUser.email,
                dob: updatedUser.dob || '',
                bio: updatedUser.bio || '',
                color: updatedUser.color,
                avatarUrl: updatedUser.avatarUrl || '',
                createdAt: updatedUser.createdAt
            },
            token: newToken
        });
    } catch (err) {
        console.error("Update profile API error:", err);
        return res.status(500).json({ error: "Failed to update profile." });
    }
});

app.get("/api/users", async (req, res) => {
    try {
        const all = await db.getAllUsers();
        return res.json({ users: all });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch users" });
    }
});

app.get("/api/chats/recent", async (req, res) => {
    try {
        const username = req.query.username;
        if (!username) return res.json({ chats: [] });
        const chats = await db.getRecentChatsForUser(username);
        return res.json({ chats });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch recent chats" });
    }
});

// Authentication Middleware
function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Unauthorized: Missing authentication token" });
    }
    const token = authHeader.split(" ")[1];
    const decoded = verifyToken(token);
    if (!decoded) {
        return res.status(401).json({ error: "Invalid or expired session" });
    }
    req.user = decoded;
    next();
}

// --- VideoSDK Calling API Routes ---

// Get secure VideoSDK participant token
app.get("/api/calls/token", authenticateToken, (req, res) => {
    try {
        const roomId = req.query.roomId || null;
        const participantId = req.user.username;
        const token = generateVideoSDKToken(roomId, participantId);
        return res.json({ token, participantId });
    } catch (err) {
        console.error("VideoSDK token error:", err);
        return res.status(500).json({ error: err.message || "Failed to generate calling token" });
    }
});

// Create VideoSDK meeting room for a 1-on-1 call
app.post("/api/calls/create-room", authenticateToken, async (req, res) => {
    try {
        const { receiverUsername, callType = "video" } = req.body;
        if (!receiverUsername) {
            return res.status(400).json({ error: "receiverUsername is required" });
        }

        const callerUsername = req.user.username;
        const callerToken = generateVideoSDKToken(null, callerUsername);
        const roomId = await createVideoSDKRoom(callerToken);

        // Record in DB
        await db.logCall({
            roomId,
            callerUsername,
            receiverUsername,
            callType,
            status: "initiated"
        });

        return res.json({
            roomId,
            token: callerToken,
            callerUsername,
            receiverUsername,
            callType
        });
    } catch (err) {
        console.error("VideoSDK create room error:", err);
        return res.status(500).json({ error: err.message || "Failed to create calling room" });
    }
});

// Update call status (completed, rejected, missed, failed)
app.post("/api/calls/update-status", authenticateToken, async (req, res) => {
    try {
        const { roomId, status, durationSeconds = 0 } = req.body;
        if (!roomId || !status) {
            return res.status(400).json({ error: "roomId and status are required" });
        }
        await db.updateCallStatus(roomId, status, durationSeconds);
        return res.json({ success: true });
    } catch (err) {
        return res.status(500).json({ error: "Failed to update call status" });
    }
});

// Get call history
app.get("/api/calls/history", authenticateToken, async (req, res) => {
    try {
        const history = await db.getCallLogs(req.user.username);
        return res.json({ calls: history });
    } catch (err) {
        return res.status(500).json({ error: "Failed to fetch call history" });
    }
});

// --- ChatHub AI Assistant API Routes ---

const DAILY_AI_QUOTA = parseInt(process.env.AI_DAILY_QUOTA, 10) || 25;

// Helper to get daily period timestamp (midnight UTC)
function getDailyPeriodStart() {
    const now = new Date();
    return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

// Check and enforce user AI quota
async function checkAiQuota(userId) {
    const periodStart = getDailyPeriodStart();
    const usage = await db.getAiUsage(userId, periodStart);
    if (usage.requestCount >= DAILY_AI_QUOTA) {
        return {
            allowed: false,
            usage,
            limit: DAILY_AI_QUOTA
        };
    }
    return {
        allowed: true,
        usage,
        limit: DAILY_AI_QUOTA,
        periodStart
    };
}

// 1. Get Current User AI Usage & Quota
app.get("/api/ai/usage", authenticateToken, async (req, res) => {
    try {
        const userId = req.user.id || req.user.username;
        const periodStart = getDailyPeriodStart();
        const usage = await db.getAiUsage(userId, periodStart);
        const providerStatus = aiService.getProviderStatus();

        return res.json({
            periodStart,
            limit: DAILY_AI_QUOTA,
            requestCount: usage.requestCount,
            remaining: Math.max(0, DAILY_AI_QUOTA - usage.requestCount),
            inputTokens: usage.inputTokens,
            outputTokens: usage.outputTokens,
            provider: providerStatus
        });
    } catch (err) {
        console.error("AI usage fetch error:", err);
        return res.status(500).json({ error: "Failed to fetch AI usage statistics." });
    }
});

// 2. Summarize Selected Conversation
app.post("/api/ai/conversations/:conversationId/summary", authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { maxMessages = 50 } = req.body;
        const username = req.user.username;
        const userId = req.user.id || username;
        const providerOverride = req.headers["x-ai-provider"] || null;

        // Verify conversation access & fetch bounded messages
        const convResult = await db.getRecentConversationMessages(conversationId, username, maxMessages);
        if (!convResult.authorized) {
            return res.status(403).json({
                error: convResult.error || "Forbidden: You are not authorized to access this conversation.",
                code: "UNAUTHORIZED_CONVERSATION"
            });
        }

        // Check daily quota
        const quotaCheck = await checkAiQuota(userId);
        if (!quotaCheck.allowed) {
            return res.status(429).json({
                error: "Daily AI request limit reached. Please try again tomorrow.",
                code: "QUOTA_EXCEEDED",
                limit: quotaCheck.limit,
                requestCount: quotaCheck.usage.requestCount
            });
        }

        const requestId = `req_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        const summary = await aiService.generateSummary({
            messages: convResult.messages,
            conversationType: convResult.conversationType,
            maxMessages,
            providerOverride
        });

        // Atomic usage accounting
        await db.incrementAiUsage({
            userId,
            periodStart: quotaCheck.periodStart,
            inputTokens: summary.inputTokens,
            outputTokens: summary.outputTokens,
            estimatedCost: 0
        });

        // Persist AI result
        await db.saveAiResult({
            userId,
            conversationId,
            type: "summary",
            status: "success",
            requestId,
            model: summary.model,
            inputMessageCount: summary.inputMessageCount,
            result: summary
        });

        return res.json({
            success: true,
            requestId,
            conversationId,
            conversationType: convResult.conversationType,
            partnerName: convResult.partnerName,
            summary,
            remainingQuota: Math.max(0, DAILY_AI_QUOTA - (quotaCheck.usage.requestCount + 1))
        });
    } catch (err) {
        console.error("AI summary error:", err);
        if (err.code === "PROVIDER_NOT_CONFIGURED") {
            return res.status(503).json({
                error: "ChatHub AI provider is not configured. Please set GEMINI_API_KEY in the environment.",
                code: "PROVIDER_NOT_CONFIGURED"
            });
        }
        if (err.code === "REQUEST_TIMEOUT") {
            return res.status(504).json({
                error: "AI summary generation timed out. Please try with fewer messages.",
                code: "REQUEST_TIMEOUT"
            });
        }
        if (err.code === "QUOTA_EXCEEDED") {
            return res.status(429).json({ error: err.message, code: "QUOTA_EXCEEDED" });
        }
        return res.status(500).json({ error: err.message || "Failed to generate conversation summary.", code: err.code || "AI_ERROR" });
    }
});

// 3. Ask Questions About Selected Conversation
app.post("/api/ai/conversations/:conversationId/ask", authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { question, maxMessages = 50 } = req.body;
        const username = req.user.username;
        const userId = req.user.id || username;
        const providerOverride = req.headers["x-ai-provider"] || null;

        if (!question || !question.trim()) {
            return res.status(400).json({ error: "Question cannot be empty.", code: "INVALID_INPUT" });
        }

        // Verify conversation access
        const convResult = await db.getRecentConversationMessages(conversationId, username, maxMessages);
        if (!convResult.authorized) {
            return res.status(403).json({
                error: convResult.error || "Forbidden: You are not authorized to access this conversation.",
                code: "UNAUTHORIZED_CONVERSATION"
            });
        }

        // Check quota
        const quotaCheck = await checkAiQuota(userId);
        if (!quotaCheck.allowed) {
            return res.status(429).json({
                error: "Daily AI request limit reached. Please try again tomorrow.",
                code: "QUOTA_EXCEEDED",
                limit: quotaCheck.limit,
                requestCount: quotaCheck.usage.requestCount
            });
        }

        const requestId = `req_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        const answerResult = await aiService.askConversation({
            messages: convResult.messages,
            question: question.trim(),
            conversationType: convResult.conversationType,
            maxMessages,
            providerOverride
        });

        await db.incrementAiUsage({
            userId,
            periodStart: quotaCheck.periodStart,
            inputTokens: answerResult.inputTokens,
            outputTokens: answerResult.outputTokens,
            estimatedCost: 0
        });

        await db.saveAiResult({
            userId,
            conversationId,
            type: "ask",
            status: "success",
            requestId,
            model: answerResult.model,
            inputMessageCount: answerResult.inputMessageCount,
            result: { question: question.trim(), ...answerResult }
        });

        return res.json({
            success: true,
            requestId,
            conversationId,
            conversationType: convResult.conversationType,
            partnerName: convResult.partnerName,
            result: answerResult,
            remainingQuota: Math.max(0, DAILY_AI_QUOTA - (quotaCheck.usage.requestCount + 1))
        });
    } catch (err) {
        console.error("AI ask error:", err);
        if (err.code === "PROVIDER_NOT_CONFIGURED") {
            return res.status(503).json({
                error: "ChatHub AI provider is not configured. Please set GEMINI_API_KEY in the environment.",
                code: "PROVIDER_NOT_CONFIGURED"
            });
        }
        if (err.code === "REQUEST_TIMEOUT") {
            return res.status(504).json({
                error: "AI response timed out. Please try again.",
                code: "REQUEST_TIMEOUT"
            });
        }
        if (err.code === "QUOTA_EXCEEDED") {
            return res.status(429).json({ error: err.message, code: "QUOTA_EXCEEDED" });
        }
        return res.status(500).json({ error: err.message || "Failed to answer conversation question.", code: err.code || "AI_ERROR" });
    }
});

// 4. Extract Action Items, Tasks, and Deadlines
app.post("/api/ai/conversations/:conversationId/action-items", authenticateToken, async (req, res) => {
    try {
        const { conversationId } = req.params;
        const { maxMessages = 50 } = req.body;
        const username = req.user.username;
        const userId = req.user.id || username;
        const providerOverride = req.headers["x-ai-provider"] || null;

        // Verify conversation access
        const convResult = await db.getRecentConversationMessages(conversationId, username, maxMessages);
        if (!convResult.authorized) {
            return res.status(403).json({
                error: convResult.error || "Forbidden: You are not authorized to access this conversation.",
                code: "UNAUTHORIZED_CONVERSATION"
            });
        }

        // Check quota
        const quotaCheck = await checkAiQuota(userId);
        if (!quotaCheck.allowed) {
            return res.status(429).json({
                error: "Daily AI request limit reached. Please try again tomorrow.",
                code: "QUOTA_EXCEEDED",
                limit: quotaCheck.limit,
                requestCount: quotaCheck.usage.requestCount
            });
        }

        const requestId = `req_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        const itemsResult = await aiService.extractActionItems({
            messages: convResult.messages,
            conversationType: convResult.conversationType,
            maxMessages,
            providerOverride
        });

        await db.incrementAiUsage({
            userId,
            periodStart: quotaCheck.periodStart,
            inputTokens: itemsResult.inputTokens,
            outputTokens: itemsResult.outputTokens,
            estimatedCost: 0
        });

        await db.saveAiResult({
            userId,
            conversationId,
            type: "action-items",
            status: "success",
            requestId,
            model: itemsResult.model,
            inputMessageCount: itemsResult.inputMessageCount,
            result: itemsResult
        });

        return res.json({
            success: true,
            requestId,
            conversationId,
            conversationType: convResult.conversationType,
            partnerName: convResult.partnerName,
            result: itemsResult,
            remainingQuota: Math.max(0, DAILY_AI_QUOTA - (quotaCheck.usage.requestCount + 1))
        });
    } catch (err) {
        console.error("AI action items error:", err);
        if (err.code === "PROVIDER_NOT_CONFIGURED") {
            return res.status(503).json({
                error: "ChatHub AI provider is not configured. Please set GEMINI_API_KEY in the environment.",
                code: "PROVIDER_NOT_CONFIGURED"
            });
        }
        if (err.code === "REQUEST_TIMEOUT") {
            return res.status(504).json({
                error: "AI action item extraction timed out. Please try again.",
                code: "REQUEST_TIMEOUT"
            });
        }
        if (err.code === "QUOTA_EXCEEDED") {
            return res.status(429).json({ error: err.message, code: "QUOTA_EXCEEDED" });
        }
        return res.status(500).json({ error: err.message || "Failed to extract action items.", code: err.code || "AI_ERROR" });
    }
});

// 5. Submit User Feedback on AI Result
app.post("/api/ai/feedback", authenticateToken, async (req, res) => {
    try {
        const { requestId, rating, comments } = req.body;
        const userId = req.user.id || req.user.username;

        if (!rating || !["positive", "negative"].includes(rating.toLowerCase())) {
            return res.status(400).json({ error: "Rating must be either 'positive' or 'negative'." });
        }

        const saved = await db.saveAiFeedback({
            userId,
            requestId: requestId || null,
            rating: rating.toLowerCase(),
            comments: (comments || "").slice(0, 500)
        });

        return res.json({ success: true, feedbackId: saved.id });
    } catch (err) {
        console.error("AI feedback error:", err);
        return res.status(500).json({ error: "Failed to record AI feedback." });
    }
});

// 6. Native Tone Adjuster Endpoint
app.post("/api/ai/tone", async (req, res) => {
    try {
        const { text, tone } = req.body;
        if (!text || !text.trim()) {
            return res.json({ adjustedText: "" });
        }
        const result = await aiService.adjustTone({ text, tone });
        return res.json(result);
    } catch (err) {
        console.error("API tone error:", err);
        return res.status(500).json({ error: "Failed to adjust tone", adjustedText: req.body?.text || "" });
    }
});

// 7. Native Message Translation Endpoint
app.post("/api/ai/translate", async (req, res) => {
    try {
        const { text, targetLang } = req.body;
        if (!text || !text.trim()) {
            return res.json({ translatedText: "" });
        }
        const result = await aiService.translateText({ text, targetLang: targetLang || "en" });
        return res.json(result);
    } catch (err) {
        console.error("API translate error:", err);
        return res.status(500).json({ error: "Failed to translate message", translatedText: `[Translated]: ${req.body?.text || ""}` });
    }
});

// Serve React production build from 'dist' if it exists, otherwise fallback to 'public'
const distPath = path.join(__dirname, "dist");
if (fs.existsSync(path.join(distPath, "index.html"))) {
    app.use(express.static(distPath));
    app.use((req, res, next) => {
        if (req.method === "GET" && !req.path.startsWith("/socket.io")) {
            return res.sendFile(path.join(distPath, "index.html"));
        }
        next();
    });
} else {
    app.use(express.static(path.join(__dirname, "public")));
    app.get("/", (req, res) => {
        return res.sendFile(path.join(__dirname, "public", "index.html"));
    });
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});