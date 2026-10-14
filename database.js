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
        await db.execute(`
            CREATE TABLE IF NOT EXISTS otps (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL COLLATE NOCASE,
                otp_hash TEXT NOT NULL,
                purpose TEXT NOT NULL,
                payload TEXT,
                attempts INTEGER DEFAULT 0,
                expires_at INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );
        `);
        try { await db.execute(`ALTER TABLE users ADD COLUMN full_name TEXT;`); } catch (_) {}
        try { await db.execute(`ALTER TABLE users ADD COLUMN email TEXT;`); } catch (_) {}
        try { await db.execute(`ALTER TABLE users ADD COLUMN is_verified INTEGER DEFAULT 1;`); } catch (_) {}
        try { await db.execute(`ALTER TABLE users ADD COLUMN google_id TEXT;`); } catch (_) {}
        try { await db.execute(`ALTER TABLE users ADD COLUMN dob TEXT;`); } catch (_) {}
        try { await db.execute(`ALTER TABLE users ADD COLUMN bio TEXT;`); } catch (_) {}

        await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_call_logs_receiver ON call_logs(receiver_username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);`);
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
async function createUser({ id, fullName = "", email = "", username, passwordHash = "", avatarColor = "#10b981", googleId = null, isVerified = 1 }) {
    try {
        const userId = id || `u_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        await db.execute({
            sql: `
                INSERT INTO users (id, full_name, email, username, password_hash, avatar_color, google_id, is_verified, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [userId, fullName, email.toLowerCase(), username, passwordHash, avatarColor, googleId, isVerified, Date.now()]
        });
        return {
            id: userId,
            fullName,
            email: email.toLowerCase(),
            username,
            color: avatarColor,
            isVerified
        };
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
            fullName: row.full_name || row.username,
            email: row.email,
            username: row.username,
            dob: row.dob || '',
            bio: row.bio || '',
            passwordHash: row.password_hash,
            color: row.avatar_color,
            isVerified: row.is_verified,
            googleId: row.google_id,
            createdAt: row.created_at
        };
    } catch (err) {
        console.error("Error fetching user by username:", err);
        return null;
    }
}

async function getUserByEmail(email) {
    if (!email) return null;
    try {
        const rs = await db.execute({
            sql: `SELECT * FROM users WHERE email = ? COLLATE NOCASE LIMIT 1`,
            args: [email.toLowerCase().trim()]
        });
        if (rs.rows.length === 0) return null;
        const row = rs.rows[0];
        return {
            id: row.id,
            fullName: row.full_name || row.username,
            email: row.email,
            username: row.username,
            passwordHash: row.password_hash,
            color: row.avatar_color,
            isVerified: row.is_verified,
            googleId: row.google_id,
            createdAt: row.created_at
        };
    } catch (err) {
        console.error("Error fetching user by email:", err);
        return null;
    }
}

async function getUserByIdentifier(identifier) {
    if (!identifier) return null;
    const clean = identifier.trim().toLowerCase();
    try {
        const rs = await db.execute({
            sql: `SELECT * FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE LIMIT 1`,
            args: [clean, clean]
        });
        if (rs.rows.length === 0) return null;
        const row = rs.rows[0];
        return {
            id: row.id,
            fullName: row.full_name || row.username,
            email: row.email,
            username: row.username,
            dob: row.dob || '',
            bio: row.bio || '',
            passwordHash: row.password_hash,
            color: row.avatar_color,
            isVerified: row.is_verified,
            googleId: row.google_id,
            createdAt: row.created_at
        };
    } catch (err) {
        console.error("Error fetching user by identifier:", err);
        return null;
    }
}

async function getUserByGoogleId(googleId) {
    if (!googleId) return null;
    try {
        const rs = await db.execute({
            sql: `SELECT * FROM users WHERE google_id = ? LIMIT 1`,
            args: [googleId]
        });
        if (rs.rows.length === 0) return null;
        const row = rs.rows[0];
        return {
            id: row.id,
            fullName: row.full_name || row.username,
            email: row.email,
            username: row.username,
            color: row.avatar_color,
            isVerified: row.is_verified,
            googleId: row.google_id,
            createdAt: row.created_at
        };
    } catch (err) {
        console.error("Error fetching user by googleId:", err);
        return null;
    }
}

async function updateUserPassword(userId, newPasswordHash) {
    try {
        await db.execute({
            sql: `UPDATE users SET password_hash = ? WHERE id = ?`,
            args: [newPasswordHash, userId]
        });
        return true;
    } catch (err) {
        console.error("Error updating password in DB:", err);
        return false;
    }
}

async function linkGoogleAccount(userId, googleId) {
    try {
        await db.execute({
            sql: `UPDATE users SET google_id = ?, is_verified = 1 WHERE id = ?`,
            args: [googleId, userId]
        });
        return true;
    } catch (err) {
        console.error("Error linking google account:", err);
        return false;
    }
}

async function updateUserProfile({ userId, currentUsername, fullName, username, dob, bio, avatarColor }) {
    try {
        const cleanUsername = username ? username.trim() : currentUsername;
        const cleanFullName = fullName ? fullName.trim() : cleanUsername;
        
        // If username changed, check availability
        if (cleanUsername.toLowerCase() !== currentUsername.toLowerCase()) {
            const clash = await getUserByUsername(cleanUsername);
            if (clash && clash.id !== userId) {
                return { success: false, error: "Username is already taken by another user." };
            }
        }

        await db.execute({
            sql: `
                UPDATE users 
                SET full_name = ?, username = ?, dob = ?, bio = ?, avatar_color = COALESCE(?, avatar_color)
                WHERE username = ? COLLATE NOCASE OR id = ?
            `,
            args: [cleanFullName, cleanUsername, dob || '', bio || '', avatarColor || null, currentUsername, userId]
        });

        // If username changed, update sent and received messages history
        if (cleanUsername.toLowerCase() !== currentUsername.toLowerCase()) {
            await db.execute({
                sql: `UPDATE messages SET sender_username = ? WHERE sender_username = ? COLLATE NOCASE`,
                args: [cleanUsername, currentUsername]
            });
            await db.execute({
                sql: `UPDATE messages SET recipient_username = ? WHERE recipient_username = ? COLLATE NOCASE`,
                args: [cleanUsername, currentUsername]
            });
        }

        const updated = await getUserByUsername(cleanUsername);
        return { success: true, user: updated };
    } catch (err) {
        console.error("Error updating user profile in DB:", err);
        return { success: false, error: err.message || "Failed to update profile." };
    }
}

// --- OTP Management Queries ---
async function saveOtp({ email, otpHash, purpose, payload = null, expiresInMinutes = 5 }) {
    try {
        const cleanEmail = email.toLowerCase().trim();
        // Clear previous active OTPs for this email & purpose
        await db.execute({
            sql: `DELETE FROM otps WHERE email = ? AND purpose = ?`,
            args: [cleanEmail, purpose]
        });

        const id = `otp_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        const expiresAt = Date.now() + expiresInMinutes * 60 * 1000;
        await db.execute({
            sql: `
                INSERT INTO otps (id, email, otp_hash, purpose, payload, attempts, expires_at, created_at)
                VALUES (?, ?, ?, ?, ?, 0, ?, ?)
            `,
            args: [id, cleanEmail, otpHash, purpose, payload ? JSON.stringify(payload) : null, expiresAt, Date.now()]
        });
        return { id, email: cleanEmail, expiresAt };
    } catch (err) {
        console.error("Error saving OTP:", err);
        throw err;
    }
}

async function getLatestOtp(email, purpose) {
    try {
        const cleanEmail = email.toLowerCase().trim();
        const rs = await db.execute({
            sql: `SELECT * FROM otps WHERE email = ? AND purpose = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 1`,
            args: [cleanEmail, purpose, Date.now()]
        });
        if (rs.rows.length === 0) return null;
        const row = rs.rows[0];
        return {
            id: row.id,
            email: row.email,
            otpHash: row.otp_hash,
            purpose: row.purpose,
            payload: row.payload ? JSON.parse(row.payload) : null,
            attempts: row.attempts,
            expiresAt: row.expires_at,
            createdAt: row.created_at
        };
    } catch (err) {
        console.error("Error fetching latest OTP:", err);
        return null;
    }
}

async function incrementOtpAttempts(id) {
    try {
        await db.execute({
            sql: `UPDATE otps SET attempts = attempts + 1 WHERE id = ?`,
            args: [id]
        });
    } catch (err) {
        console.error("Error incrementing OTP attempts:", err);
    }
}

async function deleteOtp(id) {
    try {
        await db.execute({
            sql: `DELETE FROM otps WHERE id = ?`,
            args: [id]
        });
    } catch (err) {
        console.error("Error deleting OTP:", err);
    }
}

async function getAllUsers() {
    try {
        const rs = await db.execute(`SELECT id, full_name, email, username, avatar_color, dob, bio, created_at FROM users ORDER BY created_at DESC`);
        return rs.rows.map((row) => ({
            id: row.id,
            fullName: row.full_name || row.username,
            email: row.email,
            username: row.username,
            dob: row.dob || '',
            bio: row.bio || '',
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
    getUserByEmail,
    getUserByIdentifier,
    getUserByGoogleId,
    updateUserPassword,
    linkGoogleAccount,
    getAllUsers,
    getRecentChatsForUser,
    logCall,
    updateCallStatus,
    getCallLogs,
    saveOtp,
    getLatestOtp,
    incrementOtpAttempts,
    deleteOtp,
    updateUserProfile
};
