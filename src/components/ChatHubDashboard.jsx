import React, { useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';

export default function ChatHubDashboard({ onNewChat, onOpenGroup, onViewAllContacts, onViewAllGroups }) {
    const { currentUser, selectChat, allRegisteredUsers, onlineUsers } = useSocket();
    const { initiateCall } = useWebRTC();

    // Actual user name
    const username = currentUser?.username || 'User';

    // Recent Contacts (using registered users or real active contacts with reference design defaults)
    const contacts = useMemo(() => {
        const myName = username.toLowerCase();
        const base = [
            { name: 'Priya Sharma', color: '#10b981', isOnline: true },
            { name: 'Rahul Verma', color: '#3b82f6', isOnline: true },
            { name: 'Sneha Kapoor', color: '#ec4899', isOnline: true },
            { name: 'Aman Gupta', color: '#059669', isOnline: true }
        ];

        // If there are other registered users in the database, prioritize them
        const others = allRegisteredUsers.filter((u) => u.username.toLowerCase() !== myName);
        if (others.length > 0) {
            return others.slice(0, 4).map((u) => ({
                name: u.username,
                color: u.color || '#10b981',
                isOnline: onlineUsers.some((o) => o.username.toLowerCase() === u.username.toLowerCase())
            }));
        }
        return base;
    }, [allRegisteredUsers, onlineUsers, username]);

    // Recent Groups list
    const groups = useMemo(() => [
        { name: 'Study Group', members: 12, color: '#2563eb' },
        { name: 'Project Team', members: 8, color: '#8b5cf6' },
        { name: 'College Friends', members: 15, color: '#f59e0b' },
        { name: 'Family', members: 6, color: '#ef4444' }
    ], []);

    return (
        <div className="chathub-central-dashboard">
            {/* 1. WELCOME HERO BANNER */}
            <div className="dash-hero-banner">
                <div className="dash-hero-text">
                    <span className="dash-wave-greet">👋 Welcome back,</span>
                    <h1 className="dash-welcome-username">{username}</h1>
                    <p className="dash-hero-description">
                        Stay connected, collaborate and make meaningful conversations with ChatHub.
                    </p>
                </div>

                {/* 3D Illustration Mockup on Right */}
                <div className="dash-hero-graphic-wrap">
                    {/* Floating Glow Badges */}
                    <div className="floating-hero-pill pill-msg">💬</div>
                    <div className="floating-hero-pill pill-video">📹</div>
                    <div className="floating-hero-pill pill-call">📞</div>
                    <div className="floating-hero-pill pill-photo">🖼️</div>

                    <div className="hero-app-mock-frame">
                        <div className="hero-mock-topbar">
                            <span className="mock-dot red"></span>
                            <span className="mock-dot yellow"></span>
                            <span className="mock-dot green"></span>
                        </div>
                        <div className="hero-mock-chat-area">
                            <div className="hero-mock-sidebar-stub">
                                <div className="stub-line"></div>
                                <div className="stub-line short"></div>
                                <div className="stub-line"></div>
                            </div>
                            <div className="hero-mock-bubbles">
                                <div className="mock-bubble-green"></div>
                                <div className="mock-bubble-white"></div>
                                <div className="mock-bubble-green short"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* 2. 4 CORE FEATURE CARDS */}
            <div className="dash-features-row">
                <div
                    className="dash-feature-card"
                    onClick={onNewChat}
                    role="button"
                    tabIndex={0}
                >
                    <div className="feature-circle-icon green">💬</div>
                    <h3>Instant Messaging</h3>
                    <p>Send and receive messages in real time.</p>
                </div>

                <div
                    className="dash-feature-card"
                    onClick={() => initiateCall(true)}
                    role="button"
                    tabIndex={0}
                >
                    <div className="feature-circle-icon purple">📹</div>
                    <h3>Voice & Video Calls</h3>
                    <p>High quality and reliable calls.</p>
                </div>

                <div
                    className="dash-feature-card"
                    onClick={() => selectChat({ type: 'general', partnerName: 'ChatHub Community', partnerColor: '#2563eb' })}
                    role="button"
                    tabIndex={0}
                >
                    <div className="feature-circle-icon blue">👥</div>
                    <h3>Groups & Communities</h3>
                    <p>Stay connected with your teams.</p>
                </div>

                <div className="dash-feature-card">
                    <div className="feature-circle-icon yellow">🔒</div>
                    <h3>Secure & Private</h3>
                    <p>Your data stays safe with us.</p>
                </div>
            </div>

            {/* 3. RECENT CONTACTS SECTION */}
            <div className="dash-section-wrap">
                <div className="dash-section-header">
                    <h2>Recent Contacts</h2>
                    <button
                        type="button"
                        className="section-view-all-btn"
                        onClick={onViewAllContacts}
                    >
                        View all →
                    </button>
                </div>

                <div className="dash-contacts-grid">
                    {contacts.map((c) => (
                        <div key={c.name} className="contact-card-box">
                            <div className="contact-card-top">
                                <div className="contact-card-avatar-wrap">
                                    <div
                                        className="contact-card-avatar"
                                        style={{ backgroundColor: c.color }}
                                    >
                                        {c.name.slice(0, 2).toUpperCase()}
                                    </div>
                                    {c.isOnline && <span className="avatar-online-dot"></span>}
                                </div>
                                <div className="contact-card-info">
                                    <h4>{c.name}</h4>
                                    <span className="contact-online-label">
                                        {c.isOnline ? 'Online' : 'Offline'}
                                    </span>
                                </div>
                                <button type="button" className="contact-more-btn" title="Options">
                                    ⋮
                                </button>
                            </div>

                            <button
                                type="button"
                                className="contact-message-btn"
                                onClick={() => {
                                    selectChat({
                                        type: 'dm',
                                        partnerName: c.name,
                                        partnerColor: c.color
                                    });
                                }}
                            >
                                Message
                            </button>
                        </div>
                    ))}
                </div>
            </div>

            {/* 4. RECENT GROUPS SECTION */}
            <div className="dash-section-wrap">
                <div className="dash-section-header">
                    <h2>Recent Groups</h2>
                    <button
                        type="button"
                        className="section-view-all-btn"
                        onClick={onViewAllGroups}
                    >
                        View all →
                    </button>
                </div>

                <div className="dash-groups-grid">
                    {groups.map((g) => (
                        <div key={g.name} className="group-card-box">
                            <div className="group-card-top">
                                <div
                                    className="group-card-avatar"
                                    style={{ backgroundColor: g.color }}
                                >
                                    👥
                                </div>
                                <div className="group-card-info">
                                    <h4>{g.name}</h4>
                                    <span className="group-members-label">{g.members} members</span>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="group-message-btn"
                                onClick={() => {
                                    selectChat({
                                        type: 'general',
                                        partnerName: g.name,
                                        partnerColor: g.color
                                    });
                                }}
                            >
                                Message
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
