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
    UserMinus,
    Languages,
    Loader2
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

export const TRANSLATE_LANGUAGES = [
    { code: 'hi', name: 'Hindi', native: 'हिन्दी' },
    { code: 'en', name: 'English', native: 'English' },
    { code: 'es', name: 'Spanish', native: 'Español' },
    { code: 'fr', name: 'French', native: 'Français' },
    { code: 'de', name: 'German', native: 'Deutsch' },
    { code: 'ar', name: 'Arabic', native: 'العربية' },
    { code: 'ur', name: 'Urdu', native: 'اردو' },
    { code: 'bn', name: 'Bengali', native: 'বাংলা' },
    { code: 'mr', name: 'Marathi', native: 'मराठी' },
    { code: 'gu', name: 'Gujarati', native: 'ગુજરાતી' },
    { code: 'pa', name: 'Punjabi', native: 'ਪੰਜਾਬੀ' },
    { code: 'ru', name: 'Russian', native: 'Русский' }
];

async function executeTranslation(rawText, targetCode) {
    if (!rawText || !rawText.trim()) return '';
    const clean = rawText.trim();

    // 1. First try ChatHub backend API
    try {
        const res = await fetch('/api/ai/translate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text: clean, targetLang: targetCode })
        });
        if (res.ok) {
            const data = await res.json();
            if (data.translatedText && data.translatedText.trim() && data.translatedText.trim().toLowerCase() !== clean.toLowerCase()) {
                return data.translatedText.trim();
            }
        }
    } catch (_) {}

    // 2. High-speed Direct Google Translate with smart pivot for Hinglish
    try {
        const directUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetCode)}&dt=t&q=${encodeURIComponent(clean)}`;
        const gRes = await fetch(directUrl);
        if (gRes.ok) {
            const gData = await gRes.json();
            const direct = gData[0]?.map(s => s[0]).join('').trim();
            if (direct && direct.toLowerCase() !== clean.toLowerCase()) {
                return direct;
            }
            // Pivot Roman Hindi/Hinglish through English if target is not 'en'
            if (targetCode !== 'en') {
                const enUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=en&dt=t&q=${encodeURIComponent(clean)}`;
                const enRes = await fetch(enUrl);
                if (enRes.ok) {
                    const enData = await enRes.json();
                    const enText = enData[0]?.map(s => s[0]).join('').trim();
                    if (enText && enText.toLowerCase() !== clean.toLowerCase()) {
                        const pivotUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetCode)}&dt=t&q=${encodeURIComponent(enText)}`;
                        const pRes = await fetch(pivotUrl);
                        if (pRes.ok) {
                            const pData = await pRes.json();
                            const pDirect = pData[0]?.map(s => s[0]).join('').trim();
                            if (pDirect) return pDirect;
                        }
                        return enText;
                    }
                }
            }
        }
    } catch (_) {}

    // 3. Fallback to MyMemory translation
    try {
        const mmUrl = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(clean)}&langpair=autodetect|${encodeURIComponent(targetCode)}`;
        const mmRes = await fetch(mmUrl);
        if (mmRes.ok) {
            const mmData = await mmRes.json();
            if (mmData?.responseData?.translatedText && mmData.responseData.translatedText.toLowerCase() !== clean.toLowerCase()) {
                return mmData.responseData.translatedText;
            }
        }
    } catch (_) {}

    // 4. Intelligent dictionary fallback
    const lower = clean.toLowerCase();
    if (lower.includes("kaise ho") || lower.includes("kya haal hai")) {
        return targetCode === "hi" ? "आप कैसे हैं?" : "How are you doing?";
    } else if (lower.includes("thik hu") || lower.includes("sab badhiya")) {
        return targetCode === "hi" ? "मैं ठीक हूँ, सब अच्छा है।" : "I am doing well, everything is fine.";
    } else if (lower.includes("dhanyawaad") || lower.includes("shukriya")) {
        return targetCode === "hi" ? "धन्यवाद!" : "Thank you very much!";
    }

    return clean;
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

function highlightSearchMatch(text, query) {
    if (!query || !query.trim() || !text) return text;
    const cleanQ = query.trim();
    const escaped = cleanQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`(${escaped})`, 'gi');
    const parts = text.split(regex);
    if (parts.length <= 1) return text;
    return parts.map((part, i) => 
        regex.test(part) ? (
            <mark key={i} className="wa-search-highlight">{part}</mark>
        ) : part
    );
}

export default function MessageItem({ item, searchQuery = '' }) {
    const {
        currentUser,
        currentChat,
        socket,
        allRegisteredUsers,
        startChatWithUser,
        setReplyingTo,
        setEditingMessage,
        deleteMessage,
        deleteMessageForMe,
        toggleReaction,
        openedViewOnceIds,
        markViewOnceOpened,
        setLightboxData
    } = useSocket();

    const [isStarred, setIsStarred] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [translatedText, setTranslatedText] = useState(null);
    const [isTranslating, setIsTranslating] = useState(false);
    const [showTranslation, setShowTranslation] = useState(false);
    const [isLangMenuOpen, setIsLangMenuOpen] = useState(false);
    const [selectedLang, setSelectedLang] = useState(null);
    const langMenuRef = useRef(null);

    // Click outside listener for language selection menu
    useEffect(() => {
        const handleOutside = (e) => {
            if (langMenuRef.current && !langMenuRef.current.contains(e.target)) {
                setIsLangMenuOpen(false);
            }
        };
        if (isLangMenuOpen) {
            document.addEventListener('mousedown', handleOutside);
        }
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isLangMenuOpen]);

    // Handle user selecting target language
    const handleSelectLanguage = async (lang) => {
        if (!msg.text) return;
        setIsLangMenuOpen(false);
        setSelectedLang(lang);
        setIsTranslating(true);
        setShowTranslation(true);

        try {
            const result = await executeTranslation(msg.text, lang.code);
            setTranslatedText(result);
        } catch (err) {
            console.error("Translation error:", err);
        } finally {
            setIsTranslating(false);
        }
    };

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
            className={`message-row ${isSelf ? 'self' : 'other'} ${isLangMenuOpen ? 'row-menu-open' : ''}`}
            style={isLangMenuOpen ? { zIndex: 100, position: 'relative' } : {}}
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

                <div className={`msg-bubble-wrap ${isLangMenuOpen ? 'has-open-menu' : ''}`}>
                    {/* Hover Reaction & Actions Toolbar */}
                    {!msg.isDeleted && (
                        <div className={`reaction-toolbar ${isLangMenuOpen ? 'menu-open' : ''}`}>
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
                            {msg.text && (
                                <div className="wa-lang-anchor" ref={langMenuRef}>
                                    <button
                                        type="button"
                                        className={`msg-action-btn ${isLangMenuOpen || showTranslation ? 'active-translate' : ''}`}
                                        title="Translate into..."
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            setIsLangMenuOpen((prev) => !prev);
                                        }}
                                        disabled={isTranslating}
                                    >
                                        {isTranslating ? <Loader2 size={15} className="wa-spin" /> : <Languages size={15} />}
                                    </button>

                                    {isLangMenuOpen && (
                                        <div className="wa-lang-dropdown-menu" onClick={(e) => e.stopPropagation()}>
                                            <div className="wa-lang-header">
                                                <span>Translate to</span>
                                                {showTranslation && (
                                                    <button
                                                        type="button"
                                                        className="wa-lang-hide-btn"
                                                        onClick={() => {
                                                            setShowTranslation(false);
                                                            setIsLangMenuOpen(false);
                                                        }}
                                                    >
                                                        Hide
                                                    </button>
                                                )}
                                            </div>
                                            <div className="wa-lang-list">
                                                {TRANSLATE_LANGUAGES.map((lang) => (
                                                    <button
                                                        key={lang.code}
                                                        type="button"
                                                        className={`wa-lang-item ${selectedLang?.code === lang.code ? 'selected' : ''}`}
                                                        onClick={() => handleSelectLanguage(lang)}
                                                    >
                                                        <span className="lang-native">{lang.native}</span>
                                                        <span className="lang-name">{lang.name}</span>
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}
                            {isSelf && msg.text && (
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
                                title="Delete message"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDeleteModalOpen(true);
                                }}
                            >
                                <Trash2 size={15} />
                            </button>
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
                                    <>
                                        <div className="msg-text-content">
                                            {highlightSearchMatch(msg.text, searchQuery)}
                                            {msg.isEdited && <span className="edited-tag">(edited)</span>}
                                        </div>

                                        {isTranslating && (
                                            <div className="msg-translation-loading">
                                                <Loader2 size={12} className="wa-spin" />
                                                <span>Translating to {selectedLang?.name || 'language'}...</span>
                                            </div>
                                        )}

                                        {showTranslation && translatedText && !isTranslating && (
                                            <div className="msg-translation-block">
                                                <div className="msg-translation-meta">
                                                    <span className="msg-trans-meta-label">
                                                        <Languages size={11} />
                                                        <span>Translated to {selectedLang?.name || 'Language'}</span>
                                                    </span>
                                                    <div className="msg-trans-meta-actions">
                                                        <button
                                                            type="button"
                                                            className="msg-trans-change-btn"
                                                            title="Change language"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setIsLangMenuOpen(true);
                                                            }}
                                                        >
                                                            Change
                                                        </button>
                                                        <button
                                                            type="button"
                                                            className="msg-trans-close-btn"
                                                            title="Hide translation"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setShowTranslation(false);
                                                            }}
                                                        >
                                                            ×
                                                        </button>
                                                    </div>
                                                </div>
                                                <div className="msg-translation-text">
                                                    {translatedText}
                                                </div>
                                            </div>
                                        )}
                                    </>
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

            {/* In-App WhatsApp Style Delete Confirmation Modal */}
            {isDeleteModalOpen && (
                <div 
                    className="wa-modal-backdrop" 
                    onClick={(e) => {
                        e.stopPropagation();
                        setIsDeleteModalOpen(false);
                    }}
                    role="dialog"
                    aria-modal="true"
                >
                    <div 
                        className="wa-modal-box wa-delete-modal-box" 
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="wa-modal-title">Delete message?</h3>
                        <p className="wa-modal-desc">
                            {isSelf 
                                ? "You can delete this message for everyone or delete it just for yourself."
                                : "This message will be deleted for you only. Other participants will still be able to see it."
                            }
                        </p>
                        <div className="wa-modal-actions wa-delete-actions">
                            {isSelf && (
                                <button
                                    type="button"
                                    className="wa-modal-btn-danger"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsDeleteModalOpen(false);
                                        deleteMessage(msg.id);
                                    }}
                                >
                                    Delete for everyone
                                </button>
                            )}
                            <button
                                type="button"
                                className="wa-modal-btn-secondary"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDeleteModalOpen(false);
                                    deleteMessageForMe(msg.id);
                                }}
                            >
                                Delete for me
                            </button>
                            <button
                                type="button"
                                className="wa-modal-btn-cancel"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsDeleteModalOpen(false);
                                }}
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
