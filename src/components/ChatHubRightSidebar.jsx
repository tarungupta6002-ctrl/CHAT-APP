import React, { useState, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';
import { useAuth } from '../context/AuthContext';

export default function ChatHubRightSidebar({ onNewChat, onCreateGroup, onOpenSettings, onEditProfile, onViewProfileAccount }) {
    const { currentUser, setLightboxData, currentChat, conversations } = useSocket();
    const { initiateCall } = useWebRTC();
    const { logout } = useAuth();

    const displayName = currentUser?.fullName || currentUser?.name || 'Tarun Gupta';
    const userHandle = currentUser?.username ? `@${currentUser.username}` : '@tarun123';
    const statusText = currentUser?.bio || localStorage.getItem('chathub_custom_status') || 'Hey there! I am using ChatHub.';

    // Dynamic initials
    const getInitials = (str) => {
        if (!str) return 'TG';
        const parts = str.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return str.slice(0, 2).toUpperCase();
    };
    const initials = getInitials(displayName);

    // Real Shared Media from current active conversation (no dummy photos)
    const activeKey = !currentChat || currentChat.type === 'general'
        ? 'general'
        : (currentChat.partnerName ? currentChat.partnerName.toLowerCase() : 'dm');

    const activeMsgs = conversations[activeKey] || [];
    const realSharedMedia = useMemo(() => {
        const media = [];
        activeMsgs.forEach((m, idx) => {
            const mData = m.data || m;
            if (mData.image && !mData.isViewOnce) {
                media.push({
                    id: mData.id || `media-${idx}`,
                    src: mData.image,
                    title: mData.text || `${mData.username || 'User'}'s image`,
                    type: 'image'
                });
            }
        });
        return media.reverse();
    }, [activeMsgs]);

    return (
        <aside className="chathub-right-sidebar">
            {/* 1. Logged-in User Profile Card */}
            <div className="dash-profile-card">
                <div className="dash-profile-top">
                    <div className="dash-profile-avatar-wrap">
                        <div
                            className="dash-profile-avatar"
                            style={{ backgroundColor: currentUser?.color || '#2563eb' }}
                        >
                            {currentUser?.avatarUrl ? (
                                <img src={currentUser.avatarUrl} alt={displayName} className="dash-profile-avatar-img" />
                            ) : (
                                initials
                            )}
                        </div>
                        <span className="profile-online-dot" title="Online"></span>
                    </div>

                    <div className="dash-profile-meta">
                        <div className="profile-meta-title-row">
                            <h3 className="profile-username">{displayName}</h3>
                            <button
                                type="button"
                                className="profile-edit-btn"
                                title="Edit profile"
                                onClick={onEditProfile || onOpenSettings}
                            >
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                            </button>
                        </div>
                        <span className="profile-user-handle">{userHandle}</span>
                    </div>
                </div>

                <p className="profile-bio-text">{statusText}</p>

                {/* Edit Profile Full Width Button with Gear Icon */}
                <button
                    type="button"
                    className="profile-edit-profile-btn"
                    onClick={onEditProfile || onOpenSettings}
                >
                    <svg className="edit-gear-icon" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M11.49 3.17c-.38-1.56-2.6-1.56-2.98 0a1.532 1.532 0 01-2.286.948c-1.372-.836-2.942.734-2.106 2.106.54.886.061 2.042-.947 2.287-1.561.379-1.561 2.6 0 2.978a1.532 1.532 0 01.947 2.287c-.836 1.372.734 2.942 2.106 2.106a1.532 1.532 0 012.287.947c.379 1.561 2.6 1.561 2.978 0a1.533 1.533 0 012.287-.947c1.372.836 2.942-.734 2.106-2.106a1.533 1.533 0 01.947-2.287c1.561-.379 1.561-2.6 0-2.978a1.532 1.532 0 01-.947-2.287c.836-1.372-.734-2.942-2.106-2.106a1.532 1.532 0 01-2.287-.947zM10 13a3 3 0 100-6 3 3 0 000 6z" clipRule="evenodd" />
                    </svg>
                    <span>Edit Profile</span>
                </button>
            </div>

            {/* 2. Quick Actions */}
            <div className="dash-sidebar-block">
                <div className="dash-sidebar-block-header">
                    <h4>Quick Actions</h4>
                </div>
                <div className="quick-actions-grid">
                    <button
                        type="button"
                        className="quick-action-tile highlight-green"
                        onClick={onNewChat}
                        title="Start a new chat conversation"
                    >
                        <div className="tile-icon green">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <span className="tile-label green">New Chat</span>
                    </button>

                    <button
                        type="button"
                        className="quick-action-tile"
                        onClick={onCreateGroup}
                        title="Create a new group"
                    >
                        <div className="tile-icon white">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path d="M13 6a3 3 0 11-6 0 3 3 0 016 0zM18 8a2 2 0 11-4 0 2 2 0 014 0zM14 15a4 4 0 00-8 0v3h8v-3zM6 8a2 2 0 11-4 0 2 2 0 014 0zM16 18v-3a5.972 5.972 0 00-.75-2.906A3.005 3.005 0 0119 15v3h-3zM4.75 12.094A5.973 5.973 0 004 15v3H1v-3a3 3 0 013.75-2.906z" />
                            </svg>
                        </div>
                        <span className="tile-label">Create Group</span>
                    </button>

                    <button
                        type="button"
                        className="quick-action-tile"
                        onClick={() => initiateCall(false)}
                        title="Start a voice call"
                    >
                        <div className="tile-icon white">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z" />
                            </svg>
                        </div>
                        <span className="tile-label">Start Call</span>
                    </button>

                    <button
                        type="button"
                        className="quick-action-tile"
                        onClick={() => initiateCall(true)}
                        title="Start a video call"
                    >
                        <div className="tile-icon white">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                            </svg>
                        </div>
                        <span className="tile-label">Start Video Call</span>
                    </button>
                </div>
            </div>

            {/* 3. Shared Media */}
            <div className="dash-sidebar-block">
                <div className="dash-sidebar-block-header between">
                    <h4>Shared Media {realSharedMedia.length > 0 && `(${realSharedMedia.length})`}</h4>
                    {realSharedMedia.length > 0 && (
                        <button
                            type="button"
                            className="sidebar-view-all-link"
                            onClick={() => {
                                setLightboxData({
                                    src: realSharedMedia[0].src,
                                    title: realSharedMedia[0].title
                                });
                            }}
                        >
                            View all →
                        </button>
                    )}
                </div>

                {realSharedMedia.length === 0 ? (
                    <div className="empty-shared-media-box">
                        <span className="empty-media-icon">🖼️</span>
                        <p className="empty-media-text">No shared media yet</p>
                        <span className="empty-media-sub">
                            Photos and media sent in this chat will appear here.
                        </span>
                    </div>
                ) : (
                    <div className="shared-media-grid">
                        {realSharedMedia.slice(0, 8).map((m) => (
                            <div
                                key={m.id}
                                className="media-thumb-cell"
                                onClick={() => {
                                    setLightboxData({
                                        src: m.src,
                                        title: m.title
                                    });
                                }}
                                title={m.title}
                                role="button"
                                tabIndex={0}
                            >
                                <img
                                    src={m.src}
                                    alt={m.title}
                                    loading="lazy"
                                />
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 4. Account & Settings */}
            <div className="dash-sidebar-block settings-block">
                <div className="dash-sidebar-block-header">
                    <h4>Account & Settings</h4>
                </div>

                <nav className="settings-nav-list">
                    <button
                        type="button"
                        className="settings-nav-item"
                        onClick={onViewProfileAccount || onOpenSettings}
                    >
                        <div className="settings-nav-item-left">
                            <svg className="settings-item-svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                            </svg>
                            <span>Profile & Account</span>
                        </div>
                        <span className="settings-nav-arrow">›</span>
                    </button>

                    <button
                        type="button"
                        className="settings-nav-item"
                        onClick={() => alert("🔒 Privacy & Security: Your ChatHub messages and voice/video sessions are protected with real-time end-to-end security.")}
                    >
                        <div className="settings-nav-item-left">
                            <svg className="settings-item-svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                            </svg>
                            <span>Privacy & Security</span>
                        </div>
                        <span className="settings-nav-arrow">›</span>
                    </button>

                    <button
                        type="button"
                        className="settings-nav-item"
                        onClick={() => alert("🔔 Notifications: Audio chimes and unread badge alerts are active.")}
                    >
                        <div className="settings-nav-item-left">
                            <svg className="settings-item-svg" viewBox="0 0 20 20" fill="currentColor">
                                <path d="M10 2a6 6 0 00-6 6v3.586l-.707.707A1 1 0 004 14h12a1 1 0 00.707-1.707L16 11.586V8a6 6 0 00-6-6zM10 18a3 3 0 01-3-3h6a3 3 0 01-3 3z" />
                            </svg>
                            <span>Notifications</span>
                        </div>
                        <span className="settings-nav-arrow">›</span>
                    </button>

                    <button
                        type="button"
                        className="settings-nav-item"
                        onClick={() => alert("🌐 Appearance: ChatHub is active in dark navy & emerald theme.")}
                    >
                        <div className="settings-nav-item-left">
                            <svg className="settings-item-svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M4.083 9h1.946c.089-1.546.383-2.97.837-4.118A6.004 6.004 0 004.083 9zM10 2a8 8 0 100 16 8 8 0 000-16zm0 2c-.076 0-.232.032-.465.262-.238.234-.497.623-.737 1.182-.389.907-.673 2.142-.766 3.556h3.936c-.093-1.414-.377-2.649-.766-3.556-.24-.56-.5-.948-.737-1.182C10.231 4.032 10.076 4 10 4zm3.971 5c-.089-1.546-.383-2.97-.837-4.118A6.004 6.004 0 0115.917 9h-1.946zm-7.942 2c.089 1.546.383 2.97.837 4.118A6.004 6.004 0 014.083 11h1.946zm2.035 0c.093 1.414.377 2.649.766 3.556.24.56.5.948.737 1.182.233.23.389.262.465.262.076 0 .232-.032.465-.262.238-.234.498-.623.737-1.182.389-.907.673-2.142.766-3.556H8.064zm5.907 0c-.089 1.546-.383 2.97-.837 4.118A6.004 6.004 0 0015.917 11h-1.946z" clipRule="evenodd" />
                            </svg>
                            <span>Appearance</span>
                        </div>
                        <span className="settings-nav-arrow">›</span>
                    </button>

                    <button
                        type="button"
                        className="settings-nav-item logout-item"
                        onClick={() => {
                            if (window.confirm("Are you sure you want to log out of ChatHub?")) {
                                logout();
                            }
                        }}
                    >
                        <div className="settings-nav-item-left">
                            <svg className="settings-item-svg logout-svg" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M3 3a1 1 0 00-1 1v12a1 1 0 102 0V4a1 1 0 00-1-1zm10.293 9.293a1 1 0 001.414 1.414l3-3a1 1 0 000-1.414l-3-3a1 1 0 10-1.414 1.414L14.586 9H7a1 1 0 100 2h7.586l-1.293 1.293z" clipRule="evenodd" />
                            </svg>
                            <span className="logout-text">Log Out</span>
                        </div>
                        <span className="settings-nav-arrow">›</span>
                    </button>
                </nav>
            </div>
        </aside>
    );
}
