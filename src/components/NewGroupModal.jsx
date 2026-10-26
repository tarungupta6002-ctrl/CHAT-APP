import React, { useState, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { useAuth } from '../context/AuthContext';
import { X, Search, Check, ArrowRight, ArrowLeft, Users, Loader2 } from 'lucide-react';

const AVATAR_COLORS = [
    '#00a884', '#10b981', '#3b82f6', '#6366f1', '#8b5cf6', 
    '#ec4899', '#f43f5e', '#f59e0b', '#14b8a6', '#06b6d4'
];

export default function NewGroupModal({ isOpen, onClose }) {
    const { allRegisteredUsers, createGroup, selectChat } = useSocket();
    const { user: authUser } = useAuth();

    const [step, setStep] = useState(1); // 1: Select members, 2: Group info
    const [searchQuery, setSearchQuery] = useState('');
    const [selectedMembers, setSelectedMembers] = useState([]);
    const [groupName, setGroupName] = useState('');
    const [groupDesc, setGroupDesc] = useState('');
    const [selectedColor, setSelectedColor] = useState('#00a884');
    const [isCreating, setIsCreating] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');

    const myUsername = (authUser?.username || '').toLowerCase();

    // Filter candidate members (exclude current user)
    const availableUsers = useMemo(() => {
        return (allRegisteredUsers || []).filter((u) => {
            const uname = (u.username || '').toLowerCase();
            if (!uname || uname === myUsername) return false;
            if (!searchQuery.trim()) return true;
            const q = searchQuery.toLowerCase().trim();
            const fullName = (u.fullName || '').toLowerCase();
            return uname.includes(q) || fullName.includes(q);
        });
    }, [allRegisteredUsers, myUsername, searchQuery]);

    if (!isOpen) return null;

    const toggleMember = (username) => {
        setSelectedMembers((prev) => {
            if (prev.includes(username)) {
                return prev.filter((u) => u !== username);
            }
            return [...prev, username];
        });
    };

    const handleNext = () => {
        if (selectedMembers.length === 0) {
            setErrorMsg('Please select at least 1 member for the group.');
            return;
        }
        setErrorMsg('');
        setStep(2);
    };

    const handleCreate = async () => {
        if (!groupName.trim()) {
            setErrorMsg('Please enter a group subject / name.');
            return;
        }

        setIsCreating(true);
        setErrorMsg('');

        try {
            const res = await createGroup({
                name: groupName.trim(),
                description: groupDesc.trim(),
                avatarColor: selectedColor,
                members: selectedMembers
            });

            if (res.error) {
                setErrorMsg(res.error);
                setIsCreating(false);
                return;
            }

            // Immediately switch to the new group
            if (res.group) {
                selectChat({
                    type: 'group',
                    groupId: res.group.id,
                    partnerName: res.group.name,
                    partnerColor: res.group.avatarColor,
                    partnerAvatarUrl: res.group.avatarUrl || '',
                    isGroup: true,
                    memberCount: (res.group.members || []).length || selectedMembers.length + 1
                });
            }

            handleClose();
        } catch (err) {
            setErrorMsg('Failed to create group. Please try again.');
            setIsCreating(false);
        }
    };

    const handleClose = () => {
        setStep(1);
        setSearchQuery('');
        setSelectedMembers([]);
        setGroupName('');
        setGroupDesc('');
        setErrorMsg('');
        setIsCreating(false);
        onClose();
    };

    return (
        <div className="wa-modal-backdrop" onClick={handleClose} role="dialog" aria-modal="true">
            <div className="wa-new-group-modal" onClick={(e) => e.stopPropagation()}>
                {/* Modal Header */}
                <div className="wa-new-group-header">
                    <div className="wa-new-group-header-left">
                        {step === 2 && (
                            <button 
                                type="button" 
                                className="wa-modal-icon-btn" 
                                onClick={() => setStep(1)}
                                title="Back to members"
                            >
                                <ArrowLeft size={20} />
                            </button>
                        )}
                        <h2>{step === 1 ? 'Add group members' : 'New group'}</h2>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span className="wa-step-indicator">{step} of 2</span>
                        <button type="button" className="wa-modal-icon-btn" onClick={handleClose} title="Close">
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {errorMsg && (
                    <div className="wa-modal-error">
                        {errorMsg}
                    </div>
                )}

                {/* STEP 1: MEMBER SELECTION */}
                {step === 1 && (
                    <div className="wa-group-step1-wrap">
                        {/* Selected chips bar */}
                        {selectedMembers.length > 0 && (
                            <div className="wa-selected-chips-scroll">
                                {selectedMembers.map((m) => {
                                    const u = allRegisteredUsers?.find((x) => x.username?.toLowerCase() === m.toLowerCase());
                                    return (
                                        <div key={m} className="wa-member-chip">
                                            <span>{u?.fullName || m}</span>
                                            <button 
                                                type="button" 
                                                className="wa-member-chip-remove"
                                                onClick={() => toggleMember(m)}
                                                title="Remove member"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Search Bar */}
                        <div className="wa-group-search-row">
                            <div className="wa-group-search-box">
                                <Search size={16} className="wa-group-search-icon" />
                                <input
                                    type="text"
                                    placeholder="Search contacts..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoFocus
                                />
                            </div>
                        </div>

                        {/* Contacts List */}
                        <div className="wa-group-contacts-list">
                            {availableUsers.length === 0 ? (
                                <div className="wa-group-empty-contacts">
                                    <Users size={32} />
                                    <p>No contacts found</p>
                                </div>
                            ) : (
                                availableUsers.map((user) => {
                                    const isSelected = selectedMembers.includes(user.username);
                                    return (
                                        <div
                                            key={user.username}
                                            className={`wa-group-contact-item ${isSelected ? 'selected' : ''}`}
                                            onClick={() => toggleMember(user.username)}
                                            role="button"
                                            tabIndex={0}
                                        >
                                            <div 
                                                className="wa-group-contact-avatar"
                                                style={{ backgroundColor: user.color || '#10b981' }}
                                            >
                                                {user.avatarUrl ? (
                                                    <img 
                                                        src={user.avatarUrl} 
                                                        alt={user.username} 
                                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                                    />
                                                ) : (
                                                    user.username.slice(0, 2).toUpperCase()
                                                )}
                                            </div>
                                            <div className="wa-group-contact-info">
                                                <span className="wa-group-contact-name">{user.fullName || user.username}</span>
                                                <span className="wa-group-contact-sub">@{user.username}</span>
                                            </div>
                                            <div className={`wa-checkbox ${isSelected ? 'checked' : ''}`}>
                                                {isSelected && <Check size={14} color="#fff" strokeWidth={3} />}
                                            </div>
                                        </div>
                                    );
                                })
                            )}
                        </div>

                        {/* Bottom action button */}
                        <div className="wa-group-footer">
                            <button
                                type="button"
                                className="wa-group-fab-btn"
                                onClick={handleNext}
                                disabled={selectedMembers.length === 0}
                                title={selectedMembers.length === 0 ? "Select at least 1 member" : "Next step"}
                            >
                                <ArrowRight size={22} />
                            </button>
                        </div>
                    </div>
                )}

                {/* STEP 2: GROUP DETAILS */}
                {step === 2 && (
                    <div className="wa-group-step2-wrap">
                        {/* Group Avatar Preview & Color Palette */}
                        <div className="wa-group-icon-section">
                            <div 
                                className="wa-group-large-avatar"
                                style={{ backgroundColor: selectedColor }}
                            >
                                <Users size={36} color="#ffffff" />
                            </div>
                            <div className="wa-group-color-picker">
                                <span>Group Color</span>
                                <div className="wa-group-colors-row">
                                    {AVATAR_COLORS.map((col) => (
                                        <button
                                            key={col}
                                            type="button"
                                            className={`wa-group-color-dot ${selectedColor === col ? 'active' : ''}`}
                                            style={{ backgroundColor: col }}
                                            onClick={() => setSelectedColor(col)}
                                            title={col}
                                        />
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Group Name Input */}
                        <div className="wa-group-input-wrap">
                            <label>Group Subject</label>
                            <div className="wa-group-name-input-row">
                                <input
                                    type="text"
                                    placeholder="Type group subject here..."
                                    value={groupName}
                                    maxLength={25}
                                    onChange={(e) => setGroupName(e.target.value)}
                                    autoFocus
                                />
                                <span className="wa-group-char-counter">{25 - groupName.length}</span>
                            </div>
                        </div>

                        {/* Group Description Input */}
                        <div className="wa-group-input-wrap">
                            <label>Group Description (Optional)</label>
                            <textarea
                                placeholder="Add group description / topic..."
                                value={groupDesc}
                                rows={3}
                                maxLength={150}
                                onChange={(e) => setGroupDesc(e.target.value)}
                            />
                        </div>

                        {/* Selected Members Summary */}
                        <div className="wa-group-summary-wrap">
                            <span className="wa-group-summary-title">Members: {selectedMembers.length + 1} (including you)</span>
                            <p className="wa-group-summary-sub">
                                You, {selectedMembers.join(', ')}
                            </p>
                        </div>

                        {/* Create Fab Button */}
                        <div className="wa-group-footer">
                            <button
                                type="button"
                                className="wa-group-fab-btn"
                                onClick={handleCreate}
                                disabled={!groupName.trim() || isCreating}
                                title="Create Group"
                            >
                                {isCreating ? <Loader2 size={22} className="spin" /> : <Check size={22} strokeWidth={3} />}
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
