require("dotenv").config();
const path = require("path");
const crypto = require("crypto");
const { createClient } = require("@libsql/client");

// Support both remote Turso URL or local chat.db file
const localDbPath = path.join(__dirname, "chat.db").replace(/\\/g, "/");
let url = process.env.TURSO_DATABASE_URL || `file:${localDbPath}`;
// Convert libsql:// to https:// for fast, reliable HTTP transport
if (url.startsWith("libsql://")) {
    url = url.replace("libsql://", "https://");
}
const authToken = process.env.TURSO_AUTH_TOKEN || undefined;

console.log(`[Database] Connecting to: ${process.env.TURSO_DATABASE_URL ? "Turso Cloud SQLite" : "Local SQLite (chat.db)"}`);

const db = createClient({
    url,
    authToken
});

// Initialize schema
async function initDb() {
    try {
        await db.execute(`
            CREATE TABLE IF NOT EXISTS messages (
                id TEXT PRIMARY KEY,
                sender_id TEXT,
                sender_username TEXT,
                recipient_id TEXT,
                recipient_username TEXT,
                avatar_color TEXT,
                text TEXT,
                image TEXT,
                audio TEXT,
                audio_duration TEXT,
                reply_to TEXT,
                is_view_once INTEGER DEFAULT 0,
                is_deleted INTEGER DEFAULT 0,
                time TEXT,
                created_at INTEGER
            );
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                username TEXT UNIQUE COLLATE NOCASE,
                password_hash TEXT,
                avatar_color TEXT,
                created_at INTEGER
            );
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS call_logs (
                id TEXT PRIMARY KEY,
                room_id TEXT,
                caller_username TEXT,
                receiver_username TEXT,
                call_type TEXT,
                status TEXT,
                duration_seconds INTEGER DEFAULT 0,
                created_at INTEGER
            );
        `);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_call_logs_receiver ON call_logs(receiver_username);`);
    } catch (err) {
        console.error("[Database] Initialization error:", err);
    }
}
initDb();

// Insert message
async function saveMessage(msg) {
    try {
        await db.execute({
            sql: `
                INSERT OR REPLACE INTO messages (
                    id, sender_id, sender_username, recipient_id, recipient_username,
                    avatar_color, text, image, audio, audio_duration,
                    reply_to, is_view_once, is_deleted, time, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                msg.id,
                msg.senderId || "",
                msg.username || "Guest",
                msg.recipientId || null,
                msg.recipientUsername || null,
                msg.avatarColor || "#6366f1",
                msg.text || "",
                msg.isViewOnce ? null : (msg.image || null), // View-once photos are never stored for privacy
                msg.audio || null,
                msg.audioDuration || null,
                msg.replyTo ? JSON.stringify(msg.replyTo) : null,
                msg.isViewOnce ? 1 : 0,
                msg.isDeleted ? 1 : 0,
                msg.time || "",
                Date.now()
            ]
        });
    } catch (err) {
        console.error("Error saving message to SQLite/Turso:", err);
    }
}

// Mark message as deleted
async function deleteMessage(messageId) {
    try {
        await db.execute({
            sql: `
                UPDATE messages 
                SET is_deleted = 1, text = '', image = NULL, audio = NULL 
                WHERE id = ?
            `,
            args: [messageId]
        });
    } catch (err) {
        console.error("Error deleting message in SQLite/Turso:", err);
    }
}

// Edit message text
async function editMessage(messageId, newText) {
    try {
        await db.execute({
            sql: `
                UPDATE messages 
                SET text = ? 
                WHERE id = ?
            `,
            args: [newText, messageId]
        });
    } catch (err) {
        console.error("Error editing message in SQLite/Turso:", err);
    }
}

// Retrieve public General Room messages
async function getGeneralHistory(limit = 100) {
    try {
        const rs = await db.execute({
            sql: `
                SELECT * FROM messages 
                WHERE recipient_username IS NULL 
                ORDER BY created_at ASC 
                LIMIT ?
            `,
            args: [limit]
        });
        return rs.rows.map(mapRowToMessage);
    } catch (err) {
        console.error("Error getting general history from SQLite/Turso:", err);
        return [];
    }
}

// Retrieve DM history between two usernames
async function getDmHistory(usernameA, usernameB, limit = 100) {
    try {
        const rs = await db.execute({
            sql: `
                SELECT * FROM messages 
                WHERE (sender_username = ? AND recipient_username = ?)
                   OR (sender_username = ? AND recipient_username = ?)
                ORDER BY created_at ASC 
                LIMIT ?
            `,
            args: [usernameA, usernameB, usernameB, usernameA, limit]
        });
        return rs.rows.map(mapRowToMessage);
    } catch (err) {
        console.error("Error getting DM history from SQLite/Turso:", err);
        return [];
    }
}

// Helper to convert DB row to client message object
function mapRowToMessage(row) {
    let replyTo = null;
    if (row.reply_to) {
        try {
            replyTo = JSON.parse(row.reply_to);
        } catch (e) {}
    }

    return {
        id: row.id,
        senderId: row.sender_id,
        recipientId: row.recipient_id,
        recipientUsername: row.recipient_username,
        username: row.sender_username,
        avatarColor: row.avatar_color,
        text: row.text,
        image: row.image,
        audio: row.audio,
        audioDuration: row.audio_duration,
        replyTo: replyTo,
        isViewOnce: Boolean(row.is_view_once),
        isDeleted: Boolean(row.is_deleted),
        time: row.time
    };
}

// User Authentication & Management Queries
async function createUser(id, username, passwordHash, avatarColor) {
    try {
        await db.execute({
            sql: `INSERT INTO users (id, username, password_hash, avatar_color, created_at) VALUES (?, ?, ?, ?, ?)`,
            args: [id, username, passwordHash, avatarColor, Date.now()]
        });
        return { id, username, color: avatarColor };
    } catch (err) {
        console.error("Error creating user in DB:", err);
        throw err;
    }
}

async function getUserByUsername(username) {
    try {
        const rs = await db.execute({
            sql: `SELECT * FROM users WHERE username = ? COLLATE NOCASE LIMIT 1`,
            args: [username]
        });
        if (rs.rows.length === 0) return null;
        const row = rs.rows[0];
        return {
            id: row.id,
            username: row.username,
            passwordHash: row.password_hash,
            color: row.avatar_color,
            createdAt: row.created_at
        };
    } catch (err) {
        console.error("Error fetching user by username:", err);
        return null;
    }
}

async function getAllUsers() {
    try {
        const rs = await db.execute(`SELECT id, username, avatar_color, created_at FROM users ORDER BY created_at DESC`);
        return rs.rows.map((row) => ({
            id: row.id,
            username: row.username,
            color: row.avatar_color,
            createdAt: row.created_at
        }));
    } catch (err) {
        console.error("Error fetching all users:", err);
        return [];
    }
}

async function getRecentChatsForUser(username) {
    try {
        const rs = await db.execute({
            sql: `
                SELECT * FROM messages
                WHERE sender_username = ? OR recipient_username = ?
                ORDER BY created_at DESC
                LIMIT 200
            `,
            args: [username, username]
        });

        const chatsMap = new Map();
        rs.rows.forEach((r) => {
            const partner = (r.sender_username.toLowerCase() === username.toLowerCase()) 
                ? r.recipient_username 
                : r.sender_username;
            
            if (partner && !chatsMap.has(partner.toLowerCase())) {
                chatsMap.set(partner.toLowerCase(), {
                    partnerUsername: partner,
                    partnerColor: (r.sender_username.toLowerCase() === partner.toLowerCase()) ? r.avatar_color : null,
                    lastMessage: r.text || (r.image ? "📷 Photo" : (r.audio ? "🎙️ Voice note" : "")),
                    lastTime: r.time,
                    createdAt: r.created_at
                });
            }
        });
        return Array.from(chatsMap.values());
    } catch (err) {
        console.error("Error fetching recent chats:", err);
        return [];
    }
}

async function logCall({ id, roomId, callerUsername, receiverUsername, callType, status = "initiated", durationSeconds = 0 }) {
    try {
        await db.execute({
            sql: `
                INSERT OR REPLACE INTO call_logs (
                    id, room_id, caller_username, receiver_username,
                    call_type, status, duration_seconds, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                id || crypto.randomUUID(),
                roomId || null,
                callerUsername,
                receiverUsername,
                callType || "video",
                status,
                durationSeconds || 0,
                Date.now()
            ]
        });
    } catch (err) {
        console.error("Error logging call:", err);
    }
}

async function updateCallStatus(id, status, durationSeconds = 0) {
    try {
        await db.execute({
            sql: `UPDATE call_logs SET status = ?, duration_seconds = ? WHERE id = ? OR room_id = ?`,
            args: [status, durationSeconds, id, id]
        });
    } catch (err) {
        console.error("Error updating call status:", err);
    }
}

async function getCallLogs(username) {
    try {
        const rs = await db.execute({
            sql: `
                SELECT * FROM call_logs
                WHERE caller_username = ? OR receiver_username = ?
                ORDER BY created_at DESC
                LIMIT 50
            `,
            args: [username, username]
        });
        return rs.rows;
    } catch (err) {
        console.error("Error fetching call logs:", err);
        return [];
    }
}

module.exports = {
    saveMessage,
    deleteMessage,
    editMessage,
    getGeneralHistory,
    getDmHistory,
    createUser,
    getUserByUsername,
    getAllUsers,
    getRecentChatsForUser,
    logCall,
    updateCallStatus,
    getCallLogs
};
