import React, { useState, useRef, useEffect } from 'react';
import { useSocket, QUICK_REACTIONS } from '../context/SocketContext';
import { 
    Play, 
    Pause, 
    Reply, 
    Star, 
    Pencil, 
    Trash2, 
    Ban, 
    Eye, 
    Check, 
    UserCheck, 
    UserMinus 
} from 'lucide-react';

export function format12HourTime(timeStr, createdAt) {
    if (createdAt) {
        const d = new Date(createdAt);
        if (!isNaN(d.getTime())) {
            let h = d.getHours();
            const m = d.getMinutes();
            const ampm = h >= 12 ? 'PM' : 'AM';
            h = h % 12 || 12;
            return `${h}:${m < 10 ? '0' + m : m} ${ampm}`;
        }
    }
    if (!timeStr) return '';
    const upper = String(timeStr).toUpperCase();
    if (upper.includes('AM') || upper.includes('PM')) {
        return timeStr;
    }
    const match = String(timeStr).match(/^(\d{1,2}):(\d{2})/);
    if (match) {
        let h = parseInt(match[1], 10);
        const m = match[2];
        const ampm = h >= 12 ? 'PM' : 'AM';
        h = h % 12 || 12;
        return `${h}:${m} ${ampm}`;
    }
    return timeStr;
}

function VoiceNotePlayer({ audioSrc, durationText }) {
    const [isPlaying, setIsPlaying] = useState(false);
    const [currentTime, setCurrentTime] = useState('0:00');
    const [progressPercent, setProgressPercent] = useState(0);
    const audioRef = useRef(null);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        const onTimeUpdate = () => {
            if (audio.duration) {
                const percent = (audio.currentTime / audio.duration) * 100;
                setProgressPercent(percent);
                const s = Math.floor(audio.currentTime);
                setCurrentTime(`${Math.floor(s / 60)}:${s % 60 < 10 ? '0' : ''}${s % 60}`);
            }
        };

        const onEnded = () => {
            setIsPlaying(false);
            setProgressPercent(0);
            setCurrentTime('0:00');
        };

        audio.addEventListener('timeupdate', onTimeUpdate);
        audio.addEventListener('ended', onEnded);

        return () => {
            audio.removeEventListener('timeupdate', onTimeUpdate);
            audio.removeEventListener('ended', onEnded);
        };
    }, []);

    const togglePlay = (e) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio) return;

        if (isPlaying) {
            audio.pause();
            setIsPlaying(false);
        } else {
            // Stop other voice notes
            document.querySelectorAll('audio').forEach((a) => {
                if (a !== audio) a.pause();
            });
            audio.play().then(() => setIsPlaying(true)).catch(() => {});
        }
    };

    const handleSeek = (e) => {
        e.stopPropagation();
        const audio = audioRef.current;
        if (!audio || !audio.duration) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, clickX / rect.width));
        audio.currentTime = ratio * audio.duration;
    };

    return (
        <div className="voice-note-bubble">
            <audio ref={audioRef} src={audioSrc} preload="metadata" />
            <button
                type="button"
                className="voice-play-btn"
                onClick={togglePlay}
            >
                {isPlaying ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" style={{ marginLeft: '2px' }} />}
            </button>
            <div className="voice-track-area">
                <div className="voice-progress-bar" onClick={handleSeek}>
                    <div
                        className="voice-progress-fill"
                        style={{ width: `${progressPercent}%` }}
                    ></div>
                </div>
                <div className="voice-time-meta">
                    <span>{currentTime}</span>
                    <span>{durationText || 'Voice Note'}</span>
                </div>
            </div>
        </div>
    );
}

function WhatsAppStatusTick({ status }) {
    if (status === 'read') {
        return (
            <span className="wa-tick-wrap wa-tick-read" title="Read" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
                <svg viewBox="0 0 16 11" width="16" height="11" fill="none">
                    <path d="M1 5.5l3.5 3.5L11 1.5" stroke="#53bdeb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5.5 5.5l3.5 3.5L15.5 1.5" stroke="#53bdeb" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        );
    }
    if (status === 'delivered') {
        return (
            <span className="wa-tick-wrap wa-tick-delivered" title="Delivered" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
                <svg viewBox="0 0 16 11" width="16" height="11" fill="none">
                    <path d="M1 5.5l3.5 3.5L11 1.5" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M5.5 5.5l3.5 3.5L15.5 1.5" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
            </span>
        );
    }
    // Default: 'sent' -> Single gray check
    return (
        <span className="wa-tick-wrap wa-tick-sent" title="Sent" style={{ display: 'inline-flex', alignItems: 'center', marginLeft: 4 }}>
            <svg viewBox="0 0 12 11" width="12" height="11" fill="none">
                <path d="M1 5.5l3.5 3.5L11 1.5" stroke="rgba(255,255,255,0.65)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
        </span>
    );
}

export default function MessageItem({ item }) {
    const {
        currentUser,
        currentChat,
        socket,
        allRegisteredUsers,
        startChatWithUser,
        setReplyingTo,
        setEditingMessage,
        deleteMessage,
        toggleReaction,
        openedViewOnceIds,
        markViewOnceOpened,
        setLightboxData
    } = useSocket();

    const [isStarred, setIsStarred] = useState(false);

    useEffect(() => {
        if (!item?.data?.id) return;
        try {
            const key = `chathub_starred_msgs_${currentUser?.username || 'guest'}`;
            const saved = JSON.parse(localStorage.getItem(key) || '[]');
            setIsStarred(saved.some((m) => m.id === item.data.id));
        } catch {}
    }, [item?.data?.id, currentUser]);

    const handleToggleStar = (e) => {
        e.stopPropagation();
        if (!item?.data?.id) return;
        const key = `chathub_starred_msgs_${currentUser?.username || 'guest'}`;
        try {
            const saved = JSON.parse(localStorage.getItem(key) || '[]');
            let next;
            if (isStarred) {
                next = saved.filter((m) => m.id !== item.data.id);
                setIsStarred(false);
            } else {
                next = [
                    ...saved,
                    {
                        id: item.data.id,
                        text: item.data.text || (item.data.image ? '📷 Photo' : (item.data.audio ? '🎙️ Voice Note' : 'Message')),
                        username: item.data.username,
                        time: item.data.time || 'Recent',
                        chatType: currentChat?.type || 'general',
                        partnerName: currentChat?.partnerName || item.data.username
                    }
                ];
                setIsStarred(true);
            }
            localStorage.setItem(key, JSON.stringify(next));
            window.dispatchEvent(new Event('storage'));
        } catch {}
    };

    // System Status message
    if (item.type === "status" || item.type === "system") {
        const s = item.data;
        return (
            <div className="system-event">
                {s.status === 'joined' ? (
                    <UserCheck size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle', color: '#10b981' }} />
                ) : (
                    <UserMinus size={14} style={{ display: 'inline', marginRight: '5px', verticalAlign: 'middle', color: '#94a3b8' }} />
                )}
                <strong>{s.username}</strong> {s.status === 'joined' ? 'joined the chat' : 'left the chat'}
                <span style={{ opacity: 0.7 }}>• {format12HourTime(s.time)}</span>
            </div>
        );
    }

    const msg = item.data;
    const isSelf = Boolean(
        (currentUser?.username && msg.username && msg.username.toLowerCase() === currentUser.username.toLowerCase()) ||
        (msg.senderId && (msg.senderId === socket?.id || msg.senderId === currentUser?.id))
    );
    const isOpenedViewOnce = msg.isViewOnce && (openedViewOnceIds.has(msg.id) || msg.viewOnceOpened);
    const userProfile = allRegisteredUsers?.find(
        (u) => u.username?.toLowerCase() === msg.username?.toLowerCase()
    );
    const avatarUrl = msg.avatarUrl || userProfile?.avatarUrl || '';
    const initials = msg.username ? msg.username.slice(0, 2).toUpperCase() : '?';
    const avatarColor = msg.avatarColor || userProfile?.color || '#6366f1';

    const handleOpenDm = () => {
        if (startChatWithUser) {
            startChatWithUser(userProfile || {
                id: msg.senderId,
                username: msg.username,
                color: avatarColor,
                avatarUrl: avatarUrl
            });
        }
    };

    // Handle View Once click
    const handleViewOnceClick = () => {
        if (isOpenedViewOnce) return;
        markViewOnceOpened(msg.id);
        setLightboxData({
            src: msg.image,
            title: `${msg.username}'s Photo`,
            isViewOnce: true,
            msgId: msg.id
        });
    };

    // Handle normal photo click
    const handleImageClick = () => {
        setLightboxData({
            src: msg.image,
            title: `${msg.username}'s Photo`,
            isViewOnce: false,
            msgId: msg.id
        });
    };

    // Scroll to quoted message
    const handleQuoteClick = (quoteId) => {
        const el = document.getElementById(`row-${quoteId}`);
        if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            el.style.transition = 'transform 0.3s ease';
            el.style.transform = 'scale(1.04)';
            setTimeout(() => {
                el.style.transform = 'none';
            }, 600);
        }
    };

    return (
        <div
            id={`row-${msg.id}`}
            className={`message-row ${isSelf ? 'self' : 'other'}`}
        >
            {!isSelf && (
                <div
                    className="msg-avatar"
                    style={{ backgroundColor: avatarColor, cursor: 'pointer', overflow: 'hidden' }}
                    title={`Chat with ${msg.username}`}
                    onClick={handleOpenDm}
                >
                    {avatarUrl ? (
                        <img 
                            src={avatarUrl} 
                            alt={msg.username} 
                            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
                            onError={(e) => { e.currentTarget.style.display = 'none'; }}
                        />
                    ) : initials}
                </div>
            )}

            <div className="msg-body">
                {!isSelf && (
                    <div
                        className="msg-sender-name"
                        title={`Chat with ${msg.username}`}
                        onClick={handleOpenDm}
                    >
                        {msg.username}
                    </div>
                )}

                <div className="msg-bubble-wrap">
                    {/* Hover Reaction & Actions Toolbar */}
                    {!msg.isDeleted && (
                        <div className="reaction-toolbar">
                            {QUICK_REACTIONS.map((emoji) => (
                                <button
                                    key={emoji}
                                    type="button"
                                    className="react-btn"
                                    title={`React with ${emoji}`}
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggleReaction(msg.id, emoji);
                                    }}
                                >
                                    {emoji}
                                </button>
                            ))}
                            <button
                                type="button"
                                className="msg-action-btn"
                                title="Reply"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setReplyingTo({
                                        id: msg.id,
                                        username: msg.username,
                                        text: msg.text || (msg.image ? 'Photo' : (msg.audio ? 'Voice Note' : 'Message'))
                                    });
                                }}
                            >
                                <Reply size={15} />
                            </button>
                            <button
                                type="button"
                                className={`msg-action-btn ${isStarred ? 'starred' : ''}`}
                                title={isStarred ? "Unstar Message" : "Star Message"}
                                onClick={handleToggleStar}
                            >
                                <Star size={15} fill={isStarred ? "#f59e0b" : "none"} color={isStarred ? "#f59e0b" : "currentColor"} />
                            </button>
                            {isSelf && (
                                <>
                                    {msg.text && (
                                        <button
                                            type="button"
                                            className="msg-action-btn"
                                            title="Edit"
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                setEditingMessage({ id: msg.id, text: msg.text });
                                            }}
                                        >
                                            <Pencil size={15} />
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        className="msg-action-btn"
                                        title="Delete for everyone"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            if (window.confirm("Delete this message for everyone?")) {
                                                deleteMessage(msg.id);
                                            }
                                        }}
                                    >
                                        <Trash2 size={15} />
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    <div className="msg-bubble">
                        {/* Deleted message state */}
                        {msg.isDeleted ? (
                            <span className="deleted-msg-text">
                                <Ban size={15} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle' }} />
                                This message was deleted
                            </span>
                        ) : (
                            <>
                                {/* Quoted / Reply Preview */}
                                {msg.replyTo && (
                                    <div
                                        className="msg-quote-card"
                                        onClick={() => handleQuoteClick(msg.replyTo.id)}
                                    >
                                        <span className="quote-sender">{msg.replyTo.username}</span>
                                        <span className="quote-text">{msg.replyTo.text}</span>
                                    </div>
                                )}

                                {/* View Once Photo Capsule */}
                                {msg.isViewOnce && msg.image && (
                                    <div
                                        className={`view-once-capsule ${isOpenedViewOnce ? 'opened' : ''}`}
                                        onClick={handleViewOnceClick}
                                    >
                                        <div className="capsule-icon">
                                            {isOpenedViewOnce ? <Check size={14} /> : <Eye size={14} />}
                                        </div>
                                        <div className="capsule-text">
                                            <span className="capsule-title">Photo</span>
                                            <span className="capsule-subtitle">
                                                {isOpenedViewOnce ? 'Opened' : 'View once'}
                                            </span>
                                        </div>
                                    </div>
                                )}

                                {/* Standard Image Thumbnail */}
                                {!msg.isViewOnce && msg.image && (
                                    <div className="msg-image-wrap" onClick={handleImageClick}>
                                        <img src={msg.image} alt="Attachment" className="msg-image" loading="lazy" />
                                    </div>
                                )}

                                {/* Voice Note Audio */}
                                {msg.audio && (
                                    <VoiceNotePlayer
                                        audioSrc={msg.audio}
                                        durationText={msg.audioDuration}
                                    />
                                )}

                                {/* Text message */}
                                {msg.text && (
                                    <div className="msg-text-content">
                                        {msg.text}
                                        {msg.isEdited && <span className="edited-tag">(edited)</span>}
                                    </div>
                                )}

                                {/* Metadata & Checkmark */}
                                <div className="msg-meta">
                                    {isStarred && (
                                        <span className="msg-star-badge" title="Starred">
                                            <Star size={11} fill="#f59e0b" color="#f59e0b" style={{ display: 'inline', verticalAlign: 'middle', marginRight: '3px' }} />
                                        </span>
                                    )}
                                    <span>{format12HourTime(msg.time, msg.createdAt)}</span>
                                    {isSelf && <WhatsAppStatusTick status={msg.status} />}
                                </div>
                            </>
                        )}
                    </div>
                </div>

                {/* Reaction Pills below bubble */}
                {!msg.isDeleted && msg.reactions && Object.keys(msg.reactions).length > 0 && (
                    <div className="reaction-pills-container">
                        {Object.entries(msg.reactions).map(([emoji, userIds]) => {
                            if (!userIds || userIds.length === 0) return null;
                            const hasMyVote = userIds.includes(socket?.id || currentUser.id);

                            return (
                                <button
                                    key={emoji}
                                    type="button"
                                    className={`reaction-pill ${hasMyVote ? 'active' : ''}`}
                                    onClick={() => toggleReaction(msg.id, emoji)}
                                >
                                    <span>{emoji}</span>
                                    <span className="pill-count">{userIds.length}</span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
