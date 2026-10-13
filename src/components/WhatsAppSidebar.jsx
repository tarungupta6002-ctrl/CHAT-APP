import React, { useState, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import NewChatModal from './NewChatModal';

export default function WhatsAppSidebar() {
    const {
        currentUser,
        currentChat,
        selectChat,
        recentChats,
        onlineUsers,
        allRegisteredUsers,
        unreadCounts,
        isSoundMuted,
        setIsSoundMuted,
        currentTheme,
        setCurrentTheme
    } = useSocket();

    const { logout, setCurrentView } = useAuth();
    const [searchQuery, setSearchQuery] = useState('');
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'dm'
    const [isNewChatOpen, setIsNewChatOpen] = useState(false);

    // Build the consolidated chat list
    const chatsList = useMemo(() => {
        const myName = currentUser.username.toLowerCase();
        const map = new Map();

        // 1. Add recent chats from database history
        recentChats.forEach((c) => {
            if (c.partnerUsername && c.partnerUsername.toLowerCase() !== myName) {
                map.set(c.partnerUsername.toLowerCase(), {
                    partnerUsername: c.partnerUsername,
                    partnerColor: c.partnerColor || '#00a884',
                    lastMessage: c.lastMessage || '',
                    lastTime: c.lastTime || '',
                    isOnline: false
                });
            }
        });

        // 2. Add any active online users who aren't in recent chats yet
        onlineUsers.forEach((u) => {
            if (u.username && u.username.toLowerCase() !== myName) {
                const existing = map.get(u.username.toLowerCase()) || {
                    partnerUsername: u.username,
                    partnerColor: u.color || '#00a884',
                    lastMessage: 'Online now',
                    lastTime: '',
                    isOnline: true
                };
                existing.isOnline = true;
                existing.partnerColor = u.color || existing.partnerColor;
                map.set(u.username.toLowerCase(), existing);
            }
        });

        // 3. Mark online status
        map.forEach((chat, key) => {
            const isOnline = onlineUsers.some((u) => u.username.toLowerCase() === key);
            chat.isOnline = isOnline;
        });

        let list = Array.from(map.values());

        // Filter by search query
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter((c) => c.partnerUsername.toLowerCase().includes(q));
        }

        // Filter by tab
        if (activeFilter === 'unread') {
            list = list.filter((c) => (unreadCounts[c.partnerUsername.toLowerCase()] || 0) > 0);
        }

        return list;
    }, [recentChats, onlineUsers, currentUser, searchQuery, activeFilter, unreadCounts]);

    const isGeneralSelected = currentChat?.type === 'general';
    const initials = currentUser.username ? currentUser.username.slice(0, 2).toUpperCase() : '?';

    return (
        <aside className="whatsapp-sidebar">
            <NewChatModal isOpen={isNewChatOpen} onClose={() => setIsNewChatOpen(false)} />

            {/* Sidebar Top Header */}
            <div className="whatsapp-sidebar-header">
                <div className="sidebar-profile-info">
                    <div
                        className="user-avatar-circle"
                        style={{ backgroundColor: currentUser.color || '#00a884' }}
                    >
                        {initials}
                    </div>
                    <span className="sidebar-username">{currentUser.username}</span>
                </div>

                <div className="sidebar-header-actions">
                    <button
                        type="button"
                        className="sidebar-action-btn"
                        title="Start New Chat"
                        onClick={() => setIsNewChatOpen(true)}
                    >
                        💬 New
                    </button>
                    <button
                        type="button"
                        className="sidebar-action-btn"
                        title="Toggle Sound"
                        onClick={() => setIsSoundMuted(!isSoundMuted)}
                    >
                        {isSoundMuted ? '🔕' : '🔔'}
                    </button>
                    <button
                        type="button"
                        className="sidebar-action-btn"
                        title="Toggle Theme"
                        onClick={() => setCurrentTheme(currentTheme === 'light' ? 'dark' : 'light')}
                    >
                        {currentTheme === 'light' ? '☀️' : '🌓'}
                    </button>
                    <button
                        type="button"
                        className="sidebar-action-btn"
                        title="Website Home"
                        onClick={() => setCurrentView('landing')}
                    >
                        🏠
                    </button>
                    <button
                        type="button"
                        className="sidebar-action-btn logout"
                        title="Log Out"
                        onClick={logout}
                    >
                        🚪
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="whatsapp-search-wrap">
                <div className="whatsapp-search-inner">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
                    </svg>
                    <input
                        type="text"
                        placeholder="Search or start new chat..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* Chat Filter Chips */}
            <div className="whatsapp-filter-chips">
                <button
                    type="button"
                    className={`filter-chip ${activeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('all')}
                >
                    All
                </button>
                <button
                    type="button"
                    className={`filter-chip ${activeFilter === 'unread' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('unread')}
                >
                    Unread
                </button>
                <button
                    type="button"
                    className={`filter-chip ${activeFilter === 'dm' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('dm')}
                >
                    Direct
                </button>
            </div>

            {/* Chats List */}
            <div className="whatsapp-chats-scroll">
                {/* General Room Item */}
                {activeFilter !== 'dm' && (
                    <div
                        className={`whatsapp-chat-item ${isGeneralSelected ? 'active' : ''}`}
                        onClick={() => selectChat({ type: 'general' })}
                    >
                        <div className="chat-avatar-wrap">
                            <div className="chat-avatar general-hash">#</div>
                        </div>
                        <div className="chat-item-body">
                            <div className="chat-item-top">
                                <span className="chat-title">General Room</span>
                                <span className="chat-time">Public</span>
                            </div>
                            <div className="chat-item-bottom">
                                <span className="chat-snippet">Open community conversation</span>
                                {unreadCounts.general > 0 && (
                                    <span className="unread-pill">{unreadCounts.general}</span>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Individual Contacts / DMs */}
                {chatsList.length === 0 ? (
                    <div className="empty-chats-hint">
                        <p>No chats found.</p>
                        <button
                            type="button"
                            className="btn-primary"
                            style={{ width: 'auto', padding: '0.4rem 1rem', fontSize: '0.85rem' }}
                            onClick={() => setIsNewChatOpen(true)}
                        >
                            + Start New Chat
                        </button>
                    </div>
                ) : (
                    chatsList.map((chat) => {
                        const key = chat.partnerUsername.toLowerCase();
                        const isSelected = currentChat?.type === 'dm' && currentChat.partnerName?.toLowerCase() === key;
                        const unread = unreadCounts[key] || 0;
                        const chatInitials = chat.partnerUsername.slice(0, 2).toUpperCase();

                        return (
                            <div
                                key={key}
                                className={`whatsapp-chat-item ${isSelected ? 'active' : ''}`}
                                onClick={() => selectChat({
                                    type: 'dm',
                                    partnerName: chat.partnerUsername,
                                    partnerColor: chat.partnerColor
                                })}
                            >
                                <div className="chat-avatar-wrap">
                                    <div
                                        className="chat-avatar"
                                        style={{ backgroundColor: chat.partnerColor }}
                                    >
                                        {chatInitials}
                                    </div>
                                    {chat.isOnline && <span className="online-indicator-dot"></span>}
                                </div>
                                <div className="chat-item-body">
                                    <div className="chat-item-top">
                                        <span className="chat-title">{chat.partnerUsername}</span>
                                        <span className="chat-time">{chat.lastTime || (chat.isOnline ? 'Online' : '')}</span>
                                    </div>
                                    <div className="chat-item-bottom">
                                        <span className="chat-snippet">{chat.lastMessage || 'Tap to chat'}</span>
                                        {unread > 0 && (
                                            <span className="unread-pill">{unread}</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </aside>
    );
}
