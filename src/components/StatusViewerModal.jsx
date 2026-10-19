import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { 
    X, 
    ChevronLeft, 
    ChevronRight, 
    Trash2, 
    Send, 
    Play, 
    Pause, 
    Volume2, 
    VolumeX 
} from 'lucide-react';
import VerifiedBadge from './VerifiedBadge';

export function formatTimeAgo(ts) {
    if (!ts) return 'Just now';
    const diff = Math.max(0, Math.floor((Date.now() - ts) / 1000));
    if (diff < 60) return 'Just now';
    const mins = Math.floor(diff / 60);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export default function StatusViewerModal({ 
    isOpen, 
    onClose, 
    statusList = [], 
    initialIndex = 0,
    currentUser = null 
}) {
    const { markStatusViewed, deleteStatus, sendMessage, selectChat } = useSocket();

    const [currentIndex, setCurrentIndex] = useState(initialIndex);
    const [progress, setProgress] = useState(0);
    const [isPaused, setIsPaused] = useState(false);
    const [replyText, setReplyText] = useState('');
    const [isAudioPlaying, setIsAudioPlaying] = useState(false);
    const [isAudioMuted, setIsAudioMuted] = useState(false);

    const audioRef = useRef(null);
    const progressIntervalRef = useRef(null);
    const currentStatus = statusList[currentIndex] || null;

    useEffect(() => {
        setCurrentIndex(initialIndex);
        setProgress(0);
    }, [initialIndex, isOpen]);

    // Mark current status as viewed
    useEffect(() => {
        if (currentStatus && isOpen) {
            markStatusViewed(currentStatus.id);
        }
    }, [currentStatus, isOpen, markStatusViewed]);

    const handleNext = useCallback(() => {
        if (currentIndex < statusList.length - 1) {
            setCurrentIndex((prev) => prev + 1);
            setProgress(0);
        } else {
            onClose();
        }
    }, [currentIndex, statusList.length, onClose]);

    const handlePrev = useCallback(() => {
        if (currentIndex > 0) {
            setCurrentIndex((prev) => prev - 1);
            setProgress(0);
        }
    }, [currentIndex]);

    // Keyboard navigation (ArrowLeft / ArrowRight / Escape)
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'ArrowRight') handleNext();
            if (e.key === 'ArrowLeft') handlePrev();
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, handleNext, handlePrev, onClose]);

    // 6-Second Auto Progress Timer
    useEffect(() => {
        if (!isOpen || !currentStatus || isPaused) return;

        const DURATION = currentStatus.type === 'voice' ? 12000 : 6000;
        const STEP_INTERVAL = 40;
        const stepProgress = 100 / (DURATION / STEP_INTERVAL);

        progressIntervalRef.current = setInterval(() => {
            setProgress((prev) => {
                if (prev >= 100) {
                    clearInterval(progressIntervalRef.current);
                    handleNext();
                    return 0;
                }
                return prev + stepProgress;
            });
        }, STEP_INTERVAL);

        return () => clearInterval(progressIntervalRef.current);
    }, [isOpen, currentStatus, isPaused, handleNext]);

    if (!isOpen || !currentStatus) return null;

    const myUsername = (currentUser?.username || '').toLowerCase();
    const isOwner = (currentStatus.username || '').toLowerCase() === myUsername;

    const handleQuickReaction = (emoji) => {
        if (isOwner) return;
        sendMessage({
            text: `${emoji} (Reacted to story: "${currentStatus.text || currentStatus.type}")`,
            replyTo: {
                id: currentStatus.id,
                username: currentStatus.username,
                text: currentStatus.text || `Story (${currentStatus.type})`
            }
        });
        selectChat({
            type: 'dm',
            partnerName: currentStatus.username,
            partnerColor: currentStatus.avatarColor
        });
        onClose();
    };

    const handleSendReply = (e) => {
        e.preventDefault();
        if (!replyText.trim() || isOwner) return;

        sendMessage({
            text: replyText.trim(),
            replyTo: {
                id: currentStatus.id,
                username: currentStatus.username,
                text: currentStatus.text || `Story (${currentStatus.type})`
            }
        });
        selectChat({
            type: 'dm',
            partnerName: currentStatus.username,
            partnerColor: currentStatus.avatarColor
        });
        setReplyText('');
        onClose();
    };

    const handleDelete = () => {
        if (window.confirm("Delete this status update?")) {
            deleteStatus(currentStatus.id);
            if (statusList.length <= 1) {
                onClose();
            } else {
                handleNext();
            }
        }
    };

    return (
        <div 
            className="wa-story-backdrop"
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
        >
            <div className="wa-story-container" style={{ background: currentStatus.bgGradient || '#111b21' }}>
                {/* Top Segmented Progress Bars */}
                <div className="wa-story-progress-row">
                    {statusList.map((st, idx) => (
                        <div key={st.id || idx} className="wa-story-bar-track">
                            <div 
                                className="wa-story-bar-fill"
                                style={{
                                    width: idx < currentIndex ? '100%' : (idx === currentIndex ? `${progress}%` : '0%')
                                }}
                            />
                        </div>
                    ))}
                </div>

                {/* Story Top Header Bar */}
                <div className="wa-story-header">
                    <div className="wa-story-user-meta">
                        <div 
                            className="wa-story-avatar" 
                            style={{ backgroundColor: currentStatus.avatarColor || '#00a884' }}
                        >
                            {currentStatus.avatarUrl ? (
                                <img src={currentStatus.avatarUrl} alt={currentStatus.username} />
                            ) : (
                                currentStatus.username.slice(0, 2).toUpperCase()
                            )}
                        </div>
                        <div className="wa-story-user-names">
                            <div className="wa-story-username-row">
                                <span className="wa-story-author">{currentStatus.username}</span>
                                {currentStatus.username?.toLowerCase() === 'chathub' && (
                                    <VerifiedBadge size={14} />
                                )}
                            </div>
                            <span className="wa-story-time">{formatTimeAgo(currentStatus.createdAt)}</span>
                        </div>
                    </div>

                    <div className="wa-story-header-actions" onMouseDown={(e) => e.stopPropagation()}>
                        {isOwner && (
                            <button
                                type="button"
                                className="wa-story-icon-btn delete-btn"
                                title="Delete status"
                                onClick={handleDelete}
                            >
                                <Trash2 size={18} />
                            </button>
                        )}
                        <button
                            type="button"
                            className="wa-story-icon-btn close-btn"
                            title="Close"
                            onClick={onClose}
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>

                {/* Left & Right Tap Zones for Navigation */}
                <div className="wa-story-nav-zone left" onClick={(e) => { e.stopPropagation(); handlePrev(); }}>
                    {currentIndex > 0 && <ChevronLeft size={28} className="nav-arrow-hint" />}
                </div>
                <div className="wa-story-nav-zone right" onClick={(e) => { e.stopPropagation(); handleNext(); }}>
                    {currentIndex < statusList.length - 1 && <ChevronRight size={28} className="nav-arrow-hint" />}
                </div>

                {/* Main Content Area */}
                <div className="wa-story-content-body">
                    {/* 1. Voice Drop Story */}
                    {currentStatus.type === 'voice' && currentStatus.audio && (
                        <div className="wa-story-voice-card">
                            <div className="wa-story-voice-disc">
                                <div className={`disc-vinyl ${isAudioPlaying ? 'spinning' : ''}`}>
                                    <div className="disc-center-dot" />
                                </div>
                            </div>
                            <div className="wa-story-voice-wave">
                                <span></span><span></span><span></span><span></span><span></span>
                            </div>
                            <audio 
                                ref={audioRef}
                                src={currentStatus.audio}
                                autoPlay
                                onPlay={() => setIsAudioPlaying(true)}
                                onPause={() => setIsAudioPlaying(false)}
                                onEnded={() => {
                                    setIsAudioPlaying(false);
                                    handleNext();
                                }}
                            />
                            <div className="wa-story-voice-info">
                                <span className="voice-title">🎙️ 15s Voice Drop</span>
                                <span className="voice-duration">{currentStatus.audioDuration || '0:15'}</span>
                            </div>
                        </div>
                    )}

                    {/* 2. Text / Thought / Vibe Story */}
                    {currentStatus.text && (
                        <div className="wa-story-text-container">
                            <p className="wa-story-main-text">{currentStatus.text}</p>
                        </div>
                    )}

                    {/* 3. Photo Story */}
                    {currentStatus.image && (
                        <div className="wa-story-image-wrap">
                            <img src={currentStatus.image} alt="Story visual" />
                        </div>
                    )}
                </div>

                {/* Bottom DM Reply Bar (Only for other contacts' statuses) */}
                {!isOwner && (
                    <div className="wa-story-bottom-bar" onMouseDown={(e) => e.stopPropagation()}>
                        <div className="wa-story-quick-reactions">
                            {['❤️', '🔥', '😂', '👏', '🚀', '💯'].map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    className="wa-story-emoji-chip"
                                    onClick={() => handleQuickReaction(emoji)}
                                >
                                    {emoji}
                                </button>
                            ))}
                        </div>
                        <form className="wa-story-reply-form" onSubmit={handleSendReply}>
                            <input 
                                type="text"
                                placeholder={`Reply to ${currentStatus.username}...`}
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                            />
                            <button type="submit" disabled={!replyText.trim()}>
                                <Send size={16} />
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
}
