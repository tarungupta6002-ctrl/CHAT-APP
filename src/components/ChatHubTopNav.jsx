import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';

export default function ChatHubTopNav({ searchQuery, setSearchQuery, onNewChat, onOpenProfile }) {
    const { currentUser, selectChat, onlineCount, conversations } = useSocket();
    const searchInputRef = useRef(null);
    const notifWrapperRef = useRef(null);

    // Notification dropdown state
    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [notifFilter, setNotifFilter] = useState('all'); // 'all' | 'unread'
    const [clearedNotifs, setClearedNotifs] = useState(false);
    const [readNotifIds, setReadNotifIds] = useState(() => new Set());

    // Dynamically derive real notifications from incoming messages in conversations
    const notifications = useMemo(() => {
        if (clearedNotifs) return [];
        const myName = currentUser?.username?.toLowerCase() || '';
        const list = [];

        // Scan conversations for messages sent by other users
        Object.entries(conversations || {}).forEach(([chatKey, msgs]) => {
            if (!Array.isArray(msgs)) return;
            msgs.forEach((m) => {
                const mData = m.data || m;
                const senderName = mData.username;
                if (!senderName || senderName.toLowerCase() === myName) return;

                const msgId = String(mData.id || `${chatKey}-${mData.time || Math.random()}`);
                const text = mData.text || (mData.image ? '📷 Photo' : (mData.audio ? '🎙️ Voice note' : 'New message'));
                const time = mData.time || 'Recent';
                const isUnread = !readNotifIds.has(msgId);

                list.push({
                    id: msgId,
                    sender: senderName,
                    color: mData.color || '#10b981',
                    avatar: null,
                    message: text,
                    time: time,
                    unread: isUnread,
                    type: chatKey === 'general' ? 'general' : 'dm'
                });
            });
        });

        // Return latest messages first
        return list.reverse().slice(0, 15);
    }, [conversations, currentUser, clearedNotifs, readNotifIds]);

    // Unread count
    const unreadCount = useMemo(() => {
        return notifications.filter((n) => n.unread).length;
    }, [notifications]);

    // Filtered notifications
    const displayedNotifications = useMemo(() => {
        if (notifFilter === 'unread') {
            return notifications.filter((n) => n.unread);
        }
        return notifications;
    }, [notifications, notifFilter]);

    // Mark single notification as read and open that chat
    const handleNotificationClick = (notif) => {
        setReadNotifIds((prev) => new Set([...prev, notif.id]));
        setIsNotifOpen(false);

        if (notif.type === 'general') {
            selectChat({
                type: 'general',
                partnerName: 'ChatHub Community',
                partnerColor: notif.color || '#2563eb'
            });
        } else {
            selectChat({
                type: 'dm',
                partnerName: notif.sender,
                partnerColor: notif.color || '#10b981'
            });
        }
    };

    // Mark all notifications as read
    const handleMarkAllAsRead = (e) => {
        e.stopPropagation();
        const allIds = notifications.map((n) => n.id);
        setReadNotifIds((prev) => new Set([...prev, ...allIds]));
    };

    // Clear all notifications
    const handleClearAll = (e) => {
        e.stopPropagation();
        setClearedNotifs(true);
    };

    // Close notification panel on click outside or Escape
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (notifWrapperRef.current && !notifWrapperRef.current.contains(e.target)) {
                setIsNotifOpen(false);
            }
        };

        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
            if (e.key === 'Escape' && isNotifOpen) {
                setIsNotifOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [isNotifOpen]);

    // Dynamic User Name & Initials
    const displayName = currentUser?.fullName || currentUser?.username || 'User';
    const initials = displayName
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase() || 'U';

    return (
        <header className="chathub-dashboard-header">
            {/* Left: ChatHub Logo + Compose Box Icon */}
            <div className="dash-brand-area">
                <div className="dash-brand-logo">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 2C6.477 2 2 6.145 2 11.259c0 2.92 1.472 5.534 3.785 7.214L4.85 22.1a.75.75 0 0 0 1.05.86l4.285-1.897c.587.13 1.194.196 1.815.196 5.523 0 10-4.145 10-9.259S17.523 2 12 2zm-3.5 10.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm3.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm3.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
                    </svg>
                </div>
                <span className="dash-brand-title">ChatHub</span>

                {/* Compose / New Chat Icon Box next to Brand Name */}
                <button
                    type="button"
                    className="brand-compose-btn"
                    title="Start New Conversation"
                    onClick={onNewChat}
                >
                    <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M11 4H4a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />
                        <path d="M14.5 2.5a2.121 2.121 0 0 1 3 3L10 13l-4 1 1-4 7.5-7.5z" />
                    </svg>
                </button>
            </div>

            {/* Center: Global Search Bar */}
            <div className="dash-search-container">
                <div className="dash-search-box">
                    <svg className="search-icon-svg" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                    </svg>
                    <input
                        ref={searchInputRef}
                        type="text"
                        placeholder="Search conversations, people, or groups..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                    <kbd className="search-kbd-badge">Ctrl K</kbd>
                </div>
            </div>

            {/* Right: Notification Dropdown & Profile Chip (Calling icons removed) */}
            <div className="dash-header-controls">
                {/* Notification Bell with Dropdown Panel */}
                <div className="dash-notif-wrapper" ref={notifWrapperRef}>
                    <button
                        type="button"
                        className={`dash-icon-btn notification-btn ${isNotifOpen ? 'active' : ''}`}
                        title="Notifications"
                        onClick={() => setIsNotifOpen((prev) => !prev)}
                        aria-expanded={isNotifOpen}
                    >
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                        </svg>
                        {unreadCount > 0 && (
                            <span className="notif-count-badge">{unreadCount}</span>
                        )}
                    </button>

                    {/* Notification Dropdown Panel */}
                    {isNotifOpen && (
                        <div className="dash-notif-dropdown">
                            {/* Panel Header */}
                            <div className="notif-dropdown-header">
                                <div className="notif-header-title-row">
                                    <div className="notif-title-group">
                                        <h3 className="notif-panel-title">Notifications</h3>
                                        {unreadCount > 0 && (
                                            <span className="notif-unread-pill">{unreadCount} unread</span>
                                        )}
                                    </div>
                                    <div className="notif-header-actions">
                                        {unreadCount > 0 && (
                                            <button
                                                type="button"
                                                className="notif-action-text-btn"
                                                onClick={handleMarkAllAsRead}
                                            >
                                                Mark all read
                                            </button>
                                        )}
                                        {notifications.length > 0 && (
                                            <button
                                                type="button"
                                                className="notif-action-text-btn danger"
                                                onClick={handleClearAll}
                                            >
                                                Clear
                                            </button>
                                        )}
                                    </div>
                                </div>

                                {/* Filter Tabs */}
                                <div className="notif-filter-tabs">
                                    <button
                                        type="button"
                                        className={`notif-tab ${notifFilter === 'all' ? 'active' : ''}`}
                                        onClick={() => setNotifFilter('all')}
                                    >
                                        All ({notifications.length})
                                    </button>
                                    <button
                                        type="button"
                                        className={`notif-tab ${notifFilter === 'unread' ? 'active' : ''}`}
                                        onClick={() => setNotifFilter('unread')}
                                    >
                                        Unread ({unreadCount})
                                    </button>
                                </div>
                            </div>

                            {/* Notifications List */}
                            <div className="notif-dropdown-body">
                                {displayedNotifications.length === 0 ? (
                                    <div className="notif-empty-state">
                                        <div className="notif-empty-icon">
                                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                                                <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                                            </svg>
                                        </div>
                                        <p className="notif-empty-text">No notifications found</p>
                                        <span className="notif-empty-sub">You're all caught up with your messages!</span>
                                    </div>
                                ) : (
                                    displayedNotifications.map((notif) => (
                                        <div
                                            key={notif.id}
                                            className={`notif-item-card ${notif.unread ? 'is-unread' : ''}`}
                                            onClick={() => handleNotificationClick(notif)}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <div className="notif-item-avatar-wrap">
                                                {notif.avatar ? (
                                                    <img
                                                        src={notif.avatar}
                                                        alt={notif.sender}
                                                        className="notif-item-avatar-img"
                                                    />
                                                ) : (
                                                    <div
                                                        className="notif-item-avatar-fallback"
                                                        style={{ backgroundColor: notif.color || '#10b981' }}
                                                    >
                                                        {notif.sender.charAt(0).toUpperCase()}
                                                    </div>
                                                )}
                                                {notif.unread && <span className="notif-unread-dot"></span>}
                                            </div>

                                            <div className="notif-item-content">
                                                <div className="notif-item-top">
                                                    <span className="notif-sender-name">{notif.sender}</span>
                                                    <span className="notif-item-time">{notif.time}</span>
                                                </div>
                                                <p className="notif-item-message">{notif.message}</p>
                                                <div className="notif-item-tag">
                                                    {notif.type === 'general' ? 'Community' : 'Direct Message'}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Dropdown Footer */}
                            <div className="notif-dropdown-footer">
                                <span className="notif-footer-hint">Click any message to open chat</span>
                                <button
                                    type="button"
                                    className="notif-footer-close-btn"
                                    onClick={() => setIsNotifOpen(false)}
                                >
                                    Close
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* Logged in User Avatar Profile Chip */}
                <div
                    className="dash-user-chip"
                    onClick={onOpenProfile}
                    role="button"
                    tabIndex={0}
                    title={`${displayName} (Online)`}
                >
                    <div
                        className="dash-avatar-circle"
                        style={{ backgroundColor: currentUser?.color || '#2563eb' }}
                    >
                        {currentUser?.avatarUrl ? (
                            <img src={currentUser.avatarUrl} alt={displayName} className="dash-avatar-img" />
                        ) : (
                            initials
                        )}
                    </div>
                    <span className="avatar-online-dot"></span>
                </div>
            </div>
        </header>
    );
}
