import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
    Search, 
    SquarePen, 
    User, 
    Settings, 
    LogOut, 
    Sun, 
    Moon, 
    Users, 
    MessageSquare,
    Check,
    CheckCheck
} from 'lucide-react';

export default function WhatsAppSidebar({ onNewChat, onOpenProfile, onOpenSettings }) {
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
    
    const { logout } = useAuth();
    const { theme, toggleTheme, isDark } = useTheme();

    const [searchQuery, setSearchQuery] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'unread' | 'groups'
    const menuRef = useRef(null);

    // Close menu on click outside or escape
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setIsMenuOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') setIsMenuOpen(false);
        };
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const displayName = currentUser?.fullName || currentUser?.username || 'User';
    const initials = displayName.slice(0, 2).toUpperCase();

    // Compute Base Chats (ChatHub Community + all real direct messages)
    const chatList = useMemo(() => {
        const myName = currentUser?.username ? currentUser.username.toLowerCase() : '';
        const map = new Map();

        // 1. ChatHub Community general room (Always first)
        const communityUnread = unreadCounts['general'] || 0;
        const generalMsgs = conversations?.general || [];
        const lastGenMsg = generalMsgs.length > 0 ? generalMsgs[generalMsgs.length - 1] : null;

        map.set('general', {
            id: 'general',
            type: 'general',
            partnerName: 'ChatHub Community',
            partnerColor: '#2563eb',
            lastMessage: lastGenMsg 
                ? `${lastGenMsg.data?.username || lastGenMsg.username || 'User'}: ${lastGenMsg.data?.text || lastGenMsg.text || (lastGenMsg.data?.image ? 'Photo' : 'Voice note')}` 
                : 'Welcome to ChatHub Community!',
            lastTime: lastGenMsg ? (lastGenMsg.data?.time || lastGenMsg.time) : '',
            unread: communityUnread,
            isOnline: true,
            isGroup: true
        });

        // 2. Add recent DM chats from database history
        (recentChats || []).forEach((c) => {
            const uname = c.partnerUsername || c.username;
            if (uname && uname.toLowerCase() !== myName) {
                const unread = unreadCounts[uname.toLowerCase()] || 0;
                const reg = (allRegisteredUsers || []).find((u) => u.username?.toLowerCase() === uname.toLowerCase());
                const onl = (onlineUsers || []).find((u) => u.username?.toLowerCase() === uname.toLowerCase());
                map.set(uname.toLowerCase(), {
                    id: `dm-${uname.toLowerCase()}`,
                    type: 'dm',
                    partnerName: uname,
                    partnerColor: c.partnerColor || reg?.color || c.color || '#10b981',
                    partnerAvatarUrl: c.partnerAvatarUrl || reg?.avatarUrl || onl?.avatarUrl || '',
                    lastMessage: c.lastMessage || 'Connected',
                    lastTime: c.lastTime || '',
                    unread: unread,
                    isOnline: false,
                    isGroup: false
                });
            }
        });

        // 3. In-memory conversations for active DMs
        Object.entries(conversations || {}).forEach(([chatKey, msgs]) => {
            if (chatKey === 'general' || !Array.isArray(msgs) || msgs.length === 0) return;
            const uname = chatKey;
            if (uname.toLowerCase() !== myName) {
                const lastMsg = msgs[msgs.length - 1];
                const text = lastMsg.data?.text || lastMsg.text || (lastMsg.data?.image ? 'Photo' : 'Voice note');
                const time = lastMsg.data?.time || lastMsg.time || '';
                const unread = unreadCounts[uname.toLowerCase()] || 0;
                const reg = (allRegisteredUsers || []).find((u) => u.username?.toLowerCase() === uname.toLowerCase());
                const onl = (onlineUsers || []).find((u) => u.username?.toLowerCase() === uname.toLowerCase());

                const existing = map.get(uname.toLowerCase());
                if (existing) {
                    existing.lastMessage = text;
                    existing.lastTime = time;
                    existing.unread = unread;
                    if (!existing.partnerAvatarUrl) {
                        existing.partnerAvatarUrl = reg?.avatarUrl || onl?.avatarUrl || '';
                    }
                } else {
                    map.set(uname.toLowerCase(), {
                        id: `dm-${uname.toLowerCase()}`,
                        type: 'dm',
                        partnerName: uname,
                        partnerColor: reg?.color || '#10b981',
                        partnerAvatarUrl: reg?.avatarUrl || onl?.avatarUrl || '',
                        lastMessage: text,
                        lastTime: time,
                        unread: unread,
                        isOnline: false,
                        isGroup: false
                    });
                }
            }
        });

        // 4. Mark online status for live socket users
        map.forEach((item, key) => {
            if (key !== 'general') {
                const isLive = (onlineUsers || []).some((u) => u.username?.toLowerCase() === key);
                item.isOnline = isLive;
            }
        });

        let list = Array.from(map.values());

        // Apply Search query
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase().trim();
            list = list.filter((c) => 
                c.partnerName.toLowerCase().includes(q) || 
                (c.lastMessage && c.lastMessage.toLowerCase().includes(q))
            );
        }

        // Apply category filter
        if (activeFilter === 'unread') {
            list = list.filter((c) => c.unread > 0);
        } else if (activeFilter === 'groups') {
            list = list.filter((c) => c.isGroup);
        }

        return list;
    }, [recentChats, conversations, onlineUsers, currentUser, unreadCounts, allRegisteredUsers, searchQuery, activeFilter]);

    // Handle selecting a chat
    const handleSelectChat = (chat) => {
        if (chat.type === 'general') {
            selectChat({
                type: 'general',
                partnerName: 'ChatHub Community',
                partnerColor: '#2563eb'
            });
        } else {
            selectChat({
                type: 'dm',
                partnerName: chat.partnerName,
                partnerColor: chat.partnerColor,
                partnerAvatarUrl: chat.partnerAvatarUrl || ''
            });
        }
    };

    return (
        <aside className="wa-sidebar">
            {/* 1. Header: Profile + Name (Left) & New Chat Icon (Right) */}
            <header className="wa-sidebar-header">
                {/* Profile Trigger (Opens Dropdown Menu) */}
                <div 
                    className="wa-profile-trigger" 
                    ref={menuRef}
                    onClick={() => setIsMenuOpen((prev) => !prev)}
                    role="button"
                    tabIndex={0}
                    title="User Profile & Settings"
                >
                    <div 
                        className="wa-user-avatar"
                        style={{ backgroundColor: currentUser?.color || '#00a884' }}
                    >
                        {currentUser?.avatarUrl ? (
                            <img src={currentUser.avatarUrl} alt={displayName} className="wa-avatar-img" />
                        ) : (
                            initials
                        )}
                    </div>
                    <span className="wa-user-name">{displayName}</span>

                    {/* Native Profile & Settings Dropdown Menu */}
                    {isMenuOpen && (
                        <div className="wa-profile-dropdown" onClick={(e) => e.stopPropagation()}>
                            <div className="wa-dropdown-user-info">
                                <span className="wa-dropdown-full-name">{displayName}</span>
                                <span className="wa-dropdown-user-handle">@{currentUser?.username || 'user'}</span>
                            </div>

                            <div className="wa-dropdown-divider" />

                            <button 
                                type="button" 
                                className="wa-dropdown-item"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    onOpenProfile && onOpenProfile();
                                }}
                            >
                                <User size={16} />
                                <span>My Profile</span>
                            </button>

                            <button 
                                type="button" 
                                className="wa-dropdown-item"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    onOpenSettings && onOpenSettings();
                                }}
                            >
                                <Settings size={16} />
                                <span>Settings</span>
                            </button>

                            <button 
                                type="button" 
                                className="wa-dropdown-item"
                                onClick={() => {
                                    toggleTheme();
                                }}
                            >
                                {isDark ? <Sun size={16} /> : <Moon size={16} />}
                                <span>Appearance: {isDark ? 'Dark Mode' : 'Light Mode'}</span>
                            </button>

                            <div className="wa-dropdown-divider" />

                            <button 
                                type="button" 
                                className="wa-dropdown-item danger"
                                onClick={() => {
                                    setIsMenuOpen(false);
                                    if (window.confirm("Are you sure you want to log out of ChatHub?")) {
                                        logout();
                                    }
                                }}
                            >
                                <LogOut size={16} />
                                <span>Log Out</span>
                            </button>
                        </div>
                    )}
                </div>

                {/* Right Action: New Chat Flat Icon */}
                <div className="wa-sidebar-actions">
                    <button 
                        type="button" 
                        className="wa-icon-btn"
                        title="New Chat"
                        onClick={onNewChat}
                        aria-label="New Chat"
                    >
                        <SquarePen size={19} />
                    </button>
                </div>
            </header>

            {/* 2. Search Bar */}
            <div className="wa-search-section">
                <div className="wa-search-box">
                    <Search size={16} className="wa-search-icon" />
                    <input 
                        type="text" 
                        placeholder="Search conversations..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {/* 3. Subtle Filter Pills (All, Unread, Groups) */}
            <div className="wa-filter-row">
                <button 
                    type="button"
                    className={`wa-filter-pill ${activeFilter === 'all' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('all')}
                >
                    All
                </button>
                <button 
                    type="button"
                    className={`wa-filter-pill ${activeFilter === 'unread' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('unread')}
                >
                    Unread
                </button>
                <button 
                    type="button"
                    className={`wa-filter-pill ${activeFilter === 'groups' ? 'active' : ''}`}
                    onClick={() => setActiveFilter('groups')}
                >
                    Groups
                </button>
            </div>

            {/* 4. Chat List */}
            <div className="wa-chat-list">
                {chatList.length === 0 ? (
                    <div className="wa-chat-list-empty">
                        <MessageSquare size={32} />
                        <p>No conversations found</p>
                        <span>Start a new chat using the icon above</span>
                    </div>
                ) : (
                    chatList.map((chat) => {
                        const isCurrentActive = currentChat && (
                            (chat.type === 'general' && currentChat.type === 'general') ||
                            (chat.type === 'dm' && currentChat.type === 'dm' && currentChat.partnerName?.toLowerCase() === chat.partnerName?.toLowerCase())
                        );

                        return (
                            <div 
                                key={chat.id}
                                className={`wa-chat-item ${isCurrentActive ? 'active' : ''}`}
                                onClick={() => handleSelectChat(chat)}
                                role="button"
                                tabIndex={0}
                            >
                                <div className="wa-item-avatar-wrapper">
                                    <div 
                                        className="wa-item-avatar"
                                        style={{ backgroundColor: chat.partnerColor || '#00a884', overflow: 'hidden' }}
                                    >
                                        {chat.isGroup ? (
                                            <img src="/chathub-logo.png" alt="ChatHub" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                        ) : chat.partnerAvatarUrl ? (
                                            <img 
                                                src={chat.partnerAvatarUrl} 
                                                alt={chat.partnerName} 
                                                style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                                onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                        ) : (
                                            chat.partnerName.slice(0, 2).toUpperCase()
                                        )}
                                    </div>
                                    {chat.isOnline && !chat.isGroup && (
                                        <span className="wa-online-indicator" title="Online" />
                                    )}
                                </div>

                                <div className="wa-item-info">
                                    <div className="wa-item-top-row">
                                        <span className="wa-item-title">{chat.partnerName}</span>
                                        {chat.unread > 0 && (
                                            <span className="wa-unread-badge">{chat.unread}</span>
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
