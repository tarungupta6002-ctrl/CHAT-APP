import React, { useState, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';

export default function UsersSidebar() {
    const {
        sidebarOpen,
        setSidebarOpen,
        onlineUsers,
        onlineCount,
        currentUser,
        socket,
        openDmWithUser
    } = useSocket();

    const [searchQuery, setSearchQuery] = useState('');

    const filteredUsers = useMemo(() => {
        let list = onlineUsers;
        if ((!list || list.length === 0) && currentUser.username) {
            list = [{
                id: socket?.id || 'me',
                username: currentUser.username,
                color: currentUser.color || '#6366f1'
            }];
        }

        const q = searchQuery.trim().toLowerCase();
        if (!q) return list;
        return list.filter((u) => u.username.toLowerCase().includes(q));
    }, [onlineUsers, currentUser, socket, searchQuery]);

    if (!sidebarOpen) return null;

    return (
        <aside className={`users-sidebar ${sidebarOpen ? 'mobile-open' : ''}`}>
            <div className="sidebar-header">
                <div className="sidebar-title">
                    <h3>Online Members</h3>
                    <span className="member-count-badge">{onlineCount}</span>
                </div>
                <button
                    type="button"
                    className="close-sidebar-btn"
                    title="Close Members Panel"
                    onClick={() => setSidebarOpen(false)}
                >
                    ✕
                </button>
            </div>

            <div className="sidebar-search-box">
                <input
                    type="text"
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    autoComplete="off"
                    autoFocus
                />
            </div>

            <div className="users-list">
                {filteredUsers.length === 0 ? (
                    <div style={{ padding: '1rem', color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>
                        No members found
                    </div>
                ) : (
                    filteredUsers.map((u) => {
                        const isMe = u.id === socket?.id || u.id === 'me';
                        const initials = u.username ? u.username.slice(0, 2).toUpperCase() : '?';

                        return (
                            <div
                                key={u.id}
                                className={`user-item ${isMe ? 'is-me' : ''}`}
                                onClick={() => openDmWithUser(u)}
                            >
                                <div className="user-item-left">
                                    <div className="user-avatar-wrap">
                                        <div
                                            className="user-avatar-sm"
                                            style={{ backgroundColor: u.color || '#6366f1' }}
                                        >
                                            {initials}
                                        </div>
                                        <span className="online-status-dot"></span>
                                    </div>
                                    <div className="user-item-info">
                                        <span className="user-item-name">
                                            {u.username}
                                            {isMe && <span className="you-tag">You</span>}
                                        </span>
                                        <span className="user-item-status">Active now</span>
                                    </div>
                                </div>
                                <span className="dm-action-hint">
                                    {isMe ? 'Notes 📝' : 'Chat 💬'}
                                </span>
                            </div>
                        );
                    })
                )}
            </div>
        </aside>
    );
}
