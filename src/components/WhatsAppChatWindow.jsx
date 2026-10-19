import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';
import { 
    Sparkles, 
    Phone, 
    Video, 
    ArrowLeft, 
    Search, 
    X, 
    ChevronUp, 
    ChevronDown, 
    MoreVertical, 
    Ban, 
    Eraser, 
    Trash2 
} from 'lucide-react';
import MessagesContainer from './MessagesContainer';
import TypingBar from './TypingBar';
import ChatFooter from './ChatFooter';
import VerifiedBadge from './VerifiedBadge';

export default function WhatsAppChatWindow({ isAiOpen, setIsAiOpen }) {
    const { 
        currentChat, 
        selectChat, 
        onlineUsers, 
        allRegisteredUsers,
        conversations,
        clearConversation,
        deleteConversation,
        blockUser,
        unblockUser,
        blockedUsers
    } = useSocket();
    const { initiateCall } = useWebRTC();

    // In-Chat Search state
    const [isSearching, setIsSearching] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [currentMatchIndex, setCurrentMatchIndex] = useState(0);

    // Three-Dots Menu state
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef(null);
    const searchInputRef = useRef(null);

    // Close menu on click outside or escape
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (menuRef.current && !menuRef.current.contains(e.target)) {
                setIsMenuOpen(false);
            }
        };
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') {
                setConfirmModal(null);
                setIsMenuOpen(false);
                setIsSearching(false);
                setSearchQuery('');
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        window.addEventListener('keydown', handleKeyDown);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    // Focus input when searching becomes true
    useEffect(() => {
        if (isSearching && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isSearching]);

    if (!currentChat) return null;

    const isDm = currentChat.type === 'dm';
    const partnerName = isDm ? currentChat.partnerName : 'ChatHub Community';
    const registeredPartner = isDm 
        ? allRegisteredUsers?.find((u) => u.username?.toLowerCase() === currentChat.partnerName?.toLowerCase())
        : null;
    const partnerAvatarUrl = currentChat.partnerAvatarUrl || registeredPartner?.avatarUrl || '';
    const isOnline = isDm && onlineUsers.some(
        (u) => u.username?.toLowerCase() === currentChat.partnerName?.toLowerCase()
    );
    const initials = isDm ? partnerName.slice(0, 2).toUpperCase() : '#';
    const avatarColor = currentChat.partnerColor || registeredPartner?.color || '#00a884';

    const activeKey = !currentChat || currentChat.type === 'general'
        ? 'general'
        : (currentChat.partnerName ? currentChat.partnerName.toLowerCase() : (currentChat.partnerId || 'dm'));
    const activeList = conversations[activeKey] || [];

    // Filter matching message IDs for navigation
    const matchingMessageIds = useMemo(() => {
        if (!searchQuery.trim()) return [];
        const q = searchQuery.toLowerCase().trim();
        const ids = [];
        activeList.forEach((item) => {
            if (item.type === 'message' && item.data && !item.data.isDeleted) {
                const text = (item.data.text || '').toLowerCase();
                if (text.includes(q)) {
                    ids.push(item.data.id);
                }
            }
        });
        return ids;
    }, [activeList, searchQuery]);

    // Scroll to matching message
    const scrollToMatch = useCallback((index) => {
        if (!matchingMessageIds.length) return;
        const targetId = matchingMessageIds[index];
        if (!targetId) return;
        const el = document.getElementById(`row-${targetId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.classList.add('search-match-active');
            setTimeout(() => {
                el.classList.remove('search-match-active');
            }, 1800);
        }
    }, [matchingMessageIds]);

    // When query changes, select newest match
    useEffect(() => {
        if (matchingMessageIds.length > 0) {
            const latestIdx = matchingMessageIds.length - 1;
            setCurrentMatchIndex(latestIdx);
            scrollToMatch(latestIdx);
        } else {
            setCurrentMatchIndex(0);
        }
    }, [matchingMessageIds, scrollToMatch]);

    const handleNextMatch = () => {
        if (!matchingMessageIds.length) return;
        const nextIdx = (currentMatchIndex + 1) % matchingMessageIds.length;
        setCurrentMatchIndex(nextIdx);
        scrollToMatch(nextIdx);
    };

    const handlePrevMatch = () => {
        if (!matchingMessageIds.length) return;
        const prevIdx = (currentMatchIndex - 1 + matchingMessageIds.length) % matchingMessageIds.length;
        setCurrentMatchIndex(prevIdx);
        scrollToMatch(prevIdx);
    };

    const handleCloseSearch = () => {
        setIsSearching(false);
        setSearchQuery('');
        setCurrentMatchIndex(0);
    };

    const handleToggleSearch = () => {
        setIsSearching((prev) => {
            const next = !prev;
            if (!next) {
                setSearchQuery('');
                setCurrentMatchIndex(0);
            }
            return next;
        });
    };

    // Confirmation Modal state for Clear / Delete Chat
    const [confirmModal, setConfirmModal] = useState(null);

    // Context Menu Handlers
    const isUserBlocked = isDm && blockedUsers?.includes(partnerName.toLowerCase());

    const handleBlockUser = () => {
        setIsMenuOpen(false);
        if (!isDm) {
            alert("ChatHub Community channel cannot be blocked.");
            return;
        }
        if (isUserBlocked) {
            unblockUser(partnerName);
        } else {
            setConfirmModal({
                type: 'block',
                title: `Block ${partnerName}?`,
                message: `Blocked contacts will no longer be able to send you messages or call you.`,
                confirmText: 'Block'
            });
        }
    };

    const handleClearChat = () => {
        setIsMenuOpen(false);
        setConfirmModal({
            type: 'clear',
            title: 'Clear this chat?',
            message: 'Are you sure you want to clear this chat?',
            confirmText: 'Clear'
        });
    };

    const handleDeleteChat = () => {
        setIsMenuOpen(false);
        setConfirmModal({
            type: 'delete',
            title: 'Delete this chat?',
            message: `Are you sure you want to delete this chat with ${partnerName}?`,
            confirmText: 'Delete'
        });
    };

    const handleConfirmAction = () => {
        if (!confirmModal) return;
        if (confirmModal.type === 'clear') {
            clearConversation(activeKey);
        } else if (confirmModal.type === 'delete') {
            deleteConversation(activeKey);
        } else if (confirmModal.type === 'block') {
            blockUser(partnerName);
        }
        setConfirmModal(null);
    };

    return (
        <section className="whatsapp-chat-stage">
            {/* WhatsApp Chat Header */}
            <header className="whatsapp-chat-header">
                {isSearching ? (
                    <div className="wa-header-search-container">
                        <div className="wa-inchat-search-box">
                            <Search size={16} className="wa-inchat-search-icon" />
                            <input 
                                ref={searchInputRef}
                                type="text"
                                className="wa-inchat-search-input"
                                placeholder="Search in chat..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                            {searchQuery.trim() && (
                                <span className="wa-inchat-search-count">
                                    {matchingMessageIds.length > 0 
                                        ? `${currentMatchIndex + 1} of ${matchingMessageIds.length}` 
                                        : '0 results'}
                                </span>
                            )}
                            {matchingMessageIds.length > 0 && (
                                <div className="wa-inchat-nav-arrows">
                                    <button
                                        type="button"
                                        className="wa-search-arrow-btn"
                                        onClick={handlePrevMatch}
                                        title="Previous match"
                                    >
                                        <ChevronUp size={16} />
                                    </button>
                                    <button
                                        type="button"
                                        className="wa-search-arrow-btn"
                                        onClick={handleNextMatch}
                                        title="Next match"
                                    >
                                        <ChevronDown size={16} />
                                    </button>
                                </div>
                            )}
                            <button
                                type="button"
                                className="wa-inchat-close-btn"
                                onClick={handleCloseSearch}
                                title="Exit search"
                            >
                                <X size={18} />
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="chat-header-left">
                        {/* Mobile Back Button (Returns to Sidebar on <= 768px) */}
                        <button
                            type="button"
                            className="wa-mobile-back-btn"
                            title="Back to conversation list"
                            onClick={() => selectChat(null)}
                            aria-label="Back to conversation list"
                        >
                            <ArrowLeft size={20} />
                        </button>

                        <div
                            className="chat-avatar-circle"
                            style={{ backgroundColor: avatarColor, overflow: 'hidden' }}
                        >
                            {isDm ? (
                                partnerAvatarUrl ? (
                                    <img 
                                        src={partnerAvatarUrl} 
                                        alt={partnerName} 
                                        style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                    />
                                ) : initials
                            ) : (
                                <img 
                                    src="/chathub-logo.png" 
                                    alt="ChatHub Community" 
                                    style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
                                />
                            )}
                        </div>

                        <div className="chat-contact-info">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <h3>{partnerName}</h3>
                                {!isDm && (
                                    <VerifiedBadge size={17} />
                                )}
                            </div>
                            <span className="contact-status">
                                {isDm ? (isOnline ? 'online' : 'offline') : 'Official Community Channel'}
                            </span>
                        </div>
                    </div>
                )}

                {/* Right Call & AI Action Buttons + Three-Dots */}
                <div className="chat-header-actions" ref={menuRef}>
                    {/* In-Chat Search Icon Button */}
                    <button
                        type="button"
                        className={`wa-header-action-btn ${isSearching ? 'active' : ''}`}
                        title={isSearching ? 'Close search' : 'Search in chat'}
                        onClick={handleToggleSearch}
                        aria-label="Search in chat"
                    >
                        <Search size={18} />
                    </button>

                    {/* Minimalist Flat "Ask AI" Button (Outline Sparkles Icon) */}
                    <button
                        type="button"
                        className={`wa-header-action-btn wa-ask-ai-btn ${isAiOpen ? 'active' : ''}`}
                        title="Ask AI about this conversation"
                        onClick={() => setIsAiOpen((prev) => !prev)}
                        aria-label="Ask AI"
                    >
                        <Sparkles size={16} />
                        <span className="wa-btn-text">Ask AI</span>
                    </button>

                    {isDm && (
                        <>
                            <button
                                type="button"
                                className="wa-header-action-btn"
                                title="Start Voice Call"
                                onClick={() => initiateCall(false)}
                                aria-label="Start Voice Call"
                            >
                                <Phone size={17} />
                            </button>
                            <button
                                type="button"
                                className="wa-header-action-btn"
                                title="Start Video Call"
                                onClick={() => initiateCall(true)}
                                aria-label="Start Video Call"
                            >
                                <Video size={17} />
                            </button>
                        </>
                    )}

                    {/* Three-dots Context Menu Button & Dropdown */}
                    <div className="wa-menu-anchor" style={{ position: 'relative' }}>
                        <button
                            type="button"
                            className={`wa-header-action-btn ${isMenuOpen ? 'active' : ''}`}
                            title="More options"
                            onClick={() => setIsMenuOpen((prev) => !prev)}
                            aria-label="More options"
                        >
                            <MoreVertical size={18} />
                        </button>

                        {/* Dropdown Menu */}
                        {isMenuOpen && (
                            <div className="wa-header-dropdown-menu">
                                {isDm && (
                                    <button
                                        type="button"
                                        className="wa-header-menu-item"
                                        onClick={handleBlockUser}
                                    >
                                        <Ban size={16} />
                                        <span>{isUserBlocked ? 'Unblock User' : 'Block User'}</span>
                                    </button>
                                )}
                                <button
                                    type="button"
                                    className="wa-header-menu-item"
                                    onClick={handleClearChat}
                                >
                                    <Eraser size={16} />
                                    <span>Clear Chat</span>
                                </button>
                                <div className="wa-header-menu-divider" />
                                <button
                                    type="button"
                                    className="wa-header-menu-item danger"
                                    onClick={handleDeleteChat}
                                >
                                    <Trash2 size={16} />
                                    <span>Delete Chat</span>
                                </button>
                            </div>
                        )}
                    </div>
                </div>
            </header>

            {/* Messages Content Viewport */}
            <div className="whatsapp-messages-viewport">
                <MessagesContainer searchQuery={isSearching ? searchQuery : ''} />
                <TypingBar />
            </div>

            {/* Chat Input Footer */}
            <ChatFooter />

            {/* WhatsApp Confirmation Modal */}
            {confirmModal && (
                <div 
                    className="wa-modal-backdrop" 
                    onClick={() => setConfirmModal(null)}
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="wa-modal-title"
                >
                    <div 
                        className="wa-modal-box" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 id="wa-modal-title" className="wa-modal-title">
                            {confirmModal.title}
                        </h3>
                        <p className="wa-modal-desc">
                            {confirmModal.message}
                        </p>
                        <div className="wa-modal-actions">
                            <button
                                type="button"
                                className="wa-modal-btn-cancel"
                                onClick={() => setConfirmModal(null)}
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                className="wa-modal-btn-danger"
                                onClick={handleConfirmAction}
                                autoFocus
                            >
                                {confirmModal.confirmText}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
