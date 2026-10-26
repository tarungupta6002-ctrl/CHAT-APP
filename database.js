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

// Fast in-memory cache for instant 0ms block checks
const blockedCache = new Set();
// Fast in-memory cache for instant 0ms cleared chat lookups
const chatClearsCache = new Map();

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
        try { await db.execute(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`); } catch (_) {}
        try { await db.execute(`ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent';`); } catch (_) {}
        try { await db.execute(`ALTER TABLE messages ADD COLUMN sender_avatar_url TEXT;`); } catch (_) {}
        try { await db.execute(`ALTER TABLE messages ADD COLUMN is_blocked_send INTEGER DEFAULT 0;`); } catch (_) {}
        try { await db.execute(`ALTER TABLE messages ADD COLUMN file TEXT;`); } catch (_) {}
        try { await db.execute(`ALTER TABLE messages ADD COLUMN file_name TEXT;`); } catch (_) {}
        try { await db.execute(`ALTER TABLE messages ADD COLUMN file_size TEXT;`); } catch (_) {}
        try { await db.execute(`ALTER TABLE messages ADD COLUMN file_type TEXT;`); } catch (_) {}
        try { await db.execute(`ALTER TABLE messages ADD COLUMN group_id TEXT;`); } catch (_) {}

        await db.execute(`
            CREATE TABLE IF NOT EXISTS blocked_users (
                id TEXT PRIMARY KEY,
                blocker_username TEXT NOT NULL COLLATE NOCASE,
                blocked_username TEXT NOT NULL COLLATE NOCASE,
                created_at INTEGER NOT NULL,
                UNIQUE(blocker_username, blocked_username)
            );
        `);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_blocked_blocker ON blocked_users(blocker_username);`);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS ai_results (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                conversation_id TEXT NOT NULL,
                type TEXT NOT NULL,
                status TEXT NOT NULL,
                request_id TEXT,
                model TEXT,
                input_message_count INTEGER DEFAULT 0,
                result TEXT,
                created_at INTEGER NOT NULL
            );
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS ai_usage (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                period_start INTEGER NOT NULL,
                request_count INTEGER DEFAULT 0,
                input_tokens INTEGER DEFAULT 0,
                output_tokens INTEGER DEFAULT 0,
                estimated_cost REAL DEFAULT 0.0,
                updated_at INTEGER NOT NULL,
                UNIQUE(user_id, period_start)
            );
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS ai_feedback (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                request_id TEXT,
                rating TEXT NOT NULL,
                comments TEXT,
                created_at INTEGER NOT NULL
            );
        `);

        await db.execute(`
            CREATE TABLE IF NOT EXISTS statuses (
                id TEXT PRIMARY KEY,
                user_id TEXT,
                username TEXT NOT NULL COLLATE NOCASE,
                avatar_color TEXT,
                avatar_url TEXT,
                type TEXT DEFAULT 'text',
                text TEXT,
                bg_gradient TEXT,
                audio TEXT,
                audio_duration TEXT,
                image TEXT,
                created_at INTEGER NOT NULL,
                expires_at INTEGER NOT NULL
            );
        `);

        await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_statuses_username ON statuses(username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_statuses_expires_at ON statuses(expires_at);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_call_logs_receiver ON call_logs(receiver_username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_ai_results_user ON ai_results(user_id);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_ai_results_conv ON ai_results(conversation_id);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id, period_start);`);

        // Per-user chat clear tracking (clearing chat never deletes messages for other users)
        await db.execute(`
            CREATE TABLE IF NOT EXISTS chat_clears (
                id TEXT PRIMARY KEY,
                username TEXT NOT NULL COLLATE NOCASE,
                chat_key TEXT NOT NULL COLLATE NOCASE,
                cleared_at INTEGER NOT NULL,
                UNIQUE(username, chat_key)
            );
        `);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_chat_clears_user ON chat_clears(username, chat_key);`);

        // Custom Groups & Members
        await db.execute(`
            CREATE TABLE IF NOT EXISTS groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT DEFAULT '',
                avatar_url TEXT DEFAULT '',
                avatar_color TEXT DEFAULT '#10b981',
                created_by TEXT NOT NULL COLLATE NOCASE,
                created_at INTEGER NOT NULL
            );
        `);
        await db.execute(`
            CREATE TABLE IF NOT EXISTS group_members (
                id TEXT PRIMARY KEY,
                group_id TEXT NOT NULL,
                username TEXT NOT NULL COLLATE NOCASE,
                role TEXT DEFAULT 'member',
                joined_at INTEGER NOT NULL,
                UNIQUE(group_id, username)
            );
        `);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_group_members_user ON group_members(username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_group_members_group ON group_members(group_id);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);`);
        
        // Pre-fill in-memory blocked cache
        try {
            const blkRows = await db.execute(`SELECT blocker_username, blocked_username FROM blocked_users`);
            blkRows.rows.forEach((r) => {
                if (r.blocker_username && r.blocked_username) {
                    blockedCache.add(`${String(r.blocker_username).toLowerCase()}:${String(r.blocked_username).toLowerCase()}`);
                }
            });
        } catch (_) {}

        // Pre-fill in-memory chat clears cache
        try {
            const clrRows = await db.execute(`SELECT username, chat_key, cleared_at FROM chat_clears`);
            clrRows.rows.forEach((r) => {
                if (r.username && r.chat_key) {
                    chatClearsCache.set(`${String(r.username).toLowerCase()}:${String(r.chat_key).toLowerCase()}`, Number(r.cleared_at) || 0);
                }
            });
        } catch (_) {}
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
                    reply_to, is_view_once, is_deleted, time, created_at,
                    status, sender_avatar_url, is_blocked_send,
                    file, file_name, file_size, file_type, group_id
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
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
                msg.createdAt || Date.now(),
                msg.status || "sent",
                msg.avatarUrl || null,
                msg.isBlockedSend ? 1 : 0,
                msg.file || null,
                msg.fileName || null,
                msg.fileSize || null,
                msg.fileType || null,
                msg.groupId || null
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

// Fast in-memory cleared timestamp lookup
function getChatClearedAt(username, chatKey) {
    if (!username || !chatKey) return 0;
    const cacheKey = `${username.toLowerCase().trim()}:${chatKey.toLowerCase().trim()}`;
    return chatClearsCache.get(cacheKey) || 0;
}

// Persist chat cleared timestamp for a user (per-user isolation)
async function setChatCleared(username, chatKey, clearedAt = Date.now()) {
    if (!username || !chatKey) return false;
    const cleanUser = username.toLowerCase().trim();
    const cleanKey = chatKey.toLowerCase().trim();
    const ts = Number(clearedAt) || Date.now();
    chatClearsCache.set(`${cleanUser}:${cleanKey}`, ts);
    try {
        const id = `clr_${cleanUser}_${cleanKey}`;
        await db.execute({
            sql: `
                INSERT OR REPLACE INTO chat_clears (id, username, chat_key, cleared_at)
                VALUES (?, ?, ?, ?)
            `,
            args: [id, cleanUser, cleanKey, ts]
        });
        return true;
    } catch (err) {
        console.error("Error setting chat cleared in DB:", err);
        return false;
    }
}

// Retrieve public General Room messages (with dynamic sender profile info)
async function getGeneralHistory(limit = 100, forUsername = null) {
    try {
        const clearedAt = forUsername ? getChatClearedAt(forUsername, "general") : 0;
        const rs = await db.execute({
            sql: `
                SELECT m.*, u.avatar_url AS current_sender_avatar, u.avatar_color AS current_sender_color 
                FROM messages m
                LEFT JOIN users u ON LOWER(u.username) = LOWER(m.sender_username)
                WHERE m.recipient_username IS NULL 
                  AND (? = 0 OR COALESCE(m.created_at, 0) > ?)
                ORDER BY m.created_at ASC 
                LIMIT ?
            `,
            args: [clearedAt, clearedAt, limit]
        });
        return rs.rows.map(mapRowToMessage);
    } catch (err) {
        console.error("Error getting general history from SQLite/Turso:", err);
        return [];
    }
}

// Retrieve DM history between two usernames (with dynamic sender profile info)
async function getDmHistory(usernameA, usernameB, limit = 100, forUsername = null) {
    try {
        let clearedAt = 0;
        if (forUsername) {
            const partner = (forUsername.toLowerCase() === usernameA.toLowerCase()) ? usernameB : usernameA;
            clearedAt = getChatClearedAt(forUsername, partner);
        }

        const rs = await db.execute({
            sql: `
                SELECT m.*, u.avatar_url AS current_sender_avatar, u.avatar_color AS current_sender_color 
                FROM messages m
                LEFT JOIN users u ON LOWER(u.username) = LOWER(m.sender_username)
                WHERE ((m.sender_username = ? COLLATE NOCASE AND m.recipient_username = ? COLLATE NOCASE)
                   OR (m.sender_username = ? COLLATE NOCASE AND m.recipient_username = ? COLLATE NOCASE))
                  AND NOT (m.recipient_username = ? COLLATE NOCASE AND COALESCE(m.is_blocked_send, 0) = 1)
                  AND (? = 0 OR COALESCE(m.created_at, 0) > ?)
                ORDER BY m.created_at ASC 
                LIMIT ?
            `,
            args: [usernameA, usernameB, usernameB, usernameA, usernameA, clearedAt, clearedAt, limit]
        });
        return rs.rows.map(mapRowToMessage);
    } catch (err) {
        console.error("Error getting DM history from SQLite/Turso:", err);
        return [];
    }
}

// Mark pending messages in DM as read by the recipient
async function markDmAsRead(recipientUsername, senderUsername) {
    try {
        await db.execute({
            sql: `
                UPDATE messages 
                SET status = 'read' 
                WHERE recipient_username = ? COLLATE NOCASE 
                  AND sender_username = ? COLLATE NOCASE
                  AND (status IS NULL OR status != 'read')
            `,
            args: [recipientUsername, senderUsername]
        });
    } catch (err) {
        console.error("Error marking DM messages as read in DB:", err);
    }
}

// Mark pending messages as delivered when recipient is online
async function markDmAsDelivered(recipientUsername) {
    try {
        await db.execute({
            sql: `
                UPDATE messages 
                SET status = 'delivered' 
                WHERE recipient_username = ? COLLATE NOCASE 
                  AND (status IS NULL OR status = 'sent')
            `,
            args: [recipientUsername]
        });
    } catch (err) {
        console.error("Error marking DM messages as delivered in DB:", err);
    }
}

// Clear/delete all DM messages between two users
async function clearDmHistory(usernameA, usernameB) {
    if (!usernameA || !usernameB) return false;
    try {
        await db.execute({
            sql: `
                DELETE FROM messages 
                WHERE (sender_username = ? COLLATE NOCASE AND recipient_username = ? COLLATE NOCASE)
                   OR (sender_username = ? COLLATE NOCASE AND recipient_username = ? COLLATE NOCASE)
            `,
            args: [usernameA, usernameB, usernameB, usernameA]
        });
        return true;
    } catch (err) {
        console.error("Error clearing DM history in DB:", err);
        return false;
    }
}

// Block/Unblock DB Operations (Instant In-Memory Cache + Persistent SQLite / Turso)
async function blockUser(blocker, blocked) {
    if (!blocker || !blocked) return false;
    const cleanBlocker = blocker.trim().toLowerCase();
    const cleanBlocked = blocked.trim().toLowerCase();
    blockedCache.add(`${cleanBlocker}:${cleanBlocked}`);
    try {
        const id = `blk_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        await db.execute({
            sql: `INSERT OR IGNORE INTO blocked_users (id, blocker_username, blocked_username, created_at) VALUES (?, ?, ?, ?)`,
            args: [id, cleanBlocker, cleanBlocked, Date.now()]
        });
        return true;
    } catch (err) {
        console.error("Error blocking user in DB:", err);
        return false;
    }
}

async function unblockUser(blocker, blocked) {
    if (!blocker || !blocked) return false;
    const cleanBlocker = blocker.trim().toLowerCase();
    const cleanBlocked = blocked.trim().toLowerCase();
    blockedCache.delete(`${cleanBlocker}:${cleanBlocked}`);
    try {
        await db.execute({
            sql: `DELETE FROM blocked_users WHERE blocker_username = ? COLLATE NOCASE AND blocked_username = ? COLLATE NOCASE`,
            args: [cleanBlocker, cleanBlocked]
        });
        return true;
    } catch (err) {
        console.error("Error unblocking user in DB:", err);
        return false;
    }
}

function isUserBlocked(blocker, blocked) {
    if (!blocker || !blocked) return false;
    return blockedCache.has(`${blocker.trim().toLowerCase()}:${blocked.trim().toLowerCase()}`);
}

function getBlockedUsersFor(blocker) {
    if (!blocker) return [];
    const b = blocker.trim().toLowerCase();
    const result = [];
    for (const entry of blockedCache) {
        const [blker, blked] = entry.split(":");
        if (blker === b) result.push(blked);
    }
    return result;
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
        avatarColor: row.current_sender_color || row.avatar_color || '#6366f1',
        avatarUrl: row.current_sender_avatar || row.sender_avatar_url || '',
        status: row.status || 'sent',
        text: row.text,
        image: row.image,
        audio: row.audio,
        audioDuration: row.audio_duration,
        file: row.file || null,
        fileName: row.file_name || null,
        fileSize: row.file_size || null,
        fileType: row.file_type || null,
        replyTo: replyTo,
        groupId: row.group_id || null,
        isViewOnce: Boolean(row.is_view_once),
        isDeleted: Boolean(row.is_deleted),
        time: row.time,
        createdAt: row.created_at || (row.id ? parseInt(row.id.split('-').pop(), 10) : null)
    };
}

// User Authentication & Management Queries
async function createUser({ id, fullName = "", email = "", username, passwordHash = "", avatarColor = "#10b981", avatarUrl = "", googleId = null, isVerified = 1 }) {
    try {
        const userId = id || `u_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
        await db.execute({
            sql: `
                INSERT INTO users (id, full_name, email, username, password_hash, avatar_color, avatar_url, google_id, is_verified, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [userId, fullName, email.toLowerCase(), username, passwordHash, avatarColor, avatarUrl || null, googleId, isVerified, Date.now()]
        });
        return {
            id: userId,
            fullName,
            email: email.toLowerCase(),
            username,
            color: avatarColor,
            avatarUrl: avatarUrl || '',
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
            avatarUrl: row.avatar_url || '',
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
            dob: row.dob || '',
            bio: row.bio || '',
            passwordHash: row.password_hash,
            color: row.avatar_color,
            avatarUrl: row.avatar_url || '',
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
            avatarUrl: row.avatar_url || '',
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
            dob: row.dob || '',
            bio: row.bio || '',
            color: row.avatar_color,
            avatarUrl: row.avatar_url || '',
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
async function getUserById(id) {
    if (!id) return null;
    try {
        const rs = await db.execute({
            sql: `SELECT * FROM users WHERE id = ? LIMIT 1`,
            args: [id]
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
            avatarUrl: row.avatar_url || '',
            isVerified: row.is_verified,
            googleId: row.google_id,
            createdAt: row.created_at
        };
    } catch (err) {
        console.error("Error fetching user by id:", err);
        return null;
    }
}

async function updateUserProfile({ userId, currentUsername, fullName, username, dob, bio, avatarColor, avatarUrl }) {
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

        const existing = (await getUserByUsername(currentUsername)) || (userId ? await getUserById(userId) : null);
        const resolvedAvatarUrl = avatarUrl !== undefined ? (avatarUrl || '') : (existing?.avatarUrl || '');

        await db.execute({
            sql: `
                UPDATE users 
                SET full_name = ?, username = ?, dob = ?, bio = ?, avatar_color = COALESCE(?, avatar_color), avatar_url = ?
                WHERE username = ? COLLATE NOCASE OR id = ?
            `,
            args: [
                cleanFullName, 
                cleanUsername, 
                dob || '', 
                bio || '', 
                avatarColor || null, 
                resolvedAvatarUrl, 
                currentUsername, 
                userId || null
            ]
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

        const updated = (await getUserByUsername(cleanUsername)) || (userId ? await getUserById(userId) : null);
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
        const rs = await db.execute(`SELECT id, full_name, email, username, avatar_color, avatar_url, dob, bio, created_at FROM users ORDER BY created_at DESC`);
        return rs.rows.map((row) => ({
            id: row.id,
            fullName: row.full_name || row.username,
            email: row.email,
            username: row.username,
            dob: row.dob || '',
            bio: row.bio || '',
            color: row.avatar_color,
            avatarUrl: row.avatar_url || '',
            createdAt: row.created_at
        }));
    } catch (err) {
        console.error("Error fetching all users:", err);
        return [];
    }
}

async function getRecentChatsForUser(username) {
    try {
        const cleanUser = (username || "").toLowerCase().trim();
        const rs = await db.execute({
            sql: `
                SELECT m.*, u.avatar_url AS partner_avatar_url, u.avatar_color AS partner_avatar_color
                FROM messages m
                LEFT JOIN users u ON LOWER(u.username) = CASE 
                    WHEN LOWER(m.sender_username) = LOWER(?) THEN LOWER(m.recipient_username)
                    ELSE LOWER(m.sender_username)
                END
                WHERE (m.sender_username = ? COLLATE NOCASE OR m.recipient_username = ? COLLATE NOCASE)
                  AND NOT (m.recipient_username = ? COLLATE NOCASE AND COALESCE(m.is_blocked_send, 0) = 1)
                ORDER BY m.created_at DESC
                LIMIT 200
            `,
            args: [username, username, username, username]
        });

        const chatsMap = new Map();
        rs.rows.forEach((r) => {
            const partner = (r.sender_username.toLowerCase() === cleanUser) 
                ? r.recipient_username 
                : r.sender_username;
            
            if (partner && !chatsMap.has(partner.toLowerCase())) {
                const partnerKey = partner.toLowerCase();
                const clearedAt = getChatClearedAt(cleanUser, partnerKey);
                if (clearedAt > 0 && Number(r.created_at || 0) <= clearedAt) {
                    return;
                }
                chatsMap.set(partnerKey, {
                    partnerUsername: partner,
                    partnerColor: r.partner_avatar_color || ((r.sender_username.toLowerCase() === partnerKey) ? r.avatar_color : '#10b981'),
                    partnerAvatarUrl: r.partner_avatar_url || '',
                    lastMessage: r.text || (r.image ? "📷 Photo" : (r.audio ? "🎙️ Voice note" : (r.file ? ("📄 " + (r.file_name || "Document")) : ""))),
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

// --- AI Assistant Queries & Usage Tracking ---
async function saveAiResult({ id, userId, conversationId, type, status, requestId, model, inputMessageCount = 0, result }) {
    try {
        const rowId = id || `air_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        await db.execute({
            sql: `
                INSERT INTO ai_results (
                    id, user_id, conversation_id, type, status, request_id, model, input_message_count, result, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                rowId,
                userId || "",
                conversationId || "",
                type || "summary",
                status || "success",
                requestId || null,
                model || "",
                inputMessageCount || 0,
                typeof result === "object" ? JSON.stringify(result) : (result || ""),
                Date.now()
            ]
        });
        return rowId;
    } catch (err) {
        console.error("Error saving AI result:", err);
        return null;
    }
}

async function getAiUsage(userId, periodStart) {
    try {
        const rs = await db.execute({
            sql: `SELECT * FROM ai_usage WHERE user_id = ? AND period_start = ? LIMIT 1`,
            args: [userId, periodStart]
        });
        if (rs.rows.length === 0) {
            return {
                userId,
                periodStart,
                requestCount: 0,
                inputTokens: 0,
                outputTokens: 0,
                estimatedCost: 0
            };
        }
        const row = rs.rows[0];
        return {
            userId: row.user_id,
            periodStart: row.period_start,
            requestCount: row.request_count || 0,
            inputTokens: row.input_tokens || 0,
            outputTokens: row.output_tokens || 0,
            estimatedCost: row.estimated_cost || 0
        };
    } catch (err) {
        console.error("Error fetching AI usage:", err);
        return { userId, periodStart, requestCount: 0, inputTokens: 0, outputTokens: 0, estimatedCost: 0 };
    }
}

async function incrementAiUsage({ userId, periodStart, inputTokens = 0, outputTokens = 0, estimatedCost = 0 }) {
    try {
        const id = `use_${userId}_${periodStart}`;
        const now = Date.now();
        await db.execute({
            sql: `
                INSERT INTO ai_usage (id, user_id, period_start, request_count, input_tokens, output_tokens, estimated_cost, updated_at)
                VALUES (?, ?, ?, 1, ?, ?, ?, ?)
                ON CONFLICT(user_id, period_start) DO UPDATE SET
                    request_count = request_count + 1,
                    input_tokens = input_tokens + excluded.input_tokens,
                    output_tokens = output_tokens + excluded.output_tokens,
                    estimated_cost = estimated_cost + excluded.estimated_cost,
                    updated_at = excluded.updated_at
            `,
            args: [id, userId, periodStart, inputTokens, outputTokens, estimatedCost, now]
        });
        return await getAiUsage(userId, periodStart);
    } catch (err) {
        console.error("Error incrementing AI usage:", err);
        return null;
    }
}

async function saveAiFeedback({ id, userId, requestId, rating, comments }) {
    try {
        const rowId = id || `aif_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        await db.execute({
            sql: `
                INSERT INTO ai_feedback (id, user_id, request_id, rating, comments, created_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `,
            args: [rowId, userId || "", requestId || null, rating || "positive", comments || "", Date.now()]
        });
        return { success: true, id: rowId };
    } catch (err) {
        console.error("Error saving AI feedback:", err);
        return { success: false, error: err.message };
    }
}

async function getRecentConversationMessages(conversationId, requestingUsername, limit = 50) {
    try {
        const cleanLimit = Math.min(Math.max(parseInt(limit, 10) || 50, 5), 100);
        const cleanConv = (conversationId || "").trim();

        // 1. General room access
        if (cleanConv.toLowerCase() === "general") {
            const rs = await db.execute({
                sql: `
                    SELECT * FROM messages 
                    WHERE recipient_username IS NULL AND is_deleted = 0
                    ORDER BY created_at DESC 
                    LIMIT ?
                `,
                args: [cleanLimit]
            });
            const messages = rs.rows.reverse().map(mapRowToMessage);
            return {
                authorized: true,
                conversationType: "general",
                partnerName: null,
                messages
            };
        }

        // 2. Direct Messages (DM) access
        let partner = cleanConv;
        if (partner.toLowerCase().startsWith("dm:")) {
            partner = partner.slice(3).trim();
        }

        // If format is dm:userA:userB
        if (partner.includes(":")) {
            const parts = partner.split(":").map(p => p.trim());
            const isParticipant = parts.some(p => p.toLowerCase() === requestingUsername.toLowerCase());
            if (!isParticipant) {
                return {
                    authorized: false,
                    error: "Unauthorized: You do not have permission to access this private conversation."
                };
            }
            const other = parts.find(p => p.toLowerCase() !== requestingUsername.toLowerCase()) || requestingUsername;
            partner = other;
        }

        if (!partner) {
            return { authorized: false, error: "Invalid conversation identifier." };
        }

        // Fetch DM messages between requesting user and the partner
        const rs = await db.execute({
            sql: `
                SELECT * FROM messages 
                WHERE ((sender_username = ? COLLATE NOCASE AND recipient_username = ? COLLATE NOCASE)
                    OR (sender_username = ? COLLATE NOCASE AND recipient_username = ? COLLATE NOCASE))
                  AND is_deleted = 0
                ORDER BY created_at DESC 
                LIMIT ?
            `,
            args: [requestingUsername, partner, partner, requestingUsername, cleanLimit]
        });

        const messages = rs.rows.reverse().map(mapRowToMessage);
        return {
            authorized: true,
            conversationType: "dm",
            partnerName: partner,
            messages
        };
    } catch (err) {
        console.error("Error getting recent conversation messages:", err);
        return { authorized: false, error: "Failed to retrieve conversation messages." };
    }
}

// Live Vibe / Status Management
async function saveStatus({ id, userId = null, username, avatarColor = '#10b981', avatarUrl = '', type = 'text', text = '', bgGradient = '', audio = null, audioDuration = null, image = null, createdAt = Date.now(), expiresAt = null }) {
    try {
        const exp = expiresAt || (createdAt + 24 * 60 * 60 * 1000);
        await db.execute({
            sql: `
                INSERT INTO statuses (
                    id, user_id, username, avatar_color, avatar_url,
                    type, text, bg_gradient, audio, audio_duration, image,
                    created_at, expires_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
            args: [
                id, userId, username, avatarColor, avatarUrl,
                type, text, bgGradient, audio, audioDuration, image,
                createdAt, exp
            ]
        });
        return { success: true };
    } catch (err) {
        console.error("Error saving status to DB:", err);
        return { success: false, error: err.message };
    }
}

async function getActiveStatuses() {
    try {
        const now = Date.now();
        const rs = await db.execute({
            sql: `
                SELECT s.*, u.avatar_url AS current_user_avatar, u.avatar_color AS current_user_color
                FROM statuses s
                LEFT JOIN users u ON LOWER(u.username) = LOWER(s.username)
                WHERE s.expires_at > ?
                ORDER BY s.created_at ASC
            `,
            args: [now]
        });

        return rs.rows.map((r) => ({
            id: r.id,
            userId: r.user_id,
            username: r.username,
            avatarColor: r.current_user_color || r.avatar_color || '#10b981',
            avatarUrl: r.current_user_avatar || r.avatar_url || '',
            type: r.type || 'text',
            text: r.text || '',
            bgGradient: r.bg_gradient || 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
            audio: r.audio || null,
            audioDuration: r.audio_duration || null,
            image: r.image || null,
            createdAt: r.created_at,
            expiresAt: r.expires_at
        }));
    } catch (err) {
        console.error("Error getting active statuses:", err);
        return [];
    }
}

async function deleteStatus(statusId, username) {
    try {
        await db.execute({
            sql: `DELETE FROM statuses WHERE id = ? AND username = ? COLLATE NOCASE`,
            args: [statusId, username]
        });
        return { success: true };
    } catch (err) {
        console.error("Error deleting status:", err);
        return { success: false, error: err.message };
    }
}

// --- Custom Group Operations ---

async function createGroup({ name, description = '', avatarUrl = '', avatarColor = '#10b981', createdBy, members = [] }) {
    if (!name || !createdBy) throw new Error("Group name and createdBy are required");
    const groupId = `grp_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    const cleanCreator = createdBy.trim().toLowerCase();
    const cleanName = name.trim();
    const now = Date.now();

    // 1. Insert Group
    await db.execute({
        sql: `
            INSERT INTO groups (id, name, description, avatar_url, avatar_color, created_by, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `,
        args: [groupId, cleanName, description.trim(), avatarUrl || '', avatarColor || '#10b981', cleanCreator, now]
    });

    // 2. Add Creator as Admin
    const creatorMemberId = `grm_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
    await db.execute({
        sql: `
            INSERT INTO group_members (id, group_id, username, role, joined_at)
            VALUES (?, ?, ?, 'admin', ?)
        `,
        args: [creatorMemberId, groupId, cleanCreator, now]
    });

    // 3. Add other members
    const cleanMembers = Array.from(new Set(
        (Array.isArray(members) ? members : [])
            .map(m => String(m).trim().toLowerCase())
            .filter(m => m && m !== cleanCreator)
    ));

    for (const mem of cleanMembers) {
        const memId = `grm_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        try {
            await db.execute({
                sql: `
                    INSERT OR IGNORE INTO group_members (id, group_id, username, role, joined_at)
                    VALUES (?, ?, ?, 'member', ?)
                `,
                args: [memId, groupId, mem, now]
            });
        } catch (_) {}
    }

    return {
        id: groupId,
        name: cleanName,
        description: description.trim(),
        avatarUrl: avatarUrl || '',
        avatarColor: avatarColor || '#10b981',
        createdBy: cleanCreator,
        createdAt: now,
        memberCount: cleanMembers.length + 1,
        members: [cleanCreator, ...cleanMembers]
    };
}

async function isGroupMember(groupId, username) {
    if (!groupId || !username) return false;
    try {
        const rs = await db.execute({
            sql: `SELECT 1 FROM group_members WHERE group_id = ? AND username = ? COLLATE NOCASE LIMIT 1`,
            args: [groupId, username.trim().toLowerCase()]
        });
        return rs.rows.length > 0;
    } catch (_) {
        return false;
    }
}

async function getUserGroups(username) {
    if (!username) return [];
    const cleanUser = username.trim().toLowerCase();
    try {
        const rs = await db.execute({
            sql: `
                SELECT g.*, 
                       (SELECT COUNT(*) FROM group_members gm2 WHERE gm2.group_id = g.id) AS member_count,
                       (SELECT m.text FROM messages m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_text,
                       (SELECT m.image FROM messages m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_image,
                       (SELECT m.audio FROM messages m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_audio,
                       (SELECT m.file FROM messages m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_file,
                       (SELECT m.file_name FROM messages m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_file_name,
                       (SELECT m.sender_username FROM messages m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_sender,
                       (SELECT m.time FROM messages m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_time,
                       (SELECT m.created_at FROM messages m WHERE m.group_id = g.id ORDER BY m.created_at DESC LIMIT 1) AS last_message_created_at
                FROM groups g
                INNER JOIN group_members gm ON gm.group_id = g.id AND gm.username = ? COLLATE NOCASE
                ORDER BY COALESCE(last_message_created_at, g.created_at) DESC
            `,
            args: [cleanUser]
        });

        return rs.rows.map((row) => {
            let lastSnippet = '';
            if (row.last_message_text) {
                lastSnippet = row.last_message_text;
            } else if (row.last_message_image) {
                lastSnippet = '📷 Photo';
            } else if (row.last_message_audio) {
                lastSnippet = '🎙️ Voice note';
            } else if (row.last_message_file) {
                lastSnippet = `📄 ${row.last_message_file_name || 'Document'}`;
            }

            return {
                id: row.id,
                name: row.name,
                description: row.description || '',
                avatarUrl: row.avatar_url || '',
                avatarColor: row.avatar_color || '#10b981',
                createdBy: row.created_by,
                createdAt: row.created_at,
                memberCount: Number(row.member_count) || 1,
                lastMessage: lastSnippet,
                lastSender: row.last_message_sender || '',
                lastTime: row.last_message_time || '',
                lastCreatedAt: row.last_message_created_at || row.created_at
            };
        });
    } catch (err) {
        console.error("Error fetching user groups:", err);
        return [];
    }
}

async function getGroupDetails(groupId, requestingUsername) {
    if (!groupId || !requestingUsername) return null;
    const cleanUser = requestingUsername.trim().toLowerCase();
    try {
        const isMember = await isGroupMember(groupId, cleanUser);
        if (!isMember) return { authorized: false, error: "Not a member of this group" };

        const gRs = await db.execute({
            sql: `SELECT * FROM groups WHERE id = ? LIMIT 1`,
            args: [groupId]
        });
        if (gRs.rows.length === 0) return null;
        const group = gRs.rows[0];

        const mRs = await db.execute({
            sql: `
                SELECT gm.username, gm.role, gm.joined_at, 
                       u.full_name, u.avatar_color, u.avatar_url, u.bio
                FROM group_members gm
                LEFT JOIN users u ON LOWER(u.username) = LOWER(gm.username)
                WHERE gm.group_id = ?
                ORDER BY CASE WHEN gm.role = 'admin' THEN 0 ELSE 1 END, gm.joined_at ASC
            `,
            args: [groupId]
        });

        const members = mRs.rows.map(r => ({
            username: r.username,
            fullName: r.full_name || r.username,
            avatarColor: r.avatar_color || '#10b981',
            avatarUrl: r.avatar_url || '',
            bio: r.bio || '',
            role: r.role || 'member',
            joinedAt: r.joined_at
        }));

        const myRole = members.find(m => m.username.toLowerCase() === cleanUser)?.role || 'member';

        return {
            authorized: true,
            id: group.id,
            name: group.name,
            description: group.description || '',
            avatarUrl: group.avatar_url || '',
            avatarColor: group.avatar_color || '#10b981',
            createdBy: group.created_by,
            createdAt: group.created_at,
            myRole,
            members
        };
    } catch (err) {
        console.error("Error fetching group details:", err);
        return null;
    }
}

async function addGroupMember(groupId, newUsername, addedByUsername) {
    if (!groupId || !newUsername || !addedByUsername) return { success: false, error: "Missing parameters" };
    const cleanAddedBy = addedByUsername.trim().toLowerCase();
    const cleanNew = newUsername.trim().toLowerCase();
    try {
        const adminRs = await db.execute({
            sql: `SELECT role FROM group_members WHERE group_id = ? AND username = ? COLLATE NOCASE LIMIT 1`,
            args: [groupId, cleanAddedBy]
        });
        if (adminRs.rows.length === 0 || adminRs.rows[0].role !== 'admin') {
            return { success: false, error: "Only group admins can add new members." };
        }

        const id = `grm_${Date.now()}_${crypto.randomBytes(3).toString("hex")}`;
        await db.execute({
            sql: `
                INSERT OR IGNORE INTO group_members (id, group_id, username, role, joined_at)
                VALUES (?, ?, ?, 'member', ?)
            `,
            args: [id, groupId, cleanNew, Date.now()]
        });

        return { success: true };
    } catch (err) {
        console.error("Error adding group member:", err);
        return { success: false, error: err.message };
    }
}

async function removeGroupMember(groupId, targetUsername, requestedByUsername) {
    if (!groupId || !targetUsername || !requestedByUsername) return { success: false, error: "Missing parameters" };
    const cleanTarget = targetUsername.trim().toLowerCase();
    const cleanReq = requestedByUsername.trim().toLowerCase();
    try {
        if (cleanTarget !== cleanReq) {
            const adminRs = await db.execute({
                sql: `SELECT role FROM group_members WHERE group_id = ? AND username = ? COLLATE NOCASE LIMIT 1`,
                args: [groupId, cleanReq]
            });
            if (adminRs.rows.length === 0 || adminRs.rows[0].role !== 'admin') {
                return { success: false, error: "Only group admins can remove other members." };
            }
        }

        await db.execute({
            sql: `DELETE FROM group_members WHERE group_id = ? AND username = ? COLLATE NOCASE`,
            args: [groupId, cleanTarget]
        });

        return { success: true, isSelf: cleanTarget === cleanReq };
    } catch (err) {
        console.error("Error removing group member:", err);
        return { success: false, error: err.message };
    }
}

async function updateGroupDetails(groupId, { name, description, avatarUrl, avatarColor }, requestedByUsername) {
    if (!groupId || !requestedByUsername) return { success: false, error: "Missing parameters" };
    const cleanReq = requestedByUsername.trim().toLowerCase();
    try {
        const adminRs = await db.execute({
            sql: `SELECT role FROM group_members WHERE group_id = ? AND username = ? COLLATE NOCASE LIMIT 1`,
            args: [groupId, cleanReq]
        });
        if (adminRs.rows.length === 0 || adminRs.rows[0].role !== 'admin') {
            return { success: false, error: "Only group admins can update group details." };
        }

        const updates = [];
        const args = [];
        if (name !== undefined && name.trim()) {
            updates.push(`name = ?`);
            args.push(name.trim());
        }
        if (description !== undefined) {
            updates.push(`description = ?`);
            args.push(description.trim());
        }
        if (avatarUrl !== undefined) {
            updates.push(`avatar_url = ?`);
            args.push(avatarUrl);
        }
        if (avatarColor !== undefined) {
            updates.push(`avatar_color = ?`);
            args.push(avatarColor);
        }

        if (updates.length > 0) {
            args.push(groupId);
            await db.execute({
                sql: `UPDATE groups SET ${updates.join(', ')} WHERE id = ?`,
                args
            });
        }

        const updatedDetails = await getGroupDetails(groupId, cleanReq);
        return { success: true, group: updatedDetails };
    } catch (err) {
        console.error("Error updating group details:", err);
        return { success: false, error: err.message };
    }
}

async function getGroupHistory(groupId, limit = 100, forUsername = null) {
    if (!groupId) return [];
    try {
        if (forUsername) {
            const isMember = await isGroupMember(groupId, forUsername);
            if (!isMember) return [];
        }

        const clearedAt = forUsername ? getChatClearedAt(forUsername, groupId) : 0;
        const rs = await db.execute({
            sql: `
                SELECT m.*, u.avatar_url AS current_sender_avatar, u.avatar_color AS current_sender_color 
                FROM messages m
                LEFT JOIN users u ON LOWER(u.username) = LOWER(m.sender_username)
                WHERE m.group_id = ?
                  AND (? = 0 OR COALESCE(m.created_at, 0) > ?)
                ORDER BY m.created_at ASC 
                LIMIT ?
            `,
            args: [groupId, clearedAt, clearedAt, limit]
        });
        return rs.rows.map(mapRowToMessage);
    } catch (err) {
        console.error("Error getting group history from SQLite/Turso:", err);
        return [];
    }
}

module.exports = {
    saveMessage,
    deleteMessage,
    editMessage,
    getGeneralHistory,
    getDmHistory,
    clearDmHistory,
    markDmAsRead,
    markDmAsDelivered,
    blockUser,
    unblockUser,
    isUserBlocked,
    getBlockedUsersFor,
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
    getUserById,
    updateUserProfile,
    saveAiResult,
    getAiUsage,
    incrementAiUsage,
    saveAiFeedback,
    getRecentConversationMessages,
    saveStatus,
    getActiveStatuses,
    deleteStatus,
    setChatCleared,
    getChatClearedAt,
    createGroup,
    isGroupMember,
    getUserGroups,
    getGroupDetails,
    addGroupMember,
    removeGroupMember,
    updateGroupDetails,
    getGroupHistory
};
