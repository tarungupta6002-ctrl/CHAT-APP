import React, { useState, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';

export default function NewChatModal({ isOpen, onClose }) {
    const { allRegisteredUsers, onlineUsers, currentUser, startChatWithUser } = useSocket();
    const [search, setSearch] = useState('');

    const contactList = useMemo(() => {
        const myName = currentUser.username.toLowerCase();
        // Combine registered users and any active online users
        const map = new Map();

        allRegisteredUsers.forEach((u) => {
            if (u.username.toLowerCase() !== myName) {
                map.set(u.username.toLowerCase(), {
                    id: u.id,
                    username: u.username,
                    color: u.color || '#00a884',
                    isOnline: false
                });
            }
        });

        onlineUsers.forEach((u) => {
            if (u.username.toLowerCase() !== myName) {
                const existing = map.get(u.username.toLowerCase()) || {};
                map.set(u.username.toLowerCase(), {
                    ...existing,
                    id: u.id,
                    username: u.username,
                    color: u.color || existing.color || '#00a884',
                    isOnline: true
                });
            }
        });

        const list = Array.from(map.values());
        const q = search.trim().toLowerCase();
        if (!q) return list;
        return list.filter((c) => c.username.toLowerCase().includes(q));
    }, [allRegisteredUsers, onlineUsers, currentUser, search]);

    if (!isOpen) return null;

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="new-chat-card" onClick={(e) => e.stopPropagation()}>
                <div className="new-chat-header">
                    <h3>New Chat</h3>
                    <button type="button" className="close-sidebar-btn" onClick={onClose}>✕</button>
                </div>

                <div className="sidebar-search-box" style={{ margin: '0.75rem 0' }}>
                    <input
                        type="text"
                        placeholder="Search contact name..."
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        autoFocus
                    />
                </div>

                <div className="new-chat-list">
                    {contactList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                            No other registered contacts found yet.
                        </div>
                    ) : (
                        contactList.map((contact) => (
                            <div
                                key={contact.username}
                                className="user-item"
                                onClick={() => {
                                    startChatWithUser(contact);
                                    onClose();
                                }}
                            >
                                <div className="user-item-left">
                                    <div className="user-avatar-wrap">
                                        <div
                                            className="user-avatar-sm"
                                            style={{ backgroundColor: contact.color }}
                                        >
                                            {contact.username.slice(0, 2).toUpperCase()}
                                        </div>
                                        {contact.isOnline && <span className="online-status-dot"></span>}
                                    </div>
                                    <div className="user-item-info">
                                        <span className="user-item-name">{contact.username}</span>
                                        <span className="user-item-status">
                                            {contact.isOnline ? 'Online now' : 'Registered contact'}
                                        </span>
                                    </div>
                                </div>
                                <span className="dm-action-hint">Chat 💬</span>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
