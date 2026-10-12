require("dotenv").config();
const path = require("path");
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
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_username);`);
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

module.exports = {
    saveMessage,
    deleteMessage,
    editMessage,
    getGeneralHistory,
    getDmHistory
};
