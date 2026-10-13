import React, { useState, useRef, useEffect } from 'react';
import { useSocket, QUICK_REACTIONS } from '../context/SocketContext';

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
                {isPlaying ? '⏸' : '▶'}
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

export default function MessageItem({ item }) {
    const {
        currentUser,
        socket,
        openDmWithUser,
        setReplyingTo,
        setEditingMessage,
        deleteMessage,
        toggleReaction,
        openedViewOnceIds,
        markViewOnceOpened,
        setLightboxData
    } = useSocket();

    // System Status message
    if (item.type === "status" || item.type === "system") {
        const s = item.data;
        const icon = s.status === 'joined' ? '⚡' : '👋';
        return (
            <div className="system-event">
                <span>{icon}</span>
                <strong>{s.username}</strong> {s.status === 'joined' ? 'joined the chat' : 'left the chat'}
                <span style={{ opacity: 0.7 }}>• {s.time}</span>
            </div>
        );
    }

    const msg = item.data;
    const isSelf = msg.senderId && (msg.senderId === socket?.id || msg.senderId === currentUser.id);
    const isOpenedViewOnce = msg.isViewOnce && (openedViewOnceIds.has(msg.id) || msg.viewOnceOpened);
    const initials = msg.username ? msg.username.slice(0, 2).toUpperCase() : '?';
    const avatarColor = msg.avatarColor || '#6366f1';

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
                    style={{ backgroundColor: avatarColor, cursor: 'pointer' }}
                    title="Click to chat privately"
                    onClick={() => {
                        if (msg.senderId) {
                            openDmWithUser({ id: msg.senderId, username: msg.username, color: avatarColor });
                        }
                    }}
                >
                    {initials}
                </div>
            )}

            <div className="msg-body">
                {!isSelf && (
                    <div
                        className="msg-sender-name"
                        title="Click to chat privately"
                        onClick={() => {
                            if (msg.senderId) {
                                openDmWithUser({ id: msg.senderId, username: msg.username, color: avatarColor });
                            }
                        }}
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
                                        text: msg.text || (msg.image ? '📷 Photo' : (msg.audio ? '🎙️ Voice Note' : 'Message'))
                                    });
                                }}
                            >
                                ↩️
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
                                            ✏️
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
                                        🗑️
                                    </button>
                                </>
                            )}
                        </div>
                    )}

                    <div className="msg-bubble">
                        {/* Deleted message state */}
                        {msg.isDeleted ? (
                            <span className="deleted-msg-text">🚫 This message was deleted</span>
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
                                            {isOpenedViewOnce ? '✓' : '①'}
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
                                    <span>{msg.time}</span>
                                    {isSelf && (
                                        <svg className="check-icon" viewBox="0 0 16 16">
                                            <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z" />
                                        </svg>
                                    )}
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
