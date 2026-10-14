import React, { useState, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export default function ProfileAccountModal({ isOpen, onClose, initialMode = 'view' }) {
    const { currentUser } = useSocket();
    const { updateProfile } = useAuth();

    const [activeTab, setActiveTab] = useState(initialMode); // 'view' | 'edit'
    
    // Form fields for Edit Profile
    const [nameInput, setNameInput] = useState('');
    const [usernameInput, setUsernameInput] = useState('');
    const [dobInput, setDobInput] = useState('');
    const [bioInput, setBioInput] = useState('');
    const [colorInput, setColorInput] = useState('#2563eb');
    
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialMode);
            setNameInput(currentUser?.fullName || currentUser?.name || 'Tarun Gupta');
            setUsernameInput(currentUser?.username || 'tarun123');
            setDobInput(currentUser?.dob || '');
            setBioInput(currentUser?.bio || localStorage.getItem('chathub_custom_status') || 'Hey there! I am using ChatHub.');
            setColorInput(currentUser?.color || '#2563eb');
            setErrorMsg('');
            setSuccessMsg('');
        }
    }, [isOpen, initialMode, currentUser]);

    if (!isOpen) return null;

    const displayName = currentUser?.fullName || currentUser?.name || 'Tarun Gupta';
    const displayUsername = currentUser?.username || 'tarun123';
    const displayEmail = currentUser?.email || `${displayUsername}@chathub.io`;
    const displayDob = currentUser?.dob ? new Date(currentUser.dob).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not specified';
    const displayBio = currentUser?.bio || localStorage.getItem('chathub_custom_status') || 'Hey there! I am using ChatHub.';

    // Calculate dynamic initials from full name
    const getInitials = (str) => {
        if (!str) return 'TA';
        const parts = str.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return str.slice(0, 2).toUpperCase();
    };
    const initials = getInitials(displayName);

    const PRESET_COLORS = [
        '#2563eb', '#10b981', '#8b5cf6', '#ec4899', 
        '#f59e0b', '#06b6d4', '#ef4444', '#6366f1'
    ];

    const handleSave = async (e) => {
        e.preventDefault();
        setErrorMsg('');
        setSuccessMsg('');

        if (!nameInput.trim()) {
            return setErrorMsg('Name cannot be empty.');
        }
        if (!usernameInput.trim() || usernameInput.trim().length < 3) {
            return setErrorMsg('Username must be at least 3 characters.');
        }

        setIsSaving(true);
        const res = await updateProfile({
            fullName: nameInput.trim(),
            username: usernameInput.trim().toLowerCase(),
            dob: dobInput,
            bio: bioInput.trim(),
            color: colorInput
        });
        setIsSaving(false);

        if (!res.success) {
            setErrorMsg(res.error || 'Failed to update profile.');
        } else {
            setSuccessMsg('Profile updated successfully!');
            localStorage.setItem('chathub_custom_status', bioInput.trim());
            setTimeout(() => {
                setActiveTab('view');
                setSuccessMsg('');
            }, 1000);
        }
    };

    return (
        <div className="modal-overlay" onClick={onClose}>
            <div className="profile-modal-card" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="profile-modal-header">
                    <div className="profile-modal-tabs">
                        <button
                            type="button"
                            className={`profile-tab-btn ${activeTab === 'view' ? 'active' : ''}`}
                            onClick={() => setActiveTab('view')}
                        >
                            Profile & Account
                        </button>
                        <button
                            type="button"
                            className={`profile-tab-btn ${activeTab === 'edit' ? 'active' : ''}`}
                            onClick={() => setActiveTab('edit')}
                        >
                            Edit Profile
                        </button>
                    </div>
                    <button type="button" className="close-profile-btn" onClick={onClose} title="Close">
                        ✕
                    </button>
                </div>

                {/* Messages feedback */}
                {errorMsg && <div className="profile-modal-alert error">{errorMsg}</div>}
                {successMsg && <div className="profile-modal-alert success">{successMsg}</div>}

                {/* TAB 1: VIEW PROFILE & ACCOUNT */}
                {activeTab === 'view' && (
                    <div className="profile-view-body">
                        {/* User Big Avatar Banner */}
                        <div className="profile-hero-badge">
                            <div
                                className="profile-view-avatar"
                                style={{ backgroundColor: currentUser?.color || '#2563eb' }}
                            >
                                {initials}
                                <span className="profile-avatar-online-dot"></span>
                            </div>
                            <div className="profile-hero-meta">
                                <h2 className="profile-view-name">{displayName}</h2>
                                <span className="profile-view-handle">@{displayUsername}</span>
                                <div className="profile-online-pill-badge">
                                    <span className="dot"></span> Online
                                </div>
                            </div>
                        </div>

                        {/* Bio / Status */}
                        <div className="profile-detail-section">
                            <span className="detail-section-label">About / Status</span>
                            <p className="profile-quote-text">"{displayBio}"</p>
                        </div>

                        {/* Detailed Account Grid */}
                        <div className="profile-account-grid">
                            <div className="account-info-tile">
                                <span className="tile-title">Full Name</span>
                                <span className="tile-value">{displayName}</span>
                            </div>

                            <div className="account-info-tile">
                                <span className="tile-title">Username (Handle)</span>
                                <span className="tile-value highlight">@{displayUsername}</span>
                            </div>

                            <div className="account-info-tile">
                                <span className="tile-title">Email Address</span>
                                <span className="tile-value">{displayEmail}</span>
                            </div>

                            <div className="account-info-tile">
                                <span className="tile-title">Date of Birth</span>
                                <span className="tile-value">{displayDob}</span>
                            </div>

                            <div className="account-info-tile">
                                <span className="tile-title">Account Security</span>
                                <span className="tile-value verified">Verified Account ✓</span>
                            </div>

                            <div className="account-info-tile">
                                <span className="tile-title">Platform</span>
                                <span className="tile-value">ChatHub Web</span>
                            </div>
                        </div>

                        {/* Switch to Edit Button */}
                        <div className="profile-modal-actions">
                            <button
                                type="button"
                                className="profile-primary-btn"
                                onClick={() => setActiveTab('edit')}
                            >
                                ✎ Edit Profile Details
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB 2: EDIT PROFILE FORM */}
                {activeTab === 'edit' && (
                    <form className="profile-edit-form" onSubmit={handleSave}>
                        {/* Avatar Color Picker */}
                        <div className="profile-form-group">
                            <label>Avatar Color</label>
                            <div className="color-presets-row">
                                {PRESET_COLORS.map((col) => (
                                    <div
                                        key={col}
                                        className={`color-preset-circle ${colorInput === col ? 'selected' : ''}`}
                                        style={{ backgroundColor: col }}
                                        onClick={() => setColorInput(col)}
                                    />
                                ))}
                            </div>
                        </div>

                        {/* Full Name */}
                        <div className="profile-form-group">
                            <label>Full Name</label>
                            <input
                                type="text"
                                value={nameInput}
                                onChange={(e) => setNameInput(e.target.value)}
                                placeholder="Enter your full name (e.g. Tarun Gupta)"
                                maxLength={50}
                                required
                            />
                            <span className="field-hint">Your public display name on ChatHub</span>
                        </div>

                        {/* Username */}
                        <div className="profile-form-group">
                            <label>Username (Handle)</label>
                            <div className="username-input-wrap">
                                <span className="at-prefix">@</span>
                                <input
                                    type="text"
                                    value={usernameInput}
                                    onChange={(e) => setUsernameInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                    placeholder="tarun123"
                                    maxLength={20}
                                    required
                                />
                            </div>
                            <span className="field-hint">Unique username for login and messaging</span>
                        </div>

                        {/* Date of Birth */}
                        <div className="profile-form-group">
                            <label>Date of Birth</label>
                            <input
                                type="date"
                                value={dobInput}
                                onChange={(e) => setDobInput(e.target.value)}
                            />
                            <span className="field-hint">Your birth date (e.g., for age-based features)</span>
                        </div>

                        {/* Bio / Status */}
                        <div className="profile-form-group">
                            <label>Status / Bio</label>
                            <input
                                type="text"
                                value={bioInput}
                                onChange={(e) => setBioInput(e.target.value)}
                                placeholder="Hey there! I am using ChatHub."
                                maxLength={100}
                            />
                            <span className="field-hint">Visible to other ChatHub contacts</span>
                        </div>

                        {/* Form Action Buttons */}
                        <div className="profile-form-buttons">
                            <button
                                type="button"
                                className="profile-cancel-btn"
                                onClick={() => setActiveTab('view')}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="profile-primary-btn"
                                disabled={isSaving}
                            >
                                {isSaving ? 'Saving Changes...' : 'Save Profile Changes'}
                            </button>
                        </div>
                    </form>
                )}
            </div>
        </div>
    );
}
