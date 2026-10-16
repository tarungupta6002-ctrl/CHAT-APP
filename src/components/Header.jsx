import React from 'react';
import { useSocket } from '../context/SocketContext';

export default function Header() {
    const {
        currentUser,
        onlineCount,
        isSoundMuted,
        setIsSoundMuted,
        currentTheme,
        setCurrentTheme,
        sidebarOpen,
        setSidebarOpen
    } = useSocket();

    const initials = currentUser.username ? currentUser.username.slice(0, 2).toUpperCase() : '?';

    const toggleTheme = () => {
        setCurrentTheme((prev) => (prev === 'light' ? 'dark' : 'light'));
    };

    const toggleSound = () => {
        setIsSoundMuted((prev) => !prev);
    };

    return (
        <header className="chat-header">
            <div className="brand-section">
                <button
                    type="button"
                    className="mobile-menu-btn"
                    title="Menu"
                    onClick={() => setSidebarOpen((prev) => !prev)}
                >
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z" />
                    </svg>
                </button>
                <div className="brand-logo" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <img 
                        src="/chathub-logo.png" 
                        alt="ChatHub Logo" 
                        style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'contain' }} 
                    />
                </div>
                <div className="brand-info">
                    <h1>ChatHub</h1>
                    <button
                        type="button"
                        className="online-users-badge-btn"
                        title="View Online Members"
                        onClick={() => setSidebarOpen((prev) => !prev)}
                    >
                        <span className="pulse-dot"></span>
                        <span>{onlineCount} Online</span>
                        <svg className="users-icon" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                        </svg>
                    </button>
                </div>
            </div>

            <div className="header-right-actions">
                <button
                    type="button"
                    className="header-icon-btn"
                    title="Toggle Sound Chime"
                    onClick={toggleSound}
                >
                    {isSoundMuted ? "🔕" : "🔔"}
                </button>
                <button
                    type="button"
                    className="header-icon-btn"
                    title="Toggle Light/Dark Theme"
                    onClick={toggleTheme}
                >
                    {currentTheme === 'light' ? "☀️" : "🌓"}
                </button>
                <div className="user-profile-badge">
                    <div
                        className="user-avatar-circle"
                        style={{ backgroundColor: currentUser.color || "#6366f1" }}
                    >
                        {initials}
                    </div>
                    <span className="user-profile-name">{currentUser.username || "Guest"}</span>
                </div>
            </div>
        </header>
    );
}
