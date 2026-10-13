import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';

const SocketContext = createContext(null);

export const EMOJI_LIST = ["😀", "😂", "😍", "🥳", "😎", "🤔", "🙌", "👍", "🔥", "❤️", "✨", "🎉", "💯", "🚀", "💡", "👀", "👏", "⚡", "🫡", "🤝", "💪"];
export const QUICK_REACTIONS = ["👍", "❤️", "😂", "🔥", "🎉"];

export function SocketProvider({ children }) {
    const socketRef = useRef(null);

    // User State
    const [currentUser, setCurrentUser] = useState(() => {
        const savedName = sessionStorage.getItem("chat_username") || "";
        return { id: null, username: savedName, color: "#6366f1" };
    });
    const [isJoined, setIsJoined] = useState(false);

    // Online Users
    const [onlineUsers, setOnlineUsers] = useState([]);
    const [onlineCount, setOnlineCount] = useState(1);

    // Conversation State
    // currentChat: { type: 'general' } or { type: 'dm', partnerId, partnerName, partnerColor }
    const [currentChat, setCurrentChat] = useState({ type: 'general' });
    const [activeDmPartners, setActiveDmPartners] = useState([]);
    
    // In-memory conversation messages: { general: [], [partnerId]: [] }
    const [conversations, setConversations] = useState({ general: [] });
    // Unread counts: { general: 0, [partnerId]: 0 }
    const [unreadCounts, setUnreadCounts] = useState({ general: 0 });

    // Typing State
    const [typingInfo, setTypingInfo] = useState({ isTyping: false, text: '' });
    const typingTimeoutRef = useRef(null);

    // UI States
    const [isSoundMuted, setIsSoundMuted] = useState(() => localStorage.getItem("chat_sound_muted") === "true");
    const [currentTheme, setCurrentTheme] = useState(() => localStorage.getItem("chat_theme") || "dark");
    const [sidebarOpen, setSidebarOpen] = useState(false);
    
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

    // Apply sound mute setting
    useEffect(() => {
        localStorage.setItem("chat_sound_muted", isSoundMuted ? "true" : "false");
    }, [isSoundMuted]);

    // Initialize Socket
    useEffect(() => {
        const socket = io();
        socketRef.current = socket;

        socket.on("connect", () => {
            console.log("[Socket] Connected with ID:", socket.id);
        });

        socket.on("join-success", (data) => {
            setCurrentUser(data);
            setIsJoined(true);
            sessionStorage.setItem("chat_username", data.username);
            socket.emit("get-users");
        });

        socket.on("users-list", (list) => {
            setOnlineUsers(list || []);
        });

        socket.on("users-count", (count) => {
            setOnlineCount(count);
        });

        socket.on("user-status", (statusData) => {
            // Add system status message to general room
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
                // Find matching active DM partner
                setActiveDmPartners((prevPartners) => {
                    const match = prevPartners.find((p) => p.username === partnerUsername);
                    if (match) {
                        setConversations((prevConvs) => ({
                            ...prevConvs,
                            [match.id]: mapped
                        }));
                    }
                    return prevPartners;
                });
            }
        });

        socket.on("message", (msg) => {
            const isSelf = msg.senderId === socket.id;

            // Determine if message belongs to General or a DM
            if (msg.recipientId) {
                // DM Message
                const partnerId = isSelf ? msg.recipientId : msg.senderId;
                const partnerName = isSelf ? "Chat Partner" : msg.username;
                const partnerColor = msg.avatarColor || "#6366f1";

                // Ensure partner exists in activeDmPartners
                setActiveDmPartners((prev) => {
                    if (!prev.some((p) => p.id === partnerId)) {
                        return [...prev, { id: partnerId, username: partnerName, color: partnerColor }];
                    }
                    return prev;
                });

                // Append to conversations
                setConversations((prev) => ({
                    ...prev,
                    [partnerId]: [...(prev[partnerId] || []), { type: "message", data: msg }]
                }));

                // Update unread if not currently in this chat
                setCurrentChat((curr) => {
                    if (curr.type !== "dm" || curr.partnerId !== partnerId) {
                        setUnreadCounts((u) => ({
                            ...u,
                            [partnerId]: (u[partnerId] || 0) + 1
                        }));
                        if (!isSelf) playChime();
                    }
                    return curr;
                });
            } else {
                // General Message
                setConversations((prev) => ({
                    ...prev,
                    general: [...(prev.general || []), { type: "message", data: msg }]
                }));

                setCurrentChat((curr) => {
                    if (curr.type !== "general") {
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

        socket.on("user-typing", (data) => {
            setCurrentChat((curr) => {
                if (data.recipientId) {
                    if (curr.type === "dm" && curr.partnerId === data.id) {
                        setTypingInfo({ isTyping: true, text: `${data.username} is typing privately...` });
                    }
                } else {
                    if (curr.type === "general") {
                        setTypingInfo({ isTyping: true, text: `${data.username} is typing...` });
                    }
                }
                return curr;
            });
        });

        socket.on("user-stop-typing", () => {
            setTypingInfo({ isTyping: false, text: '' });
        });

        return () => {
            socket.disconnect();
        };
    }, [playChime]);

    // Send Join Request
    const joinChat = useCallback((username) => {
        if (!username || !username.trim()) return;
        const clean = username.trim().slice(0, 20);
        socketRef.current?.emit("user-join", clean);
    }, []);

    // Send Message
    const sendMessage = useCallback(({ text, image, audio, audioDuration, isViewOnce, replyTo }) => {
        if (!socketRef.current) return;

        const recipientId = currentChat.type === "dm" ? currentChat.partnerId : null;
        const payload = {
            text: text ? text.trim() : "",
            image: image || null,
            audio: audio || null,
            audioDuration: audioDuration || null,
            isViewOnce: Boolean(isViewOnce),
            replyTo: replyTo || null,
            recipientId: recipientId
        };

        socketRef.current.emit("user-message", payload);

        // Stop typing immediately
        const stopTypingPayload = recipientId ? { recipientId } : {};
        socketRef.current.emit("stop-typing", stopTypingPayload);

        setReplyingTo(null);
    }, [currentChat]);

    // Notify Typing
    const notifyTyping = useCallback(() => {
        if (!socketRef.current) return;
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
        const recipientId = currentChat.type === "dm" ? currentChat.partnerId : null;
        socketRef.current.emit("message-edit", {
            messageId,
            newText: newText.trim(),
            recipientId
        });
    }, [currentChat]);

    // Delete Message
    const deleteMessage = useCallback((messageId) => {
        if (!socketRef.current || !messageId) return;
        const recipientId = currentChat.type === "dm" ? currentChat.partnerId : null;
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

    // Switch Tab & Clear unreads
    const switchChat = useCallback((chatSpec) => {
        setCurrentChat(chatSpec);
        setTypingInfo({ isTyping: false, text: '' });

        if (chatSpec.type === "general") {
            setUnreadCounts((u) => ({ ...u, general: 0 }));
        } else if (chatSpec.type === "dm" && chatSpec.partnerId) {
            setUnreadCounts((u) => ({ ...u, [chatSpec.partnerId]: 0 }));
            // Request DM history from backend
            if (chatSpec.partnerName) {
                socketRef.current?.emit("get-dm-history", { partnerUsername: chatSpec.partnerName });
            }
        }
    }, []);

    // Open or switch to DM with specific user
    const openDmWithUser = useCallback((user) => {
        if (!user) return;
        const isMe = user.id === socketRef.current?.id || user.id === "me";
        const targetId = isMe ? socketRef.current?.id : user.id;
        const displayName = isMe ? `${user.username} (Notes)` : user.username;
        const dmPartner = { id: targetId, username: displayName, color: user.color || "#6366f1" };

        setActiveDmPartners((prev) => {
            if (!prev.some((p) => p.id === targetId)) {
                return [...prev, dmPartner];
            }
            return prev;
        });

        switchChat({
            type: "dm",
            partnerId: targetId,
            partnerName: displayName,
            partnerColor: user.color || "#6366f1"
        });
        setSidebarOpen(false);
    }, [switchChat]);

    // Close a DM tab
    const closeDmTab = useCallback((partnerId, e) => {
        if (e) e.stopPropagation();
        setActiveDmPartners((prev) => prev.filter((p) => p.id !== partnerId));
        if (currentChat.type === "dm" && currentChat.partnerId === partnerId) {
            switchChat({ type: "general" });
        }
    }, [currentChat, switchChat]);

    const value = {
        socket: socketRef.current,
        currentUser,
        isJoined,
        joinChat,
        onlineUsers,
        onlineCount,
        currentChat,
        switchChat,
        activeDmPartners,
        openDmWithUser,
        closeDmTab,
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
        sidebarOpen,
        setSidebarOpen,
        replyingTo,
        setReplyingTo,
        editingMessage,
        setEditingMessage,
        lightboxData,
        setLightboxData
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
