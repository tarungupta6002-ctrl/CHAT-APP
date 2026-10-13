const http = require("http");
const express = require("express");
const path = require("path");
const fs = require("fs");
const { Server } = require("socket.io");
const db = require("./database");

const app = express();
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

// Socket.io handlers
io.on("connection", (socket) => {
    // Send current online count immediately
    socket.emit("users-count", users.size);
    broadcastUsersList();

    // User joins with a chosen username
    socket.on("user-join", async (username) => {
        const cleanName = (username && username.trim()) ? username.trim().slice(0, 20) : `User-${socket.id.slice(0, 4)}`;
        const userObj = {
            username: cleanName,
            color: getRandomColor()
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

        const hasText = messageText && messageText.trim().length > 0;
        const hasImage = Boolean(image);
        const hasAudio = Boolean(audio);

        if (!hasText && !hasImage && !hasAudio) return;

        const user = users.get(socket.id) || { username: "Guest", color: "#6366f1" };

        const messagePayload = {
            id: `${socket.id}-${Date.now()}`,
            senderId: socket.id,
            recipientId: recipientId,
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

        const recipientUser = recipientId ? users.get(recipientId) : null;
        const recipientUsername = recipientUser ? recipientUser.username : null;

        // Persist message to SQLite / Turso
        await db.saveMessage({
            ...messagePayload,
            recipientUsername: recipientUsername
        });

        if (recipientId && users.has(recipientId)) {
            if (recipientId === socket.id) {
                // Notes to Self
                socket.emit("message", messagePayload);
            } else {
                // Private 1-on-1 DM: Send to recipient and sender only
                socket.to(recipientId).emit("message", messagePayload);
                socket.emit("message", messagePayload);
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
    socket.on("call-offer", ({ to, offer, isVideo }) => {
        const caller = users.get(socket.id);
        if (!to || !users.has(to)) {
            socket.emit("call-failed", { reason: "User is currently offline or unavailable" });
            return;
        }
        socket.to(to).emit("incoming-call", {
            from: socket.id,
            fromName: caller ? caller.username : "Caller",
            fromColor: caller ? caller.color : "#6366f1",
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