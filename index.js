const http = require("http");
const express = require("express");
const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const { Server } = require("socket.io");
const db = require("./database");

const app = express();
app.use(express.json());

const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 1e8 // Allow up to 100MB for image transfers
});

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

// Broadcast full active users list
function broadcastUsersList() {
    const list = Array.from(users.entries()).map(([id, u]) => ({
        id: id,
        username: u.username,
        color: u.color
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
        if (!color) {
            const dbUser = await db.getUserByUsername(cleanName);
            color = dbUser ? dbUser.color : getRandomColor();
        }

        const userObj = {
            username: cleanName,
            color: color
        };
        users.set(socket.id, userObj);

        // Notify client with their own profile details
        socket.emit("join-success", {
            id: socket.id,
            username: cleanName,
            color: userObj.color
        });

        // Send persisted General Room history from SQLite / Turso
        const history = await db.getGeneralHistory(100);
        socket.emit("chat-history", { type: "general", messages: history });

        // Broadcast active users list
        broadcastUsersList();

        // Broadcast join system message (General room)
        socket.broadcast.emit("user-status", {
            username: cleanName,
            status: "joined",
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        });
    });

    // Request active users list on demand
    socket.on("get-users", () => {
        broadcastUsersList();
    });

    // Receive message from client (Text, Image, or Voice Note)
    socket.on("user-message", async (data) => {
        const messageText = typeof data === "string" ? data : (data?.text || "");
        const image = data?.image || null;
        const audio = data?.audio || null;
        const audioDuration = data?.audioDuration || null;
        const isViewOnce = Boolean(data?.isViewOnce);
        const recipientId = data?.recipientId || null;
        let recipientUsername = (data?.recipientUsername || "").trim() || null;

        const hasText = messageText && messageText.trim().length > 0;
        const hasImage = Boolean(image);
        const hasAudio = Boolean(audio);

        if (!hasText && !hasImage && !hasAudio) return;

        const user = users.get(socket.id) || { username: "Guest", color: "#6366f1" };

        let targetSocketId = recipientId;
        if (!targetSocketId && recipientUsername) {
            targetSocketId = findSocketIdByUsername(recipientUsername);
        } else if (targetSocketId && !recipientUsername) {
            const rUser = users.get(targetSocketId);
            if (rUser) recipientUsername = rUser.username;
        }

        const isPrivateDm = Boolean(recipientUsername || targetSocketId);

        const messagePayload = {
            id: `${socket.id}-${Date.now()}`,
            senderId: socket.id,
            recipientId: targetSocketId,
            recipientUsername: recipientUsername,
            username: user.username,
            avatarColor: user.color,
            text: hasText ? messageText.trim() : "",
            image: hasImage ? image : null,
            audio: hasAudio ? audio : null,
            audioDuration: hasAudio ? audioDuration : null,
            replyTo: data?.replyTo || null,
            isViewOnce: isViewOnce,
            openedBy: [],
            time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
        };

        // Persist message to SQLite / Turso
        await db.saveMessage({
            ...messagePayload,
            recipientUsername: recipientUsername
        });

        if (isPrivateDm) {
            // Send back to sender
            socket.emit("message", messagePayload);

            // Send to recipient if they are connected on a socket
            if (targetSocketId && targetSocketId !== socket.id && users.has(targetSocketId)) {
                socket.to(targetSocketId).emit("message", messagePayload);
            }
        } else {
            // Public Room: Broadcast to everyone
            io.emit("message", messagePayload);
        }
    });

    // Retrieve DM history on demand
    socket.on("get-dm-history", async ({ partnerUsername }) => {
        const user = users.get(socket.id);
        if (!user || !partnerUsername) return;
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

    // --- WebRTC 1-on-1 Audio / Video Calling Signaling ---
    socket.on("call-offer", ({ to, toUsername, offer, isVideo }) => {
        const caller = users.get(socket.id);
        let targetSocketId = to;
        if (!targetSocketId && toUsername) {
            targetSocketId = findSocketIdByUsername(toUsername);
        }
        if (!targetSocketId || !users.has(targetSocketId)) {
            socket.emit("call-failed", { reason: `${toUsername || "User"} is currently offline or unavailable` });
            return;
        }
        socket.to(targetSocketId).emit("incoming-call", {
            from: socket.id,
            fromName: caller ? caller.username : "Caller",
            fromColor: caller ? caller.color : "#00a884",
            offer,
            isVideo: Boolean(isVideo)
        });
    });

    socket.on("call-answer", ({ to, answer }) => {
        if (to && users.has(to)) {
            socket.to(to).emit("call-answered", {
                from: socket.id,
                answer
            });
        }
    });

    socket.on("ice-candidate", ({ to, candidate }) => {
        if (to && candidate) {
            socket.to(to).emit("ice-candidate", {
                from: socket.id,
                candidate
            });
        }
    });

    socket.on("call-reject", ({ to }) => {
        if (to && users.has(to)) {
            socket.to(to).emit("call-rejected", { from: socket.id });
        }
    });

    socket.on("call-end", ({ to }) => {
        if (to && users.has(to)) {
            socket.to(to).emit("call-ended", { from: socket.id });
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

const JWT_SECRET = process.env.JWT_SECRET || "pulsechat-secret-token-key-2026";
function createToken(user) {
    const payload = JSON.stringify({ id: user.id, username: user.username, exp: Date.now() + 30 * 24 * 3600 * 1000 });
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

// --- REST API Endpoints ---
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

        const id = `u_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        const pwdHash = hashPassword(password);
        const avatarColor = getRandomColor();

        const user = await db.createUser(id, cleanUsername, pwdHash, avatarColor);
        const token = createToken(user);

        return res.status(201).json({
            user: { id: user.id, username: user.username, color: user.color },
            token
        });
    } catch (err) {
        console.error("Register error:", err);
        return res.status(500).json({ error: "Registration failed. Please try again." });
    }
});

app.post("/api/auth/login", async (req, res) => {
    try {
        const { username, password } = req.body;
        if (!username || !password) {
            return res.status(400).json({ error: "Username and password are required." });
        }

        const cleanUsername = username.trim();
        const user = await db.getUserByUsername(cleanUsername);
        if (!user || !verifyPassword(password, user.passwordHash)) {
            return res.status(401).json({ error: "Invalid username or password." });
        }

        const token = createToken(user);
        return res.json({
            user: { id: user.id, username: user.username, color: user.color },
            token
        });
    } catch (err) {
        console.error("Login error:", err);
        return res.status(500).json({ error: "Login failed." });
    }
});

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
        user: { id: user.id, username: user.username, color: user.color }
    });
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