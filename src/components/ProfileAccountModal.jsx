import React, { useState, useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';

export default function ProfileAccountModal({ isOpen, onClose, initialMode = 'view' }) {
    const { currentUser } = useSocket();
    const { updateProfile } = useAuth();
    const fileInputRef = useRef(null);

    const [activeTab, setActiveTab] = useState(initialMode); // 'view' | 'edit'
    
    // Form fields for Edit Profile
    const [nameInput, setNameInput] = useState('');
    const [usernameInput, setUsernameInput] = useState('');
    const [dobInput, setDobInput] = useState('');
    const [bioInput, setBioInput] = useState('');
    const [colorInput, setColorInput] = useState('#2563eb');
    const [avatarUrlInput, setAvatarUrlInput] = useState('');
    
    const [isSaving, setIsSaving] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [successMsg, setSuccessMsg] = useState('');

    useEffect(() => {
        if (isOpen) {
            setActiveTab(initialMode);
            setNameInput(currentUser?.fullName || currentUser?.name || 'User');
            setUsernameInput(currentUser?.username || 'user');
            setDobInput(currentUser?.dob || '');
            setBioInput(currentUser?.bio || localStorage.getItem('chathub_custom_status') || 'Hey there! I am using ChatHub.');
            setColorInput(currentUser?.color || '#2563eb');
            setAvatarUrlInput(currentUser?.avatarUrl || '');
            setErrorMsg('');
            setSuccessMsg('');
        }
    }, [isOpen, initialMode, currentUser]);

    if (!isOpen) return null;

    const displayName = currentUser?.fullName || currentUser?.name || 'User';
    const displayUsername = currentUser?.username || 'user';
    const displayEmail = currentUser?.email || `${displayUsername}@chathub.io`;
    const displayDob = currentUser?.dob ? new Date(currentUser.dob).toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' }) : 'Not specified';
    const displayBio = currentUser?.bio || localStorage.getItem('chathub_custom_status') || 'Hey there! I am using ChatHub.';
    const currentAvatarUrl = currentUser?.avatarUrl;

    // Calculate dynamic initials from full name
    const getInitials = (str) => {
        if (!str) return 'U';
        const parts = str.trim().split(/\s+/);
        if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
        return str.slice(0, 2).toUpperCase();
    };
    const initials = getInitials(displayName);

    const PRESET_COLORS = [
        '#2563eb', '#10b981', '#8b5cf6', '#ec4899', 
        '#f59e0b', '#06b6d4', '#ef4444', '#6366f1'
    ];

    // Handle Profile Picture file selection & lightweight canvas compression
    const handleAvatarFileChange = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (file.size > 6 * 1024 * 1024) {
            return setErrorMsg('Please choose an image under 6MB.');
        }

        const reader = new FileReader();
        reader.onload = (loadEvent) => {
            const img = new Image();
            img.onload = () => {
                const canvas = document.createElement('canvas');
                const maxDim = 256;
                let width = img.width;
                let height = img.height;
                if (width > height) {
                    if (width > maxDim) {
                        height = Math.round(height * (maxDim / width));
                        width = maxDim;
                    }
                } else {
                    if (height > maxDim) {
                        width = Math.round(width * (maxDim / height));
                        height = maxDim;
                    }
                }
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.84);
                setAvatarUrlInput(compressedDataUrl);
                setErrorMsg('');
            };
            img.src = loadEvent.target.result;
        };
        reader.readAsDataURL(file);
    };

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
            color: colorInput,
            avatarUrl: avatarUrlInput
        });
        setIsSaving(false);

        if (!res.success) {
            setErrorMsg(res.error || 'Failed to update profile.');
        } else {
            setSuccessMsg('Profile picture & details updated successfully!');
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
                            Edit Profile & Picture
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
                                {currentAvatarUrl ? (
                                    <img
                                        src={currentAvatarUrl}
                                        alt={displayName}
                                        className="profile-modal-avatar-img"
                                    />
                                ) : (
                                    initials
                                )}
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
                                <span className="tile-title">Profile Picture</span>
                                <span className="tile-value">{currentAvatarUrl ? 'Custom Photo Uploaded ✓' : 'Default Initials Avatar'}</span>
                            </div>

                            <div className="account-info-tile">
                                <span className="tile-title">Account Security</span>
                                <span className="tile-value verified">Verified Account ✓</span>
                            </div>
                        </div>

                        {/* Switch to Edit Button */}
                        <div className="profile-modal-actions">
                            <button
                                type="button"
                                className="profile-primary-btn"
                                onClick={() => setActiveTab('edit')}
                            >
                                ✎ Edit Profile & Change Photo
                            </button>
                        </div>
                    </div>
                )}

                {/* TAB 2: EDIT PROFILE FORM */}
                {activeTab === 'edit' && (
                    <form className="profile-edit-form" onSubmit={handleSave}>
                        {/* 1. Profile Picture Upload & Preview Section */}
                        <div className="profile-form-group avatar-upload-group">
                            <label>Profile Picture</label>
                            <div className="avatar-upload-row">
                                <div
                                    className="avatar-edit-preview-box"
                                    style={{ backgroundColor: colorInput }}
                                    onClick={() => fileInputRef.current?.click()}
                                    title="Click to change photo"
                                >
                                    {avatarUrlInput ? (
                                        <img
                                            src={avatarUrlInput}
                                            alt="Preview"
                                            className="avatar-edit-img"
                                        />
                                    ) : (
                                        <span className="avatar-edit-initials">{initials}</span>
                                    )}
                                    <div className="avatar-edit-overlay">
                                        <span>📷</span>
                                    </div>
                                </div>

                                <div className="avatar-upload-controls">
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        style={{ display: 'none' }}
                                        accept="image/png, image/jpeg, image/jpg, image/webp"
                                        onChange={handleAvatarFileChange}
                                    />
                                    <button
                                        type="button"
                                        className="avatar-choose-btn"
                                        onClick={() => fileInputRef.current?.click()}
                                    >
                                        📁 Upload Photo
                                    </button>
                                    {avatarUrlInput && (
                                        <button
                                            type="button"
                                            className="avatar-remove-btn"
                                            onClick={() => setAvatarUrlInput('')}
                                        >
                                            Remove Photo
                                        </button>
                                    )}
                                    <span className="field-hint">JPG, PNG, or WEBP (Square format recommended)</span>
                                </div>
                            </div>
                        </div>

                        {/* 2. Avatar Theme Color Picker */}
                        <div className="profile-form-group">
                            <label>Avatar Background Color {avatarUrlInput ? '(Used as fallback)' : ''}</label>
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

                        {/* 3. Full Name */}
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

                        {/* 4. Username */}
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

                        {/* 5. Date of Birth */}
                        <div className="profile-form-group">
                            <label>Date of Birth</label>
                            <input
                                type="date"
                                value={dobInput}
                                onChange={(e) => setDobInput(e.target.value)}
                            />
                            <span className="field-hint">Your birth date (e.g., for age-based features)</span>
                        </div>

                        {/* 6. Bio / Status */}
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

