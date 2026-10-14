import React, { useState, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';

export default function ChatHubLeftSidebar({ searchQuery, onNewChat, activeCategory, setActiveCategory }) {
    const {
        currentUser,
        currentChat,
        selectChat,
        recentChats,
        onlineUsers,
        allRegisteredUsers,
        unreadCounts
    } = useSocket();

    // Default reference contacts list matching the screenshot
    const fallbackSeedChats = useMemo(() => [
        {
            partnerUsername: 'Priya Sharma',
            avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=150&q=80',
            partnerColor: '#10b981',
            lastMessage: 'Hey! Are you free for a call?',
            lastTime: '10:24 AM',
            unread: 2,
            isOnline: true,
            isGroup: false
        },
        {
            partnerUsername: 'Rahul Verma',
            avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=150&q=80',
            partnerColor: '#3b82f6',
            lastMessage: "Okay, I'll join in 5 mins",
            lastTime: '09:18 AM',
            unread: 1,
            isOnline: true,
            isGroup: false
        },
        {
            partnerUsername: 'Study Group',
            partnerColor: '#2563eb',
            lastMessage: 'Aman: Shared a file',
            lastTime: 'Yesterday',
            unread: 0,
            isOnline: false,
            isGroup: true
        },
        {
            partnerUsername: 'Sneha Kapoor',
            avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=150&q=80',
            partnerColor: '#ec4899',
            lastMessage: "Let's catch up later 😊",
            lastTime: 'Yesterday',
            unread: 0,
            isOnline: false,
            isGroup: false
        },
        {
            partnerUsername: 'Project Team',
            partnerColor: '#8b5cf6',
            lastMessage: 'You: Updated the document',
            lastTime: 'Mon',
            unread: 0,
            isOnline: false,
            isGroup: true
        },
        {
            partnerUsername: 'Aman Gupta',
            avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=150&q=80',
            partnerColor: '#059669',
            lastMessage: 'Thanks!',
            lastTime: 'Mon',
            unread: 0,
            isOnline: false,
            isGroup: false
        },
        {
            partnerUsername: 'College Friends',
            avatar: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=150&q=80',
            partnerColor: '#f59e0b',
            lastMessage: 'Riya: 📷 Photo',
            lastTime: 'Sun',
            unread: 0,
            isOnline: false,
            isGroup: true
        }
    ], []);

    // Consolidated real & active conversations
    const displayChats = useMemo(() => {
        const myName = currentUser?.username ? currentUser.username.toLowerCase() : '';
        const map = new Map();

        // 1. Add real recent chats from DB
        recentChats.forEach((c) => {
            if (c.partnerUsername && c.partnerUsername.toLowerCase() !== myName) {
                map.set(c.partnerUsername.toLowerCase(), {
                    partnerUsername: c.partnerUsername,
                    partnerColor: c.partnerColor || '#10b981',
                    lastMessage: c.lastMessage || 'Connected',
                    lastTime: c.lastTime || '',
                    unread: unreadCounts[c.partnerUsername.toLowerCase()] || 0,
                    isOnline: false,
                    isGroup: false
                });
            }
        });

        // 2. Add real online users
        onlineUsers.forEach((u) => {
            if (u.username && u.username.toLowerCase() !== myName) {
                const existing = map.get(u.username.toLowerCase()) || {
                    partnerUsername: u.username,
                    partnerColor: u.color || '#10b981',
                    lastMessage: 'Online now',
                    lastTime: '',
                    unread: 0,
                    isOnline: true,
                    isGroup: false
                };
                existing.isOnline = true;
                existing.partnerColor = u.color || existing.partnerColor;
                map.set(u.username.toLowerCase(), existing);
            }
        });

        // 3. Complement with reference design chats
        fallbackSeedChats.forEach((seed) => {
            if (!map.has(seed.partnerUsername.toLowerCase()) && seed.partnerUsername.toLowerCase() !== myName) {
                map.set(seed.partnerUsername.toLowerCase(), seed);
            }
        });

        // 4. Update online status with live sockets
        map.forEach((item, key) => {
            const hasSocket = onlineUsers.some((u) => u.username.toLowerCase() === key);
            if (hasSocket) item.isOnline = true;
        });

        let list = Array.from(map.values());

        // Category Filter
        if (activeCategory === 'unread') {
            list = list.filter((c) => (c.unread || 0) > 0 || (unreadCounts[c.partnerUsername.toLowerCase()] || 0) > 0);
        } else if (activeCategory === 'groups') {
            list = list.filter((c) => c.isGroup);
        } else if (activeCategory === 'contacts') {
            list = list.filter((c) => !c.isGroup);
        }

        // Search Filter
        const q = searchQuery.trim().toLowerCase();
        if (q) {
            list = list.filter((c) =>
                c.partnerUsername.toLowerCase().includes(q) ||
                (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
            );
        }

        return list;
    }, [recentChats, onlineUsers, currentUser, searchQuery, activeCategory, unreadCounts, fallbackSeedChats]);

    const totalUnreadCount = 2;

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
                <button
                    type="button"
                    className={`nav-category-item ${activeCategory === 'all' ? 'active' : ''}`}
                    onClick={() => {
                        setActiveCategory('all');
                        selectChat(null);
                    }}
                >
                    <div className="cat-item-left">
                        <svg className="cat-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                        </svg>
                        <span>All Chats</span>
                    </div>
                    <span className="cat-badge-pill green">8</span>
                </button>

                <button
                    type="button"
                    className={`nav-category-item ${activeCategory === 'unread' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('unread')}
                >
                    <div className="cat-item-left">
                        <svg className="cat-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 5a2 2 0 012-2h7a2 2 0 012 2v4a2 2 0 01-2 2H9l-3 3v-3H4a2 2 0 01-2-2V5z" />
                            <path d="M15 7v2a4 4 0 01-4 4H9.828l-1.766 1.767c.28.149.599.233.938.233h2l3 3v-3h2a2 2 0 002-2V9a2 2 0 00-2-2h-1z" />
                        </svg>
                        <span>Unread</span>
                    </div>
                    <span className="cat-badge-pill green">{totalUnreadCount}</span>
                </button>

                <button
                    type="button"
                    className={`nav-category-item ${activeCategory === 'groups' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('groups')}
                >
                    <div className="cat-item-left">
                        <svg className="cat-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                        <span>Groups</span>
                    </div>
                </button>

                <button
                    type="button"
                    className={`nav-category-item ${activeCategory === 'contacts' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('contacts')}
                >
                    <div className="cat-item-left">
                        <svg className="cat-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                        </svg>
                        <span>Contacts</span>
                    </div>
                </button>

                <button
                    type="button"
                    className={`nav-category-item ${activeCategory === 'starred' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('starred')}
                >
                    <div className="cat-item-left">
                        <svg className="cat-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                        </svg>
                        <span>Starred</span>
                    </div>
                </button>

                <button
                    type="button"
                    className={`nav-category-item ${activeCategory === 'archived' ? 'active' : ''}`}
                    onClick={() => setActiveCategory('archived')}
                >
                    <div className="cat-item-left">
                        <svg className="cat-svg-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M4 3a2 2 0 100 4h12a2 2 0 100-4H4z" />
                            <path fillRule="evenodd" d="M3 8h14v7a2 2 0 01-2 2H5a2 2 0 01-2-2V8zm5 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" clipRule="evenodd" />
                        </svg>
                        <span>Archived</span>
                    </div>
                </button>
            </nav>

            {/* Recent Chats Section Header */}
            <div className="sidebar-section-divider">
                <div className="section-divider-title">
                    <svg className="section-search-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                    <span>Recent Chats</span>
                </div>
                <button
                    type="button"
                    className="filter-toggle-icon-btn"
                    title="Filter / Sort Chats"
                    onClick={() => setActiveCategory(activeCategory === 'unread' ? 'all' : 'unread')}
                >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 6.707A1 1 0 013 6V3z" clipRule="evenodd" />
                    </svg>
                </button>
            </div>

            {/* Recent Conversations List */}
            <div className="sidebar-recent-chats-list">
                {displayChats.map((chat) => {
                    const isSelected = currentChat?.partnerName?.toLowerCase() === chat.partnerUsername.toLowerCase();
                    const initials = chat.partnerUsername.slice(0, 2).toUpperCase();

                    return (
                        <div
                            key={chat.partnerUsername}
                            className={`dash-chat-item ${isSelected ? 'active' : ''}`}
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
                                {chat.avatar ? (
                                    <img
                                        src={chat.avatar}
                                        alt={chat.partnerUsername}
                                        className="chat-item-avatar-img"
                                        onError={(e) => {
                                            e.target.style.display = 'none';
                                        }}
                                    />
                                ) : (
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
                                )}
                                {chat.isOnline && <span className="online-badge-dot"></span>}
                            </div>

                            {/* Info */}
                            <div className="chat-item-body">
                                <div className="chat-item-row-top">
                                    <h4 className="chat-item-name">{chat.partnerUsername}</h4>
                                    <span className="chat-item-time">{chat.lastTime || 'Just now'}</span>
                                </div>
                                <div className="chat-item-row-bottom">
                                    <p className="chat-item-msg">{chat.lastMessage}</p>
                                    {chat.unread > 0 && (
                                        <span className="chat-unread-count-pill">{chat.unread}</span>
                                    )}
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
        </aside>
    );
}
