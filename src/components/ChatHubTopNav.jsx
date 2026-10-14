import React, { useRef, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';

export default function ChatHubTopNav({ searchQuery, setSearchQuery, onNewChat, onOpenProfile }) {
    const { currentUser, currentChat, onlineCount } = useSocket();
    const { initiateCall } = useWebRTC();
    const searchInputRef = useRef(null);

    // Ctrl+K / Cmd+K keyboard shortcut to focus search
    useEffect(() => {
        const handleKeyDown = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
                e.preventDefault();
                searchInputRef.current?.focus();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const isDm = currentChat?.type === 'dm';

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

            {/* Right: Quick Call & Notification Controls */}
            <div className="dash-header-controls">
                <button
                    type="button"
                    className="dash-icon-btn"
                    title={isDm ? `Video Call ${currentChat.partnerName}` : "Start Video Call"}
                    onClick={() => {
                        if (isDm) initiateCall(true);
                        else onNewChat();
                    }}
                >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                    </svg>
                </button>

                <button
                    type="button"
                    className="dash-icon-btn"
                    title={isDm ? `Voice Call ${currentChat.partnerName}` : "Start Voice Call"}
                    onClick={() => {
                        if (isDm) initiateCall(false);
                        else onNewChat();
                    }}
                >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                        <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z" />
                    </svg>
                </button>

                <button
                    type="button"
                    className="dash-icon-btn notification-btn"
                    title={`${onlineCount} members active in ChatHub`}
                    onClick={onNewChat}
                >
                    <svg viewBox="0 0 20 20" fill="currentColor">
                        <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                    </svg>
                    <span className="notif-red-badge"></span>
                </button>

                {/* Logged in User Avatar Profile Chip */}
                <div
                    className="dash-user-chip"
                    onClick={onOpenProfile}
                    role="button"
                    tabIndex={0}
                    title="Tarun Gupta (Online)"
                >
                    <div
                        className="dash-avatar-circle"
                        style={{ backgroundColor: currentUser?.color || '#2563eb' }}
                    >
                        TA
                    </div>
                    <span className="avatar-online-dot"></span>
                </div>
            </div>
        </header>
    );
}
