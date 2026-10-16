import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext';

const SocketContext = createContext(null);

export const EMOJI_LIST = ["😀", "😂", "😍", "🥳", "😎", "🤔", "🙌", "👍", "🔥", "❤️", "✨", "🎉", "💯", "🚀", "💡", "👀", "👏", "⚡", "🫡", "🤝", "💪"];
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉"];

export function SocketProvider({ children }) {
    const { user: authUser, isAuthenticated } = useAuth();
    const socketRef = useRef(null);

    // Connected user profile
    const [currentUser, setCurrentUser] = useState(() => authUser || { id: null, username: '', color: '#00a884' });
    const [isJoined, setIsJoined] = useState(false);

    useEffect(() => {
        if (authUser) {
            setCurrentUser(authUser);
        }
    }, [authUser]);

    // Online Users (Socket Map)
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [onlineCount, setOnlineCount] = useState(1);

    // Registered DB Contacts
    const [allRegisteredUsers, setAllRegisteredUsers] = useState([]);

    // WhatsApp-Style Active Conversation Selection
    // currentChat: null | { type: 'general' } | { type: 'dm', partnerId, partnerName, partnerColor }
    const [currentChat, setCurrentChat] = useState(null);

    // Active DM tabs & recent chats list
    const [recentChats, setRecentChats] = useState([]);
    
    // In-memory conversation messages: { general: [], [partnerIdOrUsername]: [] }
    const [conversations, setConversations] = useState({ general: [] });
    // Unread counts: { general: 0, [partner]: 0 }
    const [unreadCounts, setUnreadCounts] = useState({ general: 0 });

    // Typing State
    const [typingInfo, setTypingInfo] = useState({ isTyping: false, text: '' });
    const typingTimeoutRef = useRef(null);

    // UI States
    const [isSoundMuted, setIsSoundMuted] = useState(() => localStorage.getItem("chat_sound_muted") === "true");
    const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem("chat_theme") || "dark");
    
    // Action Overlays
    const [replyingTo, setReplyingTo] = useState(null); // { id, username, text }
    const [editingMessage, setEditingMessage] = useState(null); // { id, text }
    const [lightboxData, setLightboxData] = useState(null); // { src, title, isViewOnce, msgId }
    
    // View-Once opened set
    const [openedViewOnceIds, setOpenedViewOnceIds] = useState(new Set());

    // Audio chime player using Web Audio API
    const playChime = useCallback(() => {
        if (isSoundMuted) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const audioCtx = new AudioCtx();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.type = "sine";
            osc.frequency.setValueAtTime(587.33, audioCtx.currentTime); // D5
            osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.08); // A5
            gain.gain.setValueAtTime(0.08, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.12);
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.start();
            osc.stop(audioCtx.currentTime + 0.12);
        } catch (e) {
            // Audio autoplay policy
        }
    }, [isSoundMuted]);

    // Apply Theme to document body
    useEffect(() => {
        if (currentTheme === "light") {
            document.body.classList.add("light-theme");
        } else {
            document.body.classList.remove("light-theme");
        }
        localStorage.setItem("chat_theme", currentTheme);
    }, [currentTheme]);

    // Fetch registered users & recent chats
    const fetchRegisteredData = useCallback(async (username) => {
        try {
            const [uRes, cRes] = await Promise.all([
                fetch('/api/users'),
                fetch(`/api/chats/recent?username=${encodeURIComponent(username)}`)
            ]);
            if (uRes.ok) {
                const uData = await uRes.json();
                setAllRegisteredUsers(uData.users || []);
            }
            if (cRes.ok) {
                const cData = await cRes.json();
                setRecentChats(cData.chats || []);
            }
        } catch (e) {
            console.warn("Failed fetching contacts:", e);
        }
    }, []);

    const refreshUserData = useCallback(() => {
        if (authUser?.username) {
            fetchRegisteredData(authUser.username);
        }
        if (socketRef.current && authUser) {
            socketRef.current.emit("user-update-profile", {
                username: authUser.username,
                color: authUser.color,
                avatarUrl: authUser.avatarUrl || ''
            });
            socketRef.current.emit("get-users");
        }
    }, [authUser, fetchRegisteredData]);

    // Update currentUser when auth changes
    useEffect(() => {
        if (authUser) {
            setCurrentUser(authUser);
            fetchRegisteredData(authUser.username);
            if (socketRef.current) {
                socketRef.current.emit("user-update-profile", {
                    username: authUser.username,
                    color: authUser.color,
                    avatarUrl: authUser.avatarUrl || ''
                });
            }
        }
    }, [authUser, fetchRegisteredData]);

    // Initialize Socket Connection
    useEffect(() => {
        if (!isAuthenticated || !authUser) return;

        const socket = io();
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("[Socket] Connected:", socket.id);
            // Join with user identity
            socket.emit("user-join", {
                username: authUser.username,
                color: authUser.color,
                avatarUrl: authUser.avatarUrl || ''
            });
        });

        socket.on("join-success", (data) => {
            setCurrentUser((prev) => ({ ...prev, ...data }));
            setIsJoined(true);
            socket.emit("get-users");
            fetchRegisteredData(authUser.username);
        });

        socket.on("users-list", (list) => {
            setOnlineUsers(list || []);
        });

        socket.on("users-count", (count) => {
            setOnlineCount(count);
        });

        socket.on("user-status", (statusData) => {
            setConversations((prev) => ({
                ...prev,
                general: [
                    ...(prev.general || []),
                    {
                        type: "status",
                        data: {
                            id: `status-${Date.now()}-${Math.random()}`,
                            ...statusData
                        }
                    }
                ]
            }));
        });

        socket.on("chat-history", ({ type, partnerUsername, messages }) => {
            if (!messages || !Array.isArray(messages)) return;
            const mapped = messages.map((m) => ({ type: "message", data: m }));

            if (type === "general") {
                setConversations((prev) => ({ ...prev, general: mapped }));
            } else if (type === "dm" && partnerUsername) {
                setConversations((prev) => ({
                    ...prev,
                    [partnerUsername.toLowerCase()]: mapped
                }));
            }
        });

        socket.on("message", (msg) => {
            const isSelf = msg.senderUsername === authUser.username || msg.username === authUser.username || msg.senderId === socket.id;

            if (msg.recipientUsername || msg.recipientId) {
                // DM Message
                const partnerName = (msg.username.toLowerCase() === authUser.username.toLowerCase())
                    ? msg.recipientUsername
                    : msg.username;
                const partnerKey = partnerName ? partnerName.toLowerCase() : 'dm';

                setConversations((prev) => {
                    const currentList = prev[partnerKey] || [];
                    if (currentList.some((item) => item.type === "message" && item.data?.id === msg.id)) {
                        return prev;
                    }
                    return {
                        ...prev,
                        [partnerKey]: [...currentList, { type: "message", data: msg }]
                    };
                });

                // Update recent chats list
                setRecentChats((prev) => {
                    const filtered = prev.filter((c) => c.partnerUsername.toLowerCase() !== partnerKey);
                    return [
                        {
                            partnerUsername: partnerName,
                            partnerColor: msg.avatarColor || '#00a884',
                            lastMessage: msg.text || (msg.image ? '📷 Photo' : (msg.audio ? '🎙️ Voice note' : '')),
                            lastTime: msg.time,
                            createdAt: Date.now()
                        },
                        ...filtered
                    ];
                });

                // Update unread if not actively open; if open, mark read immediately
                setCurrentChat((curr) => {
                    if (curr?.type === "dm" && curr.partnerName?.toLowerCase() === partnerKey) {
                        if (!isSelf) {
                            socket.emit("mark-messages-read", { partnerUsername: partnerName });
                        }
                    } else {
                        setUnreadCounts((u) => ({
                            ...u,
                            [partnerKey]: (u[partnerKey] || 0) + 1
                        }));
                        if (!isSelf) playChime();
                    }
                    return curr;
                });
            } else {
                // General Message
                setConversations((prev) => {
                    const currentList = prev.general || [];
                    if (currentList.some((item) => item.type === "message" && item.data?.id === msg.id)) {
                        return prev;
                    }
                    return {
                        ...prev,
                        general: [...currentList, { type: "message", data: msg }]
                    };
                });

                setCurrentChat((curr) => {
                    if (!curr || curr.type !== "general") {
                        setUnreadCounts((u) => ({
                            ...u,
                            general: (u.general || 0) + 1
                        }));
                    }
                    if (!isSelf) playChime();
                    return curr;
                });
            }
        });

        socket.on("message-edited", ({ messageId, newText }) => {
            setConversations((prev) => {
                const updated = { ...prev };
                Object.keys(updated).forEach((key) => {
                    updated[key] = updated[key].map((item) => {
                        if (item.type === "message" && item.data.id === messageId) {
                            return {
                                ...item,
                                data: { ...item.data, text: newText, isEdited: true }
                            };
                        }
                        return item;
                    });
                });
                return updated;
            });
        });

        socket.on("message-deleted", ({ messageId }) => {
            setConversations((prev) => {
                const updated = { ...prev };
                Object.keys(updated).forEach((key) => {
                    updated[key] = updated[key].map((item) => {
                        if (item.type === "message" && item.data.id === messageId) {
                            return {
                                ...item,
                                data: { ...item.data, isDeleted: true, text: "", image: null, audio: null, reactions: {} }
                            };
                        }
                        return item;
                    });
                });
                return updated;
            });
        });

        socket.on("message-reaction-update", ({ messageId, emoji, userId }) => {
            setConversations((prev) => {
                const updated = { ...prev };
                Object.keys(updated).forEach((key) => {
                    updated[key] = updated[key].map((item) => {
                        if (item.type === "message" && item.data.id === messageId) {
                            const curReactions = { ...(item.data.reactions || {}) };
                            const userSet = new Set(curReactions[emoji] || []);
                            if (userSet.has(userId)) {
                                userSet.delete(userId);
                            } else {
                                userSet.add(userId);
                            }
                            if (userSet.size === 0) {
                                delete curReactions[emoji];
                            } else {
                                curReactions[emoji] = Array.from(userSet);
                            }
                            return {
                                ...item,
                                data: { ...item.data, reactions: curReactions }
                            };
                        }
                        return item;
                    });
                });
                return updated;
            });
        });

        socket.on("view-once-status-update", ({ messageId }) => {
            setOpenedViewOnceIds((prev) => new Set(prev).add(messageId));
        });

        socket.on("messages-status-update", ({ partnerUsername, recipientUsername, status }) => {
            const targetKey = (partnerUsername || recipientUsername || '').toLowerCase();
            if (!targetKey) return;

            setConversations((prev) => {
                const msgs = prev[targetKey];
                if (!msgs || !Array.isArray(msgs)) return prev;

                const updatedMsgs = msgs.map((item) => {
                    if (item.type === "message" && item.data) {
                        const isSentByMe = item.data.username?.toLowerCase() === authUser?.username?.toLowerCase();
                        if (isSentByMe) {
                            if (status === 'read') {
                                return { ...item, data: { ...item.data, status: 'read' } };
                            } else if (status === 'delivered' && item.data.status === 'sent') {
                                return { ...item, data: { ...item.data, status: 'delivered' } };
                            }
                        }
                    }
                    return item;
                });

                return {
                    ...prev,
                    [targetKey]: updatedMsgs
                };
            });
        });

        socket.on("user-typing", (data) => {
            setCurrentChat((curr) => {
                if (data.recipientId && curr?.type === "dm" && curr.partnerId === data.id) {
                    setTypingInfo({ isTyping: true, text: `${data.username} is typing...` });
                } else if (!data.recipientId && curr?.type === "general") {
                    setTypingInfo({ isTyping: true, text: `${data.username} is typing...` });
                }
                return curr;
            });
        });

        socket.on("user-stop-typing", () => {
            setTypingInfo({ isTyping: false, text: '' });
        });

        socket.on("blocked-users-list", (list) => {
            if (Array.isArray(list)) {
                const lowerList = list.map((u) => (typeof u === "string" ? u.toLowerCase() : ""));
                setBlockedUsers(lowerList);
                try {
                    localStorage.setItem("chathub_blocked_users", JSON.stringify(lowerList));
                } catch (_) {}
            }
        });

        socket.on("chat-error", ({ message }) => {
            if (message) {
                alert(message);
            }
        });

        socket.on("dm-cleared", ({ partnerUsername }) => {
            if (!partnerUsername) return;
            const key = partnerUsername.toLowerCase();
            setConversations((prev) => ({
                ...prev,
                [key]: []
            }));
        });

        socket.on("dm-deleted", ({ partnerUsername }) => {
            if (!partnerUsername) return;
            const key = partnerUsername.toLowerCase();
            setConversations((prev) => {
                const next = { ...prev };
                delete next[key];
                return next;
            });
            setRecentChats((prev) => prev.filter((c) => (c.partnerUsername || "").toLowerCase() !== key));
        });

        return () => {
            socket.disconnect();
        };
    }, [isAuthenticated, authUser, playChime, fetchRegisteredData]);

    // Send Message
    const sendMessage = useCallback(({ text, image, audio, audioDuration, isViewOnce, replyTo }) => {
        if (!socketRef.current || !currentChat) return;

        // Find recipient socket ID if user is online
        let recipientId = currentChat.partnerId || null;
        if (currentChat.type === "dm" && !recipientId && currentChat.partnerName) {
            const foundOnline = onlineUsers.find(
                (u) => u.username.toLowerCase() === currentChat.partnerName.toLowerCase()
            );
            if (foundOnline) recipientId = foundOnline.id;
        }

        const payload = {
            text: text ? text.trim() : "",
            image: image || null,
            audio: audio || null,
            audioDuration: audioDuration || null,
            isViewOnce: Boolean(isViewOnce),
            replyTo: replyTo || null,
            recipientId: currentChat.type === "dm" ? recipientId : null,
            recipientUsername: currentChat.type === "dm" ? currentChat.partnerName : null
        };

        socketRef.current.emit("user-message", payload);

        if (recipientId) {
            socketRef.current.emit("stop-typing", { recipientId });
        } else {
            socketRef.current.emit("stop-typing", {});
        }

        setReplyingTo(null);
    }, [currentChat, onlineUsers]);

    // Notify Typing
    const notifyTyping = useCallback(() => {
        if (!socketRef.current || !currentChat) return;
        const recipientId = currentChat.type === "dm" ? currentChat.partnerId : null;
        const payload = recipientId ? { recipientId } : {};

        socketRef.current.emit("typing", payload);

        clearTimeout(typingTimeoutRef.current);
        typingTimeoutRef.current = setTimeout(() => {
            socketRef.current?.emit("stop-typing", payload);
        }, 1200);
    }, [currentChat]);

    // Edit Message
    const editMessage = useCallback((messageId, newText) => {
        if (!socketRef.current || !messageId || !newText || !newText.trim()) return;
        const recipientId = currentChat?.type === "dm" ? currentChat.partnerId : null;
        socketRef.current.emit("message-edit", {
            messageId,
            newText: newText.trim(),
            recipientId
        });
    }, [currentChat]);

    // Delete Message
    const deleteMessage = useCallback((messageId) => {
        if (!socketRef.current || !messageId) return;
        const recipientId = currentChat?.type === "dm" ? currentChat.partnerId : null;
        socketRef.current.emit("message-delete", {
            messageId,
            recipientId
        });
    }, [currentChat]);

    // Send Reaction
    const toggleReaction = useCallback((messageId, emoji) => {
        if (!socketRef.current || !messageId || !emoji) return;
        socketRef.current.emit("message-reaction", { messageId, emoji });
    }, []);

    // Open View-Once Image
    const markViewOnceOpened = useCallback((messageId) => {
        if (!socketRef.current || !messageId) return;
        setOpenedViewOnceIds((prev) => new Set(prev).add(messageId));
        socketRef.current.emit("view-once-opened", { messageId });
    }, []);

    // Switch active chat in WhatsApp Web
    const selectChat = useCallback((chatSpec) => {
        if (!chatSpec) {
            setCurrentChat(null);
            setTypingInfo({ isTyping: false, text: '' });
            return;
        }
        setCurrentChat(chatSpec);
        setTypingInfo({ isTyping: false, text: '' });

        if (chatSpec.type === "general") {
            setUnreadCounts((u) => ({ ...u, general: 0 }));
        } else if (chatSpec.type === "dm" && chatSpec.partnerName) {
            const key = chatSpec.partnerName.toLowerCase();
            setUnreadCounts((u) => ({ ...u, [key]: 0 }));
            // Request DM history from backend & mark read
            socketRef.current?.emit("get-dm-history", { partnerUsername: chatSpec.partnerName });
            socketRef.current?.emit("mark-messages-read", { partnerUsername: chatSpec.partnerName });
        }
    }, []);

    // Start or open chat with a user
    const startChatWithUser = useCallback((targetUser) => {
        if (!targetUser) return;
        // Check if online to grab their socket ID
        const onlineEntry = onlineUsers.find(
            (u) => u.username.toLowerCase() === targetUser.username.toLowerCase()
        );

        selectChat({
            type: "dm",
            partnerId: onlineEntry ? onlineEntry.id : targetUser.id,
            partnerName: targetUser.username,
            partnerColor: targetUser.color || '#00a884',
            partnerAvatarUrl: targetUser.avatarUrl || onlineEntry?.avatarUrl || ''
        });
    }, [onlineUsers, selectChat]);

    // Clear messages for a conversation (local state + database)
    const clearConversation = useCallback((chatKey) => {
        if (!chatKey) return;
        const key = chatKey.toLowerCase();
        setConversations((prev) => ({
            ...prev,
            [key]: []
        }));
        if (socketRef.current && key !== "general") {
            socketRef.current.emit("clear-dm-history", { partnerUsername: chatKey });
        }
    }, []);

    // Delete conversation and exit active chat (local state + database)
    const deleteConversation = useCallback((chatKey) => {
        if (!chatKey) return;
        const key = chatKey.toLowerCase();
        setConversations((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
        });
        setRecentChats((prev) => prev.filter((c) => (c.partnerUsername || '').toLowerCase() !== key));
        setCurrentChat((curr) => {
            if (curr && (curr.partnerName || '').toLowerCase() === key) {
                return null;
            }
            return curr;
        });
        if (socketRef.current && key !== "general") {
            socketRef.current.emit("delete-dm-chat", { partnerUsername: chatKey });
        }
    }, []);

    // Block/unblock users (persisted in DB + localStorage)
    const [blockedUsers, setBlockedUsers] = useState(() => {
        try {
            return JSON.parse(localStorage.getItem('chathub_blocked_users') || '[]');
        } catch (_) {
            return [];
        }
    });

    const blockUser = useCallback((username) => {
        if (!username) return;
        const clean = username.toLowerCase();
        setBlockedUsers((prev) => {
            if (prev.includes(clean)) return prev;
            const updated = [...prev, clean];
            try {
                localStorage.setItem('chathub_blocked_users', JSON.stringify(updated));
            } catch (_) {}
            return updated;
        });
        if (socketRef.current) {
            socketRef.current.emit("block-user", { targetUsername: username });
        }
    }, []);

    const unblockUser = useCallback((username) => {
        if (!username) return;
        const clean = username.toLowerCase();
        setBlockedUsers((prev) => {
            const updated = prev.filter((u) => u !== clean);
            try {
                localStorage.setItem('chathub_blocked_users', JSON.stringify(updated));
            } catch (_) {}
            return updated;
        });
        if (socketRef.current) {
            socketRef.current.emit("unblock-user", { targetUsername: username });
        }
    }, []);

    const value = {
        socket: socketRef.current,
        currentUser,
        refreshUserData,
        isJoined,
        onlineUsers,
        onlineCount,
        allRegisteredUsers,
        recentChats,
        currentChat,
        selectChat,
        startChatWithUser,
        conversations,
        unreadCounts,
        typingInfo,
        notifyTyping,
        sendMessage,
        editMessage,
        deleteMessage,
        toggleReaction,
        openedViewOnceIds,
        markViewOnceOpened,
        isSoundMuted,
        setIsSoundMuted,
        currentTheme,
        setCurrentTheme,
        replyingTo,
        setReplyingTo,
        editingMessage,
        setEditingMessage,
        lightboxData,
        setLightboxData,
        clearConversation,
        deleteConversation,
        blockUser,
        unblockUser,
        blockedUsers
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
}

export function useSocket() {
    const ctx = useContext(SocketContext);
    if (!ctx) throw new Error("useSocket must be used within a SocketProvider");
    return ctx;
}
