import React, { useState, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { 
    Image as ImageIcon, 
    ChevronRight, 
    User, 
    ShieldCheck, 
    Bell, 
    Palette, 
    LogOut, 
    Settings, 
    MessageSquarePlus, 
    Users, 
    Phone, 
    Video,
    Sun,
    Moon
} from 'lucide-react';

export default function ChatHubRightSidebar({ onNewChat, onCreateGroup, onOpenSettings, onEditProfile, onViewProfileAccount }) {
    const { currentUser, setLightboxData, currentChat, conversations } = useSocket();
    const { initiateCall } = useWebRTC();
    const { logout } = useAuth();
    const { theme, toggleTheme, isDark } = useTheme();

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
                            <MessageSquarePlus size={20} />
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
                            <Users size={20} />
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
                            <Phone size={20} />
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
                            <Video size={20} />
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
                        <span className="empty-media-icon"><ImageIcon size={30} /></span>
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
                            <User size={17} className="settings-item-svg" />
                            <span>Profile & Account</span>
                        </div>
                        <ChevronRight size={15} className="settings-nav-arrow" />
                    </button>

                    <button
                        type="button"
                        className="settings-nav-item"
                        onClick={() => alert("Privacy & Security: Your ChatHub messages and voice/video sessions are protected with real-time end-to-end security.")}
                    >
                        <div className="settings-nav-item-left">
                            <ShieldCheck size={17} className="settings-item-svg" />
                            <span>Privacy & Security</span>
                        </div>
                        <ChevronRight size={15} className="settings-nav-arrow" />
                    </button>

                    <button
                        type="button"
                        className="settings-nav-item"
                        onClick={() => alert("Notifications: Audio chimes and unread badge alerts are active.")}
                    >
                        <div className="settings-nav-item-left">
                            <Bell size={17} className="settings-item-svg" />
                            <span>Notifications</span>
                        </div>
                        <ChevronRight size={15} className="settings-nav-arrow" />
                    </button>

                    <button
                        type="button"
                        className="settings-nav-item"
                        onClick={toggleTheme}
                    >
                        <div className="settings-nav-item-left">
                            {isDark ? <Sun size={17} className="settings-item-svg" /> : <Moon size={17} className="settings-item-svg" />}
                            <span>Appearance: {isDark ? 'Dark Theme' : 'Light Theme'}</span>
                        </div>
                        <ChevronRight size={15} className="settings-nav-arrow" />
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
                            <LogOut size={17} className="settings-item-svg logout-svg" />
                            <span className="logout-text">Log Out</span>
                        </div>
                        <ChevronRight size={15} className="settings-nav-arrow" />
                    </button>
                </nav>
            </div>
        </aside>
    );
}
