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
        try { await db.execute(`ALTER TABLE users ADD COLUMN avatar_url TEXT;`); } catch (_) {}

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

        await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_messages_recipient ON messages(recipient_username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_call_logs_caller ON call_logs(caller_username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_call_logs_receiver ON call_logs(receiver_username);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_otps_email ON otps(email);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_ai_results_user ON ai_results(user_id);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_ai_results_conv ON ai_results(conversation_id);`);
        await db.execute(`CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ai_usage(user_id, period_start);`);
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
    getUserById,
    updateUserProfile,
    saveAiResult,
    getAiUsage,
    incrementAiUsage,
    saveAiFeedback,
    getRecentConversationMessages
};
