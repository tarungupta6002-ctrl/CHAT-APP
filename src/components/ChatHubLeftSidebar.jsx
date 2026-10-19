import React, { useState, useMemo, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { 
    MessageSquare, 
    Mail, 
    Users, 
    UserCheck, 
    Star, 
    Archive, 
    ArchiveRestore, 
    Inbox,
    Filter,
    Search
} from 'lucide-react';
import VerifiedBadge from './VerifiedBadge';

export default function ChatHubLeftSidebar({ searchQuery, onNewChat, activeCategory, setActiveCategory }) {
    const {
        currentUser,
        currentChat,
        selectChat,
        recentChats,
        onlineUsers,
        allRegisteredUsers,
        unreadCounts,
        conversations
    } = useSocket();

    // 1. WhatsApp-Style Archived Chats (Persisted per user)
    const [archivedUsernames, setArchivedUsernames] = useState(() => {
        try {
            const saved = localStorage.getItem(`chathub_archived_${currentUser?.username || 'guest'}`);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // 2. WhatsApp-Style Starred Chats (Persisted per user)
    const [starredUsernames, setStarredUsernames] = useState(() => {
        try {
            const saved = localStorage.getItem(`chathub_starred_chats_${currentUser?.username || 'guest'}`);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // 3. WhatsApp-Style Starred Messages (Persisted per user)
    const [starredMessages, setStarredMessages] = useState(() => {
        try {
            const saved = localStorage.getItem(`chathub_starred_msgs_${currentUser?.username || 'guest'}`);
            return saved ? JSON.parse(saved) : [];
        } catch {
            return [];
        }
    });

    // Re-sync storage if currentUser changes or window focuses
    useEffect(() => {
        const syncStorage = () => {
            const u = currentUser?.username || 'guest';
            try {
                const a = localStorage.getItem(`chathub_archived_${u}`);
                if (a) setArchivedUsernames(JSON.parse(a));
                const s = localStorage.getItem(`chathub_starred_chats_${u}`);
                if (s) setStarredUsernames(JSON.parse(s));
                const m = localStorage.getItem(`chathub_starred_msgs_${u}`);
                if (m) setStarredMessages(JSON.parse(m));
            } catch {}
        };
        syncStorage();
        window.addEventListener('storage', syncStorage);
        return () => window.removeEventListener('storage', syncStorage);
    }, [currentUser]);

    // Archive / Unarchive handler
    const toggleArchiveChat = (partnerName, e) => {
        e?.stopPropagation();
        const key = partnerName.toLowerCase();
        setArchivedUsernames((prev) => {
            const next = prev.includes(key) ? prev.filter((u) => u !== key) : [...prev, key];
            localStorage.setItem(
                `chathub_archived_${currentUser?.username || 'guest'}`,
                JSON.stringify(next)
            );
            return next;
        });
    };

    // Star / Unstar Chat handler
    const toggleStarChat = (partnerName, e) => {
        e?.stopPropagation();
        const key = partnerName.toLowerCase();
        setStarredUsernames((prev) => {
            const next = prev.includes(key) ? prev.filter((u) => u !== key) : [...prev, key];
            localStorage.setItem(
                `chathub_starred_chats_${currentUser?.username || 'guest'}`,
                JSON.stringify(next)
            );
            return next;
        });
    };

    // Unstar individual message
    const removeStarredMessage = (msgId, e) => {
        e?.stopPropagation();
        setStarredMessages((prev) => {
            const next = prev.filter((m) => m.id !== msgId);
            localStorage.setItem(
                `chathub_starred_msgs_${currentUser?.username || 'guest'}`,
                JSON.stringify(next)
            );
            return next;
        });
    };

    // Real Conversations Map (No dummy data)
    const { baseChats, totalUnread } = useMemo(() => {
        const myName = currentUser?.username ? currentUser.username.toLowerCase() : '';
        const map = new Map();
        let unreadTotal = 0;

        // 1. Add real recent chats from DB history
        (recentChats || []).forEach((c) => {
            const uname = c.partnerUsername || c.username;
            if (uname && uname.toLowerCase() !== myName) {
                const unread = unreadCounts[uname.toLowerCase()] || 0;
                unreadTotal += unread;
                map.set(uname.toLowerCase(), {
                    partnerUsername: uname,
                    fullName: c.fullName || uname,
                    partnerColor: c.partnerColor || c.color || '#10b981',
                    lastMessage: c.lastMessage || 'Connected',
                    lastTime: c.lastTime || '',
                    unread: unread,
                    isOnline: false,
                    isGroup: false
                });
            }
        });

        // 2. Also inspect in-memory conversations for active DMs not in recentChats yet
        Object.entries(conversations || {}).forEach(([chatKey, msgs]) => {
            if (chatKey === 'general' || !Array.isArray(msgs) || msgs.length === 0) return;
            const uname = chatKey;
            if (uname.toLowerCase() !== myName && !map.has(uname.toLowerCase())) {
                const lastMsg = msgs[msgs.length - 1];
                const text = lastMsg.data?.text || lastMsg.text || (lastMsg.data?.file ? ('📄 ' + (lastMsg.data?.fileName || 'Document')) : (lastMsg.data?.image ? '📷 Photo' : 'Voice note'));
                const time = lastMsg.data?.time || lastMsg.time || '';
                const unread = unreadCounts[uname.toLowerCase()] || 0;
                map.set(uname.toLowerCase(), {
                    partnerUsername: uname,
                    fullName: uname,
                    partnerColor: '#10b981',
                    lastMessage: text,
                    lastTime: time,
                    unread: unread,
                    isOnline: false,
                    isGroup: false
                });
            }
        });

        // 3. Mark live online sockets
        map.forEach((item, key) => {
            const isLive = (onlineUsers || []).some((u) => u.username?.toLowerCase() === key);
            if (isLive) item.isOnline = true;
        });

        // 4. Always include official ChatHub Community general room
        const communityUnread = unreadCounts['general'] || 0;
        unreadTotal += communityUnread;
        const generalMsgs = conversations?.general || [];
        const lastGenMsg = generalMsgs.length > 0 ? generalMsgs[generalMsgs.length - 1] : null;

        map.set('general', {
            partnerUsername: 'ChatHub Community',
            fullName: 'ChatHub Community',
            partnerColor: '#2563eb',
            lastMessage: lastGenMsg ? `${lastGenMsg.data?.username || lastGenMsg.username}: ${lastGenMsg.data?.text || lastGenMsg.text || 'Shared a file'}` : 'Global chat room for all members',
            lastTime: lastGenMsg ? (lastGenMsg.data?.time || lastGenMsg.time) : '',
            unread: communityUnread,
            isOnline: true,
            isGroup: true
        });

        return {
            baseChats: Array.from(map.values()),
            totalUnread: unreadTotal
        };
    }, [recentChats, conversations, onlineUsers, currentUser, unreadCounts]);

    // Registered Contacts list (all users excluding current user)
    const contactsList = useMemo(() => {
        const myName = currentUser?.username ? currentUser.username.toLowerCase() : '';
        return (allRegisteredUsers || [])
            .filter((u) => u.username && u.username.toLowerCase() !== myName)
            .map((u) => {
                const isOnline = (onlineUsers || []).some(
                    (o) => o.username?.toLowerCase() === u.username.toLowerCase()
                );
                return {
                    partnerUsername: u.username,
                    fullName: u.fullName || u.username,
                    partnerColor: u.color || '#3b82f6',
                    lastMessage: isOnline ? 'Online now' : 'ChatHub member',
                    lastTime: '',
                    unread: unreadCounts[u.username.toLowerCase()] || 0,
                    isOnline,
                    isGroup: false
                };
            });
    }, [allRegisteredUsers, currentUser, onlineUsers, unreadCounts]);

    // Filtered Display List based on active category
    const displayList = useMemo(() => {
        let list = [];

        if (activeCategory === 'contacts') {
            list = contactsList;
        } else if (activeCategory === 'archived') {
            // WhatsApp style: ONLY archived chats
            list = baseChats.filter((c) =>
                archivedUsernames.includes(c.partnerUsername.toLowerCase())
            );
        } else if (activeCategory === 'starred') {
            // WhatsApp style: Starred chats
            list = baseChats.filter((c) =>
                starredUsernames.includes(c.partnerUsername.toLowerCase())
            );
        } else if (activeCategory === 'unread') {
            // Active chats with unread messages, excluding archived
            list = baseChats.filter(
                (c) =>
                    !archivedUsernames.includes(c.partnerUsername.toLowerCase()) &&
                    (c.unread > 0 || (unreadCounts[c.partnerUsername.toLowerCase()] || 0) > 0)
            );
        } else if (activeCategory === 'groups') {
            list = baseChats.filter((c) => c.isGroup);
        } else {
            // 'all': All active conversations, EXCEPT archived ones!
            list = baseChats.filter(
                (c) => !archivedUsernames.includes(c.partnerUsername.toLowerCase())
            );
        }

        // Search Query filter
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter(
                (c) =>
                    c.partnerUsername.toLowerCase().includes(q) ||
                    (c.fullName && c.fullName.toLowerCase().includes(q)) ||
                    (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
            );
        }

        return list;
    }, [activeCategory, baseChats, contactsList, archivedUsernames, starredUsernames, unreadCounts, searchQuery]);

    // Starred messages filtered by search
    const displayedStarredMessages = useMemo(() => {
        if (activeCategory !== 'starred') return [];
        const q = searchQuery.trim().toLowerCase();
        if (!q) return starredMessages;
        return starredMessages.filter(
            (m) =>
                (m.text && m.text.toLowerCase().includes(q)) ||
                (m.username && m.username.toLowerCase().includes(q))
        );
    }, [activeCategory, starredMessages, searchQuery]);

    // Dynamic Badges
    const allChatsCount = baseChats.filter(
        (c) => !archivedUsernames.includes(c.partnerUsername.toLowerCase())
    ).length;
    const archivedCount = archivedUsernames.length;
    const starredTotalCount = starredUsernames.length + starredMessages.length;

    return (
        <aside className="chathub-dash-left-sidebar">
            {/* Top Primary Action: + New Chat */}
            <div className="sidebar-action-wrap">
                <button
                    type="button"
                    className="chathub-new-chat-btn"
                    onClick={onNewChat}
                >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M10 3a1 1 0 011 1v5h5a1 1 0 110 2h-5v5a1 1 0 11-2 0v-5H4a1 1 0 110-2h5V4a1 1 0 011-1z" clipRule="evenodd" />
                    </svg>
                    <span>New Chat</span>
                </button>
            </div>

            {/* Navigation Categories with Crisp SVG Icons */}
            <nav className="sidebar-nav-categories">
                {/* 1. All Chats */}
                <button
                    type="button"
                    className={`nav-category-item ${activeCategory === 'all' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveCategory('all');
                        selectChat(null);
                    }}
                >
                    <div className="cat-item-left">
                        <MessageSquare size={18} className="cat-svg-icon" />
                        <span>All Chats</span>
                    </div>
                    {allChatsCount > 0 && (
                        <span className="cat-badge-pill green">{allChatsCount}</span>
                    )}
                </button>

                {/* 2. Unread */}
                <button
                    type="button"
                    className={`nav-category-item ${activeCategory === 'unread' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('unread')}
                >
                    <div className="cat-item-left">
                        <Mail size={18} className="cat-svg-icon" />
                        <span>Unread</span>
                    </div>
                    {totalUnread > 0 && (
                        <span className="cat-badge-pill green">{totalUnread}</span>
                    )}
                </button>

                {/* 3. Groups */}
                <button
                    type="button"
                    className={`nav-category-item ${activeCategory === 'groups' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('groups')}
                >
                    <div className="cat-item-left">
                        <Users size={18} className="cat-svg-icon" />
                        <span>Groups</span>
                    </div>
                </button>

                {/* 4. Contacts */}
                <button
                    type="button"
                    className={`nav-category-item ${activeCategory === 'contacts' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('contacts')}
                >
                    <div className="cat-item-left">
                        <UserCheck size={18} className="cat-svg-icon" />
                        <span>Contacts</span>
                    </div>
                    {contactsList.length > 0 && (
                        <span className="cat-badge-pill neutral">{contactsList.length}</span>
                    )}
                </button>

                {/* 5. Starred (WhatsApp style) */}
                <button
                    type="button"
                    className={`nav-category-item ${activeCategory === 'starred' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('starred')}
                >
                    <div className="cat-item-left">
                        <Star size={18} className="cat-svg-icon star-gold" />
                        <span>Starred</span>
                    </div>
                    {starredTotalCount > 0 && (
                        <span className="cat-badge-pill gold">{starredTotalCount}</span>
                    )}
                </button>

                {/* 6. Archived (WhatsApp style) */}
                <button
                    type="button"
                    className={`nav-category-item ${activeCategory === 'archived' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('archived')}
                >
                    <div className="cat-item-left">
                        <Archive size={18} className="cat-svg-icon" />
                        <span>Archived</span>
                    </div>
                    {archivedCount > 0 && (
                        <span className="cat-badge-pill green">{archivedCount}</span>
                    )}
                </button>
            </nav>

            {/* Recent Chats Section Header */}
            <div className="sidebar-section-divider">
                <div className="section-divider-title">
                    <svg className="section-search-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                    <span>
                        {activeCategory === 'archived'
                            ? 'Archived Chats'
                            : activeCategory === 'starred'
                            ? 'Starred Items'
                            : activeCategory === 'contacts'
                            ? 'Registered Contacts'
                            : activeCategory === 'groups'
                            ? 'Group Chats'
                            : 'Recent Chats'}
                    </span>
                </div>
                <button
                    type="button"
                    className="filter-toggle-icon-btn"
                    title="Toggle Unread"
                    onClick={() => setActiveCategory(activeCategory === 'unread' ? 'all' : 'unread')}
                >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            {/* Conversations & Items List */}
            <div className="sidebar-recent-chats-list">
                {/* Special Section: Starred Messages */}
                {activeCategory === 'starred' && displayedStarredMessages.length > 0 && (
                    <div className="sidebar-starred-messages-section">
                        <div className="starred-section-label">⭐ Starred Messages ({displayedStarredMessages.length})</div>
                        {displayedStarredMessages.map((m) => (
                            <div
                                key={m.id}
                                className="sidebar-starred-msg-card"
                                onClick={() => {
                                    if (m.chatType === 'general') {
                                        selectChat({ type: 'general', partnerName: 'ChatHub Community', partnerColor: '#2563eb' });
                                    } else {
                                        selectChat({ type: 'dm', partnerName: m.partnerName || m.username, partnerColor: '#10b981' });
                                    }
                                }}
                            >
                                <div className="starred-msg-card-top">
                                    <span className="starred-msg-sender">{m.username}</span>
                                    <span className="starred-msg-time">{m.time}</span>
                                    <button
                                        type="button"
                                        className="starred-msg-unstar-btn"
                                        title="Unstar Message"
                                        onClick={(e) => removeStarredMessage(m.id, e)}
                                    >
                                        <Star size={15} fill="#f59e0b" color="#f59e0b" />
                                    </button>
                                </div>
                                <p className="starred-msg-snippet">{m.text}</p>
                            </div>
                        ))}
                    </div>
                )}

                {/* Empty State */}
                {displayList.length === 0 && (activeCategory !== 'starred' || displayedStarredMessages.length === 0) ? (
                    <div className="sidebar-empty-state">
                        <div className="empty-state-bubble">
                            {activeCategory === 'archived' ? (
                                <Archive size={26} />
                            ) : activeCategory === 'starred' ? (
                                <Star size={26} color="#f59e0b" />
                            ) : activeCategory === 'unread' ? (
                                <Mail size={26} />
                            ) : activeCategory === 'contacts' ? (
                                <UserCheck size={26} />
                            ) : (
                                <MessageSquare size={26} />
                            )}
                        </div>
                        <h4 className="empty-state-title">
                            {activeCategory === 'archived'
                                ? 'No archived chats'
                                : activeCategory === 'starred'
                                ? 'No starred items'
                                : activeCategory === 'unread'
                                ? 'No unread messages'
                                : activeCategory === 'contacts'
                                ? 'No contacts found'
                                : 'No conversations yet'}
                        </h4>
                        <p className="empty-state-sub">
                            {activeCategory === 'archived'
                                ? 'Hover over any chat and click the archive button to move it here.'
                                : activeCategory === 'starred'
                                ? 'Star messages in chat or star contacts to access them quickly.'
                                : activeCategory === 'contacts'
                                ? 'Ask friends to create an account on ChatHub!'
                                : 'Click "+ New Chat" to start messaging real users.'}
                        </p>
                    </div>
                ) : (
                    displayList.map((chat) => {
                        const isSelected = currentChat?.partnerName?.toLowerCase() === chat.partnerUsername.toLowerCase();
                        const initials = (chat.fullName || chat.partnerUsername).slice(0, 2).toUpperCase();
                        const isArchived = archivedUsernames.includes(chat.partnerUsername.toLowerCase());
                        const isStarred = starredUsernames.includes(chat.partnerUsername.toLowerCase());

                        return (
                            <div
                                key={chat.partnerUsername}
                                className={`dash-chat-item ${isSelected ? 'active' : ''} ${isArchived ? 'is-archived' : ''}`}
                                onClick={() => {
                                    if (chat.isGroup) {
                                        selectChat({ type: 'general', partnerName: chat.partnerUsername, partnerColor: chat.partnerColor });
                                    } else {
                                        selectChat({ type: 'dm', partnerName: chat.partnerUsername, partnerColor: chat.partnerColor });
                                    }
                                }}
                            >
                                {/* Avatar */}
                                <div className="chat-item-avatar-wrap">
                                    <div
                                        className="chat-item-avatar"
                                        style={{ backgroundColor: chat.partnerColor || '#10b981' }}
                                    >
                                        {chat.isGroup ? (
                                            <svg className="chat-group-svg" viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                            </svg>
                                        ) : (
                                            initials
                                        )}
                                    </div>
                                    {chat.isOnline && <span className="online-badge-dot"></span>}
                                </div>

                                {/* Info */}
                                <div className="chat-item-body">
                                    <div className="chat-item-row-top">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '5px', minWidth: 0, overflow: 'hidden' }}>
                                            <h4 className="chat-item-name">{chat.fullName || chat.partnerUsername}</h4>
                                            {chat.isGroup && (
                                                <VerifiedBadge size={14} />
                                            )}
                                        </div>
                                        {chat.unread > 0 && (
                                            <span className="chat-unread-count-pill">{chat.unread}</span>
                                        )}
                                    </div>
                                </div>

                                {/* WhatsApp Style Hover Actions: Star & Archive */}
                                {!chat.isGroup && (
                                    <div className="chat-item-hover-actions">
                                        {/* Star Toggle */}
                                        <button
                                            type="button"
                                            className={`chat-hover-btn star ${isStarred ? 'active' : ''}`}
                                            title={isStarred ? 'Unstar Chat' : 'Star Chat'}
                                            onClick={(e) => toggleStarChat(chat.partnerUsername, e)}
                                        >
                                            {isStarred ? <Star size={15} fill="#f59e0b" color="#f59e0b" /> : <Star size={15} />}
                                        </button>

                                        {/* Archive / Unarchive Toggle */}
                                        <button
                                            type="button"
                                            className="chat-hover-btn archive"
                                            title={isArchived ? 'Unarchive Chat (Move back to All Chats)' : 'Archive Chat'}
                                            onClick={(e) => toggleArchiveChat(chat.partnerUsername, e)}
                                        >
                                            {isArchived ? <ArchiveRestore size={15} /> : <Archive size={15} />}
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })
                )}
            </div>
        </aside>
    );
}
