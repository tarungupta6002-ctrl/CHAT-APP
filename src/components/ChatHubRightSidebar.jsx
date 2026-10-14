import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';
import { useAuth } from '../context/AuthContext';

export default function ChatHubRightSidebar({ onNewChat, onCreateGroup, onOpenSettings }) {
    const { currentUser, setLightboxData } = useSocket();
    const { initiateCall } = useWebRTC();
    const { logout } = useAuth();

    const [statusText, setStatusText] = useState(() => {
        return localStorage.getItem('chathub_custom_status') || 'Hey there! I am using ChatHub.';
    });
    const [isEditingStatus, setIsEditingStatus] = useState(false);
    const [tempStatus, setTempStatus] = useState(statusText);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);

    const username = currentUser?.username || 'tarun123';
    const initials = username.slice(0, 2).toUpperCase();

    const handleSaveStatus = (e) => {
        e.preventDefault();
        const trimmed = tempStatus.trim() || 'Hey there! I am using ChatHub.';
        setStatusText(trimmed);
        localStorage.setItem('chathub_custom_status', trimmed);
        setIsEditingStatus(false);
    };

    // Shared media items matching the reference screenshot
    const sharedMedia = [
        {
            id: 1,
            title: 'Mountain Landscape',
            src: 'https://images.unsplash.com/photo-1464822759023-fed622ff2c3b?auto=format&fit=crop&w=600&q=80',
            type: 'image'
        },
        {
            id: 2,
            title: 'Project Roadmap Document',
            src: 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=600&q=80',
            type: 'doc'
        },
        {
            id: 3,
            title: 'Golden Retriever',
            src: 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=600&q=80',
            type: 'image'
        },
        {
            id: 4,
            title: 'Code Editor Screenshot',
            src: 'https://images.unsplash.com/photo-1555066931-4365d14bab8c?auto=format&fit=crop&w=600&q=80',
            type: 'image'
        },
        {
            id: 5,
            title: 'Green Succulent Plant',
            src: 'https://images.unsplash.com/photo-1509423350716-97f9360b4e09?auto=format&fit=crop&w=600&q=80',
            type: 'image'
        },
        {
            id: 6,
            title: 'Quarterly Summary PDF',
            src: 'https://images.unsplash.com/photo-1568667256549-094345857637?auto=format&fit=crop&w=600&q=80',
            type: 'doc'
        },
        {
            id: 7,
            title: 'Sunset over Lake',
            src: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80',
            type: 'image'
        },
        {
            id: 8,
            title: 'ChatHub Media Archive',
            src: 'https://images.unsplash.com/photo-1518770660439-4636190af475?auto=format&fit=crop&w=600&q=80',
            type: 'image',
            badge: '+34'
        }
    ];

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
                            {initials}
                        </div>
                        <span className="profile-online-dot" title="Online"></span>
                    </div>

                    <div className="dash-profile-meta">
                        <div className="profile-meta-title-row">
                            <h3 className="profile-username">{username}</h3>
                            <button
                                type="button"
                                className="profile-edit-btn"
                                title="Edit profile status"
                                onClick={() => setIsEditingStatus(!isEditingStatus)}
                            >
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                                </svg>
                            </button>
                        </div>
                        <div className="profile-status-indicator">
                            <span className="status-green-dot"></span>
                            <span>Online</span>
                        </div>
                    </div>
                </div>

                <p className="profile-bio-text">{statusText}</p>

                {isEditingStatus ? (
                    <form className="profile-status-form" onSubmit={handleSaveStatus}>
                        <input
                            type="text"
                            value={tempStatus}
                            onChange={(e) => setTempStatus(e.target.value)}
                            placeholder="Set a custom status..."
                            maxLength={80}
                            autoFocus
                        />
                        <div className="profile-status-buttons">
                            <button type="submit" className="status-save-btn">Save</button>
                            <button
                                type="button"
                                className="status-cancel-btn"
                                onClick={() => {
                                    setTempStatus(statusText);
                                    setIsEditingStatus(false);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </form>
                ) : (
                    <div
                        className="profile-status-pill"
                        onClick={() => setIsEditingStatus(true)}
                        role="button"
                        tabIndex={0}
                    >
                        <span className="status-pill-emoji">😊</span>
                        <span className="status-pill-text">Set a status...</span>
                        <svg className="status-pill-edit" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                    </div>
                )}
            </div>

            {/* 2. Quick Actions */}
            <div className="dash-sidebar-block">
                <div className="dash-sidebar-block-header">
                    <span className="quick-actions-icon">↻</span>
                    <h4>Quick Actions</h4>
                </div>
                <div className="quick-actions-grid">
                    <button
                        type="button"
                        className="quick-action-tile"
                        onClick={onNewChat}
                        title="Start a new chat conversation"
                    >
                        <div className="tile-icon green">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zM9 9h2v2H9V9z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <span>New Chat</span>
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
                        <span>Create Group</span>
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
                        <span>Start Call</span>
                    </button>

                    <button
                        type="button"
                        className="quick-action-tile"
                        onClick={() => initiateCall(true)}
                        title="Start a high-definition video call"
                    >
                        <div className="tile-icon white">
                            <svg viewBox="0 0 20 20" fill="currentColor">
                                <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                            </svg>
                        </div>
                        <span>Start Video Call</span>
                    </button>
                </div>
            </div>

            {/* 3. Shared Media */}
            <div className="dash-sidebar-block">
                <div className="dash-sidebar-block-header between">
                    <h4>Shared Media</h4>
                    <button
                        type="button"
                        className="sidebar-view-all-link"
                        onClick={() => {
                            setLightboxData({
                                src: sharedMedia[0].src,
                                title: sharedMedia[0].title
                            });
                        }}
                    >
                        View all →
                    </button>
                </div>

                <div className="shared-media-grid">
                    {sharedMedia.map((m) => (
                        <div
                            key={m.id}
                            className={`media-thumb-cell ${m.badge ? 'has-badge' : ''}`}
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
                                onError={(e) => {
                                    e.target.style.display = 'none';
                                }}
                            />
                            {m.badge && <span className="media-more-overlay">{m.badge}</span>}
                        </div>
                    ))}
                </div>
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
                        onClick={onOpenSettings}
                    >
                        <div className="settings-nav-item-left">
                            <span className="settings-icon">👤</span>
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
                            <span className="settings-icon">🔒</span>
                            <span>Privacy & Security</span>
                        </div>
                        <span className="settings-nav-arrow">›</span>
                    </button>

                    <button
                        type="button"
                        className="settings-nav-item"
                        onClick={() => alert("🔔 Notification settings: Desktop chimes and unread badge alerts are active.")}
                    >
                        <div className="settings-nav-item-left">
                            <span className="settings-icon">🔔</span>
                            <span>Notifications</span>
                        </div>
                        <span className="settings-nav-arrow">›</span>
                    </button>

                    <button
                        type="button"
                        className="settings-nav-item"
                        onClick={() => alert("🌐 Appearance: ChatHub is rendered in premium dark navy theme.")}
                    >
                        <div className="settings-nav-item-left">
                            <span className="settings-icon">🌐</span>
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
                            <span className="settings-icon">🚪</span>
                            <span style={{ color: '#ef4444' }}>Log Out</span>
                        </div>
                        <span className="settings-nav-arrow">›</span>
                    </button>
                </nav>
            </div>
        </aside>
    );
}
