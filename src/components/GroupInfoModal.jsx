import React, { useState, useMemo } from 'react';
import { useSocket } from '../context/SocketContext';
import { 
    X, 
    Users, 
    UserPlus, 
    ShieldCheck, 
    LogOut, 
    Search, 
    Calendar, 
    Info,
    Check,
    Loader2
} from 'lucide-react';

export default function GroupInfoModal({ isOpen, onClose }) {
    const { 
        activeGroupDetails, 
        addGroupMember, 
        removeGroupMember, 
        allRegisteredUsers, 
        currentUser,
        selectChat 
    } = useSocket();

    const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
    const [searchAddUser, setSearchAddUser] = useState('');
    const [selectedAddUsers, setSelectedAddUsers] = useState([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [confirmExit, setConfirmExit] = useState(false);

    const myUsername = (currentUser?.username || '').toLowerCase();

    // Check if the current logged-in user is an admin or the group creator
    const isAdmin = useMemo(() => {
        if (!activeGroupDetails) return false;
        if (activeGroupDetails.createdBy?.toLowerCase() === myUsername) return true;
        const myMemberRec = (activeGroupDetails.members || []).find(
            (m) => m.username?.toLowerCase() === myUsername
        );
        return myMemberRec?.role === 'admin';
    }, [activeGroupDetails, myUsername]);

    // Available users who are NOT yet in the group
    const nonMemberUsers = useMemo(() => {
        if (!activeGroupDetails) return [];
        const existingMembers = new Set(
            (activeGroupDetails.members || []).map((m) => m.username?.toLowerCase())
        );
        return (allRegisteredUsers || []).filter((u) => {
            const uname = (u.username || '').toLowerCase();
            if (!uname || existingMembers.has(uname)) return false;
            if (!searchAddUser.trim()) return true;
            const q = searchAddUser.toLowerCase().trim();
            const fullName = (u.fullName || '').toLowerCase();
            return uname.includes(q) || fullName.includes(q);
        });
    }, [activeGroupDetails, allRegisteredUsers, searchAddUser]);

    if (!isOpen || !activeGroupDetails) return null;

    const group = activeGroupDetails;
    const members = group.members || [];

    const handleToggleAddUser = (username) => {
        setSelectedAddUsers((prev) => 
            prev.includes(username) ? prev.filter((u) => u !== username) : [...prev, username]
        );
    };

    const handleConfirmAddMembers = async () => {
        if (selectedAddUsers.length === 0) return;
        setIsSubmitting(true);
        setErrorMsg('');
        try {
            for (const uname of selectedAddUsers) {
                await addGroupMember(group.id, uname);
            }
            setSelectedAddUsers([]);
            setIsAddMemberOpen(false);
        } catch (err) {
            setErrorMsg(err.message || 'Failed to add members');
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleRemoveMember = async (memberUsername) => {
        if (!window.confirm(`Remove @${memberUsername} from this group?`)) return;
        try {
            await removeGroupMember(group.id, memberUsername);
        } catch (err) {
            alert(err.message || 'Failed to remove member');
        }
    };

    const handleExitGroup = async () => {
        try {
            await removeGroupMember(group.id, currentUser.username);
            selectChat(null);
            onClose();
        } catch (err) {
            alert(err.message || 'Failed to exit group');
        }
    };

    const createdDate = group.createdAt 
        ? new Date(group.createdAt).toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' }) 
        : 'Recently';

    return (
        <div className="wa-modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
            <div className="wa-group-info-modal" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="wa-group-info-header">
                    <button type="button" className="wa-close-btn" onClick={onClose} aria-label="Close group info">
                        <X size={20} />
                    </button>
                    <h2 className="wa-group-info-title">Group info</h2>
                </div>

                <div className="wa-group-info-scrollable">
                    {/* Hero Avatar & Title */}
                    <div className="wa-group-hero">
                        <div 
                            className="wa-group-hero-avatar"
                            style={{ backgroundColor: group.avatarColor || '#00a884' }}
                        >
                            {group.avatarUrl ? (
                                <img src={group.avatarUrl} alt={group.name} className="wa-group-hero-img" />
                            ) : (
                                <Users size={48} color="#ffffff" />
                            )}
                        </div>
                        <h3 className="wa-group-hero-name">{group.name}</h3>
                        <p className="wa-group-hero-meta">
                            Group • {members.length} {members.length === 1 ? 'member' : 'members'}
                        </p>
                    </div>

                    {/* Description Card */}
                    <div className="wa-group-info-card">
                        <div className="wa-group-card-header">
                            <Info size={16} />
                            <span>Description</span>
                        </div>
                        <p className="wa-group-desc-text">
                            {group.description?.trim() ? group.description : 'No description provided.'}
                        </p>
                        <div className="wa-group-card-footer">
                            <Calendar size={14} />
                            <span>Created by @{group.createdBy} on {createdDate}</span>
                        </div>
                    </div>

                    {/* Members Card */}
                    <div className="wa-group-info-card">
                        <div className="wa-group-members-top">
                            <div className="wa-group-card-header">
                                <Users size={16} />
                                <span>{members.length} Members</span>
                            </div>
                            {isAdmin && (
                                <button 
                                    type="button" 
                                    className="wa-add-member-trigger-btn"
                                    onClick={() => {
                                        setIsAddMemberOpen(true);
                                        setErrorMsg('');
                                    }}
                                >
                                    <UserPlus size={15} />
                                    <span>Add member</span>
                                </button>
                            )}
                        </div>

                        {/* Member List */}
                        <div className="wa-group-members-list">
                            {members.map((m) => {
                                const isMemberAdmin = m.role === 'admin' || m.username?.toLowerCase() === group.createdBy?.toLowerCase();
                                const isMe = m.username?.toLowerCase() === myUsername;

                                return (
                                    <div key={m.username} className="wa-group-member-item">
                                        <div 
                                            className="wa-group-member-avatar"
                                            style={{ backgroundColor: m.avatarColor || '#10b981' }}
                                        >
                                            {m.avatarUrl ? (
                                                <img src={m.avatarUrl} alt={m.username} className="wa-avatar-img" />
                                            ) : (
                                                m.username.slice(0, 2).toUpperCase()
                                            )}
                                        </div>
                                        <div className="wa-group-member-info">
                                            <div className="wa-group-member-row">
                                                <span className="wa-group-member-name">
                                                    {m.fullName || m.username} {isMe && '(You)'}
                                                </span>
                                                {isMemberAdmin && (
                                                    <span className="wa-admin-badge">
                                                        <ShieldCheck size={12} />
                                                        <span>Group Admin</span>
                                                    </span>
                                                )}
                                            </div>
                                            <span className="wa-group-member-handle">@{m.username}</span>
                                        </div>
                                        {isAdmin && !isMe && (
                                            <button 
                                                type="button" 
                                                className="wa-remove-member-btn"
                                                title={`Remove @${m.username}`}
                                                onClick={() => handleRemoveMember(m.username)}
                                            >
                                                Remove
                                            </button>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Exit Group Button */}
                    <div className="wa-group-info-card wa-group-exit-card">
                        <button 
                            type="button" 
                            className="wa-group-exit-btn"
                            onClick={() => setConfirmExit(true)}
                        >
                            <LogOut size={18} />
                            <span>Exit group</span>
                        </button>
                    </div>
                </div>

                {/* Add Member Drawer/Submodal */}
                {isAddMemberOpen && (
                    <div className="wa-modal-backdrop submodal" onClick={() => setIsAddMemberOpen(false)}>
                        <div className="wa-group-add-member-modal" onClick={(e) => e.stopPropagation()}>
                            <div className="wa-group-add-member-header">
                                <button 
                                    type="button" 
                                    className="wa-close-btn" 
                                    onClick={() => setIsAddMemberOpen(false)}
                                >
                                    <X size={20} />
                                </button>
                                <h3>Add participants</h3>
                            </div>

                            <div className="wa-search-section">
                                <div className="wa-search-box">
                                    <Search size={16} className="wa-search-icon" />
                                    <input 
                                        type="text" 
                                        placeholder="Search contacts to add..." 
                                        value={searchAddUser}
                                        onChange={(e) => setSearchAddUser(e.target.value)}
                                        autoFocus
                                    />
                                </div>
                            </div>

                            {errorMsg && <div className="wa-modal-error">{errorMsg}</div>}

                            <div className="wa-group-candidate-list">
                                {nonMemberUsers.length === 0 ? (
                                    <div className="wa-group-empty-candidates">
                                        No new contacts available to add
                                    </div>
                                ) : (
                                    nonMemberUsers.map((u) => {
                                        const isSelected = selectedAddUsers.includes(u.username);
                                        return (
                                            <div 
                                                key={u.username} 
                                                className={`wa-candidate-item ${isSelected ? 'selected' : ''}`}
                                                onClick={() => handleToggleAddUser(u.username)}
                                                role="button"
                                                tabIndex={0}
                                            >
                                                <div 
                                                    className="wa-candidate-avatar"
                                                    style={{ backgroundColor: u.color || '#10b981' }}
                                                >
                                                    {u.avatarUrl ? (
                                                        <img src={u.avatarUrl} alt={u.username} className="wa-avatar-img" />
                                                    ) : (
                                                        u.username.slice(0, 2).toUpperCase()
                                                    )}
                                                </div>
                                                <div className="wa-candidate-info">
                                                    <span className="wa-candidate-name">{u.fullName || u.username}</span>
                                                    <span className="wa-candidate-sub">@{u.username}</span>
                                                </div>
                                                <div className={`wa-checkbox ${isSelected ? 'checked' : ''}`}>
                                                    {isSelected && <Check size={14} color="#fff" />}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>

                            <div className="wa-modal-actions">
                                <button 
                                    type="button" 
                                    className="wa-modal-btn-cancel"
                                    onClick={() => setIsAddMemberOpen(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="wa-modal-btn-confirm"
                                    disabled={selectedAddUsers.length === 0 || isSubmitting}
                                    onClick={handleConfirmAddMembers}
                                >
                                    {isSubmitting ? (
                                        <>
                                            <Loader2 size={16} className="spin" />
                                            <span>Adding...</span>
                                        </>
                                    ) : (
                                        `Add (${selectedAddUsers.length})`
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Exit Group Confirmation */}
                {confirmExit && (
                    <div className="wa-modal-backdrop submodal" onClick={() => setConfirmExit(false)}>
                        <div className="wa-modal-box" onClick={(e) => e.stopPropagation()}>
                            <h3 className="wa-modal-title">Exit "{group.name}" group?</h3>
                            <p className="wa-modal-desc">
                                You will no longer be able to send or receive messages in this group.
                            </p>
                            <div className="wa-modal-actions">
                                <button 
                                    type="button" 
                                    className="wa-modal-btn-cancel" 
                                    onClick={() => setConfirmExit(false)}
                                >
                                    Cancel
                                </button>
                                <button 
                                    type="button" 
                                    className="wa-modal-btn-danger" 
                                    onClick={handleExitGroup}
                                >
                                    Exit Group
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
