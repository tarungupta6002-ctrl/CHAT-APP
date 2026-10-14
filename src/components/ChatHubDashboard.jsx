import React, { useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';
import { Users, Sparkles, ShieldCheck, ArrowRight, Plus } from 'lucide-react';

export default function ChatHubDashboard({ onNewChat, onOpenGroup, onViewAllContacts, onViewAllGroups }) {
    const { currentUser, selectChat, allRegisteredUsers, onlineUsers, recentChats, onlineCount } = useSocket();
    const { initiateCall } = useWebRTC();

    // User Name: separate Name (Full Name) and Username (Handle)
    const displayName = currentUser?.fullName || currentUser?.name || 'User';

    // Calculate dynamic initials from Name
    const getInitials = (str) => {
        if (!str) return 'U';
        const parts = str.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return str.slice(0, 2).toUpperCase();
    };
    const userInitials = getInitials(displayName);

    // Real Contacts: Users the logged-in user has actually chatted with or real registered users
    const realRecentContacts = useMemo(() => {
        const myUsername = currentUser?.username?.toLowerCase() || '';
        const list = [];
        const seen = new Set();

        // 1. First prioritize real users the current user actually talked with
        (recentChats || []).forEach((c) => {
            const uname = c.partnerUsername || c.username;
            if (uname && uname.toLowerCase() !== myUsername && !seen.has(uname.toLowerCase())) {
                seen.add(uname.toLowerCase());
                const isOnline = (onlineUsers || []).some(
                    (u) => u.username?.toLowerCase() === uname.toLowerCase()
                );
                list.push({
                    username: uname,
                    fullName: c.fullName || uname,
                    color: c.partnerColor || c.color || '#10b981',
                    isOnline
                });
            }
        });

        // 2. If recent chat list is short, complement with real registered users from DB
        (allRegisteredUsers || []).forEach((u) => {
            if (u.username && u.username.toLowerCase() !== myUsername && !seen.has(u.username.toLowerCase())) {
                seen.add(u.username.toLowerCase());
                const isOnline = (onlineUsers || []).some(
                    (o) => o.username?.toLowerCase() === u.username.toLowerCase()
                );
                list.push({
                    username: u.username,
                    fullName: u.fullName || u.username,
                    color: u.color || '#3b82f6',
                    isOnline
                });
            }
        });

        return list.slice(0, 8);
    }, [recentChats, allRegisteredUsers, onlineUsers, currentUser]);

    // Real Groups: ChatHub Community official group
    const realGroups = useMemo(() => [
        {
            name: 'ChatHub Community',
            membersText: `${onlineCount || 1} online`,
            color: '#2563eb'
        }
    ], [onlineCount]);

    return (
        <div className="chathub-central-dashboard">
            {/* 1. WELCOME HERO BANNER */}
            <div className="dash-hero-banner">
                {/* Left Side: Avatar + Welcome Text + Online Badge */}
                <div className="dash-hero-left-profile">
                    <div className="dash-hero-avatar-wrap">
                        <div
                            className="dash-hero-avatar"
                            style={{ backgroundColor: currentUser?.color || '#2563eb' }}
                        >
                            {currentUser?.avatarUrl ? (
                                <img src={currentUser.avatarUrl} alt={displayName} className="dash-hero-avatar-img" />
                            ) : (
                                userInitials
                            )}
                        </div>
                        <span className="hero-online-badge-dot"></span>
                    </div>

                    <div className="dash-hero-text">
                        <span className="dash-wave-greet"><Sparkles size={15} style={{ display: 'inline', marginRight: '6px', color: '#10b981', verticalAlign: 'middle' }} />Welcome back,</span>
                        <h1 className="dash-welcome-username">{displayName}</h1>
                        <div className="dash-hero-online-pill">
                            <svg className="hero-pill-icon" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                            </svg>
                            <span>Online</span>
                        </div>
                        <p className="dash-hero-description">
                            Stay connected, collaborate and make meaningful conversations with ChatHub.
                        </p>
                    </div>
                </div>

                {/* Right Side: 3D Illustration Mockup with Floating Action Badges */}
                <div className="dash-hero-graphic-wrap">
                    {/* Floating Glow Action Pills */}
                    <div className="floating-hero-pill pill-msg-top">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd" />
                        </svg>
                    </div>

                    <div className="floating-hero-pill pill-msg-bottom">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7z" clipRule="evenodd" />
                        </svg>
                    </div>

                    <div className="floating-hero-pill pill-video">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                    </div>

                    <div className="floating-hero-pill pill-call">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z" />
                        </svg>
                    </div>

                    <div className="floating-hero-pill pill-photo">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M4 3a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V5a2 2 0 00-2-2H4zm12 12H4l4-8 3 6 2-4 3 6z" clipRule="evenodd" />
                        </svg>
                    </div>

                    {/* ChatHub Desktop Window Mockup */}
                    <div className="hero-app-mock-frame">
                        <div className="hero-mock-topbar">
                            <span className="mock-dot red"></span>
                            <span className="mock-dot yellow"></span>
                            <span className="mock-dot green"></span>
                            <span className="mock-title-text">ChatHub</span>
                        </div>
                        <div className="hero-mock-chat-area">
                            <div className="hero-mock-sidebar-stub">
                                <div className="stub-avatar"></div>
                                <div className="stub-avatar"></div>
                                <div className="stub-avatar"></div>
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
                    <div className="feature-circle-icon green">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <h3>Instant Messaging</h3>
                    <p>Send and receive messages in real time.</p>
                </div>

                <div
                    className="dash-feature-card"
                    onClick={() => initiateCall(true)}
                    role="button"
                    tabIndex={0}
                >
                    <div className="feature-circle-icon purple">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                    </div>
                    <h3>Voice & Video Calls</h3>
                    <p>High quality and reliable calls.</p>
                </div>

                <div
                    className="dash-feature-card"
                    onClick={() => selectChat({ type: 'general', partnerName: 'ChatHub Community', partnerColor: '#2563eb' })}
                    role="button"
                    tabIndex={0}
                >
                    <div className="feature-circle-icon blue">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                        </svg>
                    </div>
                    <h3>Groups & Communities</h3>
                    <p>Stay connected with your teams.</p>
                </div>

                <div className="dash-feature-card">
                    <div className="feature-circle-icon yellow">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                    </div>
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
                    {realRecentContacts.length === 0 ? (
                        <div className="dash-empty-contacts-card">
                            <div className="empty-contact-icon">
                                <Users size={32} />
                            </div>
                            <h4>No contacts found yet</h4>
                            <p>Click "New Chat" to connect with registered users on ChatHub.</p>
                            <button
                                type="button"
                                className="contact-message-btn"
                                style={{ marginTop: '0.75rem', width: 'auto', padding: '0.5rem 1.25rem' }}
                                onClick={onNewChat}
                            >
                                <Plus size={16} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} /> Start New Chat
                            </button>
                        </div>
                    ) : (
                        realRecentContacts.map((c) => {
                            const cInitials = getInitials(c.fullName || c.username);
                            return (
                                <div key={c.username} className="contact-card-box">
                                    <div className="contact-card-top">
                                        <div className="contact-card-avatar-wrap">
                                            <div
                                                className="contact-card-avatar-fallback"
                                                style={{ backgroundColor: c.color }}
                                            >
                                                {cInitials}
                                            </div>
                                            {c.isOnline && <span className="avatar-online-dot"></span>}
                                        </div>
                                        <div className="contact-card-info">
                                            <h4>{c.fullName || c.username}</h4>
                                            <span className="contact-handle-sub">@{c.username}</span>
                                            <span className={`contact-online-label ${c.isOnline ? 'online' : 'offline'}`}>
                                                <span className="contact-online-bullet">●</span> {c.isOnline ? 'Online' : 'Offline'}
                                            </span>
                                        </div>
                                    </div>

                                    <button
                                        type="button"
                                        className="contact-message-btn"
                                        onClick={() => {
                                            selectChat({
                                                type: 'dm',
                                                partnerName: c.username,
                                                partnerColor: c.color
                                            });
                                        }}
                                    >
                                        Message
                                    </button>
                                </div>
                            );
                        })
                    )}
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
                    {realGroups.map((g) => (
                        <div key={g.name} className="group-card-box">
                            <div className="group-card-top">
                                <div
                                    className="group-card-avatar"
                                    style={{ backgroundColor: g.color }}
                                >
                                    <svg viewBox="0 0 20 20" fill="currentColor">
                                        <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                                    </svg>
                                </div>
                                <div className="group-card-info">
                                    <h4>{g.name}</h4>
                                    <span className="group-members-label">{g.membersText}</span>
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
                                Open Group Chat
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
