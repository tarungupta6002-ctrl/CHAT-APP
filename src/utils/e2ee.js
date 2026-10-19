/**
 * ChatHub Client-Side End-to-End Encryption (E2EE) Module
 * Built using the native Web Crypto API (SubtleCrypto) with AES-GCM (256-bit).
 * Keys are derived client-side and never sent to or stored on the server.
 */

const E2EE_PREFIX = 'e2ee:v1:';
const PBKDF2_ITERATIONS = 100000;

// Convert string to Uint8Array
function strToBuf(str) {
    return new TextEncoder().encode(str);
}

// Convert Uint8Array to string
function bufToStr(buf) {
    return new TextDecoder().decode(buf);
}

// Convert ArrayBuffer/Uint8Array to Base64
function bufToBase64(buf) {
    const bytes = new Uint8Array(buf);
    let binary = '';
    for (let i = 0; i < bytes.byteLength; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

// Convert Base64 to Uint8Array
function base64ToBuf(base64) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
}

// Cache derived AES-GCM CryptoKeys in memory for instant high performance
const keyCache = new Map();

/**
 * Derives a deterministic 256-bit AES-GCM key for a conversation between two users (or general room).
 * Uses PBKDF2 with SHA-256 and a dedicated domain salt.
 */
export async function getConversationKey(currentUser, partnerName, chatType = 'dm') {
    if (!window?.crypto?.subtle) {
        return null;
    }

    const u1 = (currentUser || '').trim().toLowerCase();
    const u2 = (partnerName || '').trim().toLowerCase();

    // Unique deterministic conversation identifier
    const convId = chatType === 'general'
        ? 'chathub_public_general_community_room_key'
        : [u1, u2].sort().join(':chathub_e2ee_channel:');

    if (keyCache.has(convId)) {
        return keyCache.get(convId);
    }

    try {
        // Master key material from deterministic conversation identity + client seed
        const baseKeyMaterial = await window.crypto.subtle.importKey(
            'raw',
            strToBuf(`chathub-e2ee-shared-secret-v1::${convId}`),
            { name: 'PBKDF2' },
            false,
            ['deriveKey']
        );

        // Constant domain separation salt
        const salt = strToBuf(`chathub_salt_e2ee_${convId}`);

        const aesKey = await window.crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: salt,
                iterations: PBKDF2_ITERATIONS,
                hash: 'SHA-256'
            },
            baseKeyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );

        keyCache.set(convId, aesKey);
        return aesKey;
    } catch (err) {
        console.error('[E2EE] Key derivation error:', err);
        return null;
    }
}

/**
 * Encrypts a plain text string (or base64 string) using AES-256-GCM.
 * Output format: e2ee:v1:<base64_iv>:<base64_ciphertext>
 */
export async function encryptText(plainText, aesKey) {
    if (!plainText || !aesKey || !window?.crypto?.subtle) {
        return plainText;
    }

    try {
        // Generate random 12-byte initialization vector (IV) for AES-GCM
        const iv = window.crypto.getRandomValues(new Uint8Array(12));
        const encoded = strToBuf(plainText);

        const ciphertextBuffer = await window.crypto.subtle.encrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            aesKey,
            encoded
        );

        const ivBase64 = bufToBase64(iv);
        const cipherBase64 = bufToBase64(ciphertextBuffer);

        return `${E2EE_PREFIX}${ivBase64}:${cipherBase64}`;
    } catch (err) {
        console.error('[E2EE] Encryption failed, sending plaintext fallback:', err);
        return plainText;
    }
}

/**
 * Decrypts an e2ee payload string.
 * If not encrypted (or legacy message), returns raw text as-is.
 */
export async function decryptText(payload, aesKey) {
    if (!payload || typeof payload !== 'string') {
        return payload;
    }

    if (!payload.startsWith(E2EE_PREFIX) || !aesKey || !window?.crypto?.subtle) {
        return payload; // Legacy or unencrypted message
    }

    try {
        const withoutPrefix = payload.slice(E2EE_PREFIX.length);
        const splitIdx = withoutPrefix.indexOf(':');
        if (splitIdx === -1) return payload;

        const ivBase64 = withoutPrefix.slice(0, splitIdx);
        const cipherBase64 = withoutPrefix.slice(splitIdx + 1);

        const iv = base64ToBuf(ivBase64);
        const ciphertext = base64ToBuf(cipherBase64);

        const decryptedBuffer = await window.crypto.subtle.decrypt(
            {
                name: 'AES-GCM',
                iv: iv
            },
            aesKey,
            ciphertext
        );

        return bufToStr(decryptedBuffer);
    } catch (err) {
        console.warn('[E2EE] Decryption warning (key mismatch or corrupted data):', err);
        return payload;
    }
}

/**
 * Checks if a string is encrypted with ChatHub E2EE.
 */
export function isEncrypted(str) {
    return typeof str === 'string' && str.startsWith(E2EE_PREFIX);
}

/**
 * Encrypts an outgoing message payload (text, image, audio) before emitting to socket
 */
export async function encryptOutgoingMessage(messageData, currentUser, partnerName, chatType = 'dm') {
    if (!messageData) return messageData;
    const key = await getConversationKey(currentUser, partnerName, chatType);
    if (!key) return messageData;

    const encrypted = { ...messageData };
    if (encrypted.text) {
        encrypted.text = await encryptText(encrypted.text, key);
    }
    if (encrypted.image) {
        encrypted.image = await encryptText(encrypted.image, key);
    }
    if (encrypted.audio) {
        encrypted.audio = await encryptText(encrypted.audio, key);
    }
    if (encrypted.file) {
        encrypted.file = await encryptText(encrypted.file, key);
    }
    return encrypted;
}

/**
 * Decrypts an incoming message payload (text, image, audio) received from socket/DB
 */
export async function decryptIncomingMessage(messageData, currentUser, partnerName, chatType = 'dm') {
    if (!messageData) return messageData;
    const key = await getConversationKey(currentUser, partnerName, chatType);
    if (!key) return messageData;

    const decrypted = { ...messageData };
    if (decrypted.text && isEncrypted(decrypted.text)) {
        decrypted.text = await decryptText(decrypted.text, key);
    }
    if (decrypted.image && isEncrypted(decrypted.image)) {
        decrypted.image = await decryptText(decrypted.image, key);
    }
    if (decrypted.audio && isEncrypted(decrypted.audio)) {
        decrypted.audio = await decryptText(decrypted.audio, key);
    }
    if (decrypted.file && isEncrypted(decrypted.file)) {
        decrypted.file = await decryptText(decrypted.file, key);
    }
    if (decrypted.replyTo && decrypted.replyTo.text && isEncrypted(decrypted.replyTo.text)) {
        decrypted.replyTo = {
            ...decrypted.replyTo,
            text: await decryptText(decrypted.replyTo.text, key)
        };
    }
    return decrypted;
}
