import React, { useState, useRef, useMemo, useEffect } from 'react';
import { useSocket } from '../context/SocketContext';
import { 
    X, 
    Plus, 
    Sparkles, 
    Mic, 
    Trash2, 
    Check, 
    Send, 
    Smile, 
    Radio, 
    Eye 
} from 'lucide-react';
import StatusViewerModal, { formatTimeAgo } from './StatusViewerModal';
import VerifiedBadge from './VerifiedBadge';

const GRADIENT_PRESETS = [
    { id: 'indigo', name: 'Purple Vibe', value: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)' },
    { id: 'sunset', name: 'Sunset Ruby', value: 'linear-gradient(135deg, #f43f5e 0%, #fb923c 100%)' },
    { id: 'aurora', name: 'Emerald Aurora', value: 'linear-gradient(135deg, #059669 0%, #10b981 50%, #06b6d4 100%)' },
    { id: 'sapphire', name: 'Ocean Blue', value: 'linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)' },
    { id: 'cyber', name: 'Cyber Neon', value: 'linear-gradient(135deg, #d946ef 0%, #8b5cf6 50%, #06b6d4 100%)' },
    { id: 'oled', name: 'Midnight Dark', value: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)' }
];

const VIBE_EMOJIS = ['☕', '🎧', '💻', '🚀', '⚡', '🔥', '✨', '🎮', '💡', '🌴'];

export default function StatusDrawerModal({ isOpen, onClose }) {
    const { 
        statuses = [], 
        currentUser, 
        viewedStatusIds = new Set(), 
        postStatus, 
        deleteStatus 
    } = useSocket();

    const [isComposerOpen, setIsComposerOpen] = useState(false);
    const [composerMode, setComposerMode] = useState('text'); // 'text' | 'voice'
    const [statusText, setStatusText] = useState('');
    const [selectedGradient, setSelectedGradient] = useState(GRADIENT_PRESETS[0].value);

    // Voice Drop recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSecs, setRecordingSecs] = useState(0);
    const [voiceData, setVoiceData] = useState(null);
    const mediaRecorderRef = useRef(null);
    const audioStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingIntervalRef = useRef(null);

    // Fullscreen Story Viewer state
    const [viewerOpen, setViewerOpen] = useState(false);
    const [viewerInitialIndex, setViewerInitialIndex] = useState(0);

    // Close on Escape key
    useEffect(() => {
        if (!isOpen) return;
        const handleKeyDown = (e) => {
            if (e.key === 'Escape') onClose();
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, onClose]);

    const myUsername = (currentUser?.username || '').toLowerCase();

    // Partition statuses into My Statuses and Contacts' Statuses
    const { myStatuses, contactGroups } = useMemo(() => {
        const my = [];
        const groupsMap = new Map();

        (statuses || []).forEach((st) => {
            const uname = (st.username || '').toLowerCase();
            if (uname === myUsername) {
                my.push(st);
            } else {
                if (!groupsMap.has(uname)) {
                    groupsMap.set(uname, []);
                }
                groupsMap.get(uname).push(st);
            }
        });

        const contactList = Array.from(groupsMap.entries()).map(([uname, list]) => {
            const latest = list[list.length - 1];
            const hasUnviewed = list.some((st) => !viewedStatusIds.has(st.id));
            return {
                username: latest.username,
                avatarColor: latest.avatarColor,
                avatarUrl: latest.avatarUrl,
                statuses: list,
                latestTime: latest.createdAt,
                hasUnviewed
            };
        });

        // Sort contacts: unviewed first, then by latest time
        contactList.sort((a, b) => {
            if (a.hasUnviewed !== b.hasUnviewed) return a.hasUnviewed ? -1 : 1;
            return b.latestTime - a.latestTime;
        });

        return { myStatuses: my, contactGroups: contactList };
    }, [statuses, myUsername, viewedStatusIds]);

    if (!isOpen) return null;

    // Start Voice Recording
    const startRecording = async () => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                return alert("Voice recording is not supported in this browser.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;
            audioChunksRef.current = [];
            setRecordingSecs(0);

            const recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);

            recordingIntervalRef.current = setInterval(() => {
                setRecordingSecs((prev) => {
                    if (prev >= 15) {
                        stopRecording();
                        return 15;
                    }
                    return prev + 1;
                });
            }, 1000);
        } catch (err) {
            console.error("Mic error:", err);
            alert("Microphone permission was denied.");
        }
    };

    const stopRecording = () => {
        clearInterval(recordingIntervalRef.current);
        if (!mediaRecorderRef.current) return;

        const dur = recordingSecs;
        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            if (audioStreamRef.current) {
                audioStreamRef.current.getTracks().forEach((t) => t.stop());
                audioStreamRef.current = null;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                setVoiceData({
                    audio: e.target.result,
                    duration: `0:${dur < 10 ? '0' : ''}${dur}`
                });
                setIsRecording(false);
            };
            reader.readAsDataURL(audioBlob);
        };

        if (mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    const cancelRecording = () => {
        clearInterval(recordingIntervalRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((t) => t.stop());
            audioStreamRef.current = null;
        }
        audioChunksRef.current = [];
        setVoiceData(null);
        setIsRecording(false);
    };

    // Post Status
    const handlePostStatus = (e) => {
        e.preventDefault();
        if (composerMode === 'text') {
            if (!statusText.trim()) return;
            postStatus({
                type: 'text',
                text: statusText.trim(),
                bgGradient: selectedGradient
            });
        } else if (composerMode === 'voice') {
            if (!voiceData) return;
            postStatus({
                type: 'voice',
                text: statusText.trim() || '🎙️ Voice Drop',
                audio: voiceData.audio,
                audioDuration: voiceData.duration,
                bgGradient: selectedGradient
            });
        }

        setStatusText('');
        setVoiceData(null);
        setIsComposerOpen(false);
    };

    const openMyStatusViewer = () => {
        if (myStatuses.length === 0) return;
        setViewerInitialIndex(0);
        setViewerOpen(true);
    };

    const openContactStatusViewer = (contact) => {
        // Find index of contact's first status in the flat statuses list
        const idx = statuses.findIndex((s) => s.id === contact.statuses[0]?.id);
        setViewerInitialIndex(idx !== -1 ? idx : 0);
        setViewerOpen(true);
    };

    if (!isOpen) return null;

    return (
        <div className="wa-drawer-backdrop open" onClick={onClose}>
            <div className="wa-status-drawer" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="wa-drawer-header">
                    <div className="wa-drawer-header-title">
                        <Radio size={20} className="wa-status-radio-icon" />
                        <h2>Status & Live Vibes</h2>
                    </div>
                    <button type="button" className="wa-drawer-close-btn" onClick={onClose}>
                        <X size={20} />
                    </button>
                </div>

                <div className="wa-drawer-scroll-body">
                    {/* My Status Card */}
                    <div className="wa-status-section">
                        <div className="wa-status-section-label">My Status</div>
                        <div className="wa-my-status-card">
                            <div 
                                className={`wa-status-avatar-ring ${myStatuses.length > 0 ? 'active' : ''}`}
                                onClick={openMyStatusViewer}
                            >
                                <div 
                                    className="wa-status-avatar-inner"
                                    style={{ backgroundColor: currentUser?.color || '#00a884' }}
                                >
                                    {currentUser?.avatarUrl ? (
                                        <img src={currentUser.avatarUrl} alt="Me" />
                                    ) : (
                                        (currentUser?.username || 'U').slice(0, 2).toUpperCase()
                                    )}
                                </div>
                                {myStatuses.length === 0 && (
                                    <div className="wa-status-add-badge">
                                        <Plus size={14} />
                                    </div>
                                )}
                            </div>

                            <div className="wa-my-status-meta" onClick={myStatuses.length > 0 ? openMyStatusViewer : () => setIsComposerOpen(true)}>
                                <span className="wa-my-status-title">
                                    {myStatuses.length > 0 ? 'My Status' : 'Add to My Status'}
                                </span>
                                <span className="wa-my-status-subtitle">
                                    {myStatuses.length > 0 
                                        ? `${myStatuses.length} active update${myStatuses.length > 1 ? 's' : ''} • Tap to view` 
                                        : 'Share a vibe or 15s voice drop with friends'}
                                </span>
                            </div>

                            <button
                                type="button"
                                className="wa-status-create-btn"
                                title="Post new status"
                                onClick={() => setIsComposerOpen(true)}
                            >
                                <Plus size={18} />
                            </button>
                        </div>
                    </div>

                    {/* Status Composer Form (Collapsible) */}
                    {isComposerOpen && (
                        <div className="wa-status-composer-box">
                            <div className="wa-composer-header">
                                <div className="wa-composer-tabs">
                                    <button 
                                        type="button" 
                                        className={`wa-composer-tab ${composerMode === 'text' ? 'active' : ''}`}
                                        onClick={() => setComposerMode('text')}
                                    >
                                        <Sparkles size={14} />
                                        <span>Vibe Note</span>
                                    </button>
                                    <button 
                                        type="button" 
                                        className={`wa-composer-tab ${composerMode === 'voice' ? 'active' : ''}`}
                                        onClick={() => setComposerMode('voice')}
                                    >
                                        <Mic size={14} />
                                        <span>Voice Drop (15s)</span>
                                    </button>
                                </div>
                                <button type="button" className="wa-composer-cancel" onClick={() => setIsComposerOpen(false)}>
                                    <X size={16} />
                                </button>
                            </div>

                            <form onSubmit={handlePostStatus}>
                                {composerMode === 'text' && (
                                    <div className="wa-composer-preview-card" style={{ background: selectedGradient }}>
                                        <textarea
                                            placeholder="What's your vibe today? (e.g. 🎧 Deep Coding, ☕ Chai Break...)"
                                            value={statusText}
                                            onChange={(e) => setStatusText(e.target.value)}
                                            maxLength={200}
                                            rows={3}
                                            autoFocus
                                        />
                                        <div className="wa-composer-char-count">{statusText.length}/200</div>
                                    </div>
                                )}

                                {composerMode === 'voice' && (
                                    <div className="wa-composer-voice-card" style={{ background: selectedGradient }}>
                                        {!voiceData && !isRecording && (
                                            <div className="wa-record-prompt">
                                                <button type="button" className="wa-record-mic-circle" onClick={startRecording}>
                                                    <Mic size={24} />
                                                </button>
                                                <span>Tap microphone to record 15s voice story</span>
                                            </div>
                                        )}

                                        {isRecording && (
                                            <div className="wa-recording-live-box">
                                                <div className="pulse-red-ring" />
                                                <span className="live-timer">0:{recordingSecs < 10 ? '0' : ''}{recordingSecs} / 0:15</span>
                                                <button type="button" className="stop-rec-btn" onClick={stopRecording}>
                                                    <Check size={18} />
                                                </button>
                                            </div>
                                        )}

                                        {voiceData && (
                                            <div className="wa-recorded-preview">
                                                <span>🎙️ Voice Note Ready ({voiceData.duration})</span>
                                                <button type="button" className="discard-rec-btn" onClick={() => setVoiceData(null)}>
                                                    <Trash2 size={16} />
                                                </button>
                                            </div>
                                        )}

                                        <input 
                                            type="text"
                                            className="wa-voice-caption-input"
                                            placeholder="Optional caption for your voice drop..."
                                            value={statusText}
                                            onChange={(e) => setStatusText(e.target.value)}
                                        />
                                    </div>
                                )}

                                {/* Gradient Preset Palette */}
                                <div className="wa-gradient-picker-row">
                                    <span className="picker-label">Color:</span>
                                    <div className="gradient-swatches">
                                        {GRADIENT_PRESETS.map((g) => (
                                            <button
                                                key={g.id}
                                                type="button"
                                                className={`swatch-btn ${selectedGradient === g.value ? 'selected' : ''}`}
                                                style={{ background: g.value }}
                                                onClick={() => setSelectedGradient(g.value)}
                                                title={g.name}
                                            />
                                        ))}
                                    </div>
                                </div>

                                {/* Quick Vibe Emojis */}
                                <div className="wa-vibe-emojis-row">
                                    {VIBE_EMOJIS.map((em) => (
                                        <button
                                            key={em}
                                            type="button"
                                            className="vibe-emoji-btn"
                                            onClick={() => setStatusText((prev) => prev ? `${prev} ${em}` : em)}
                                        >
                                            {em}
                                        </button>
                                    ))}
                                </div>

                                <button 
                                    type="submit" 
                                    className="wa-post-status-submit"
                                    disabled={composerMode === 'text' ? !statusText.trim() : !voiceData}
                                >
                                    <Send size={16} />
                                    <span>Post Status</span>
                                </button>
                            </form>
                        </div>
                    )}

                    {/* Recent Updates from Contacts */}
                    <div className="wa-status-section" style={{ marginTop: '1.25rem' }}>
                        <div className="wa-status-section-label">
                            Recent Updates ({contactGroups.length})
                        </div>

                        {contactGroups.length === 0 ? (
                            <div className="wa-status-empty-box">
                                <Radio size={32} />
                                <p>No status updates yet</p>
                                <span>Be the first one to post a status or vibe note!</span>
                            </div>
                        ) : (
                            <div className="wa-status-contacts-list">
                                {contactGroups.map((contact) => (
                                    <div 
                                        key={contact.username}
                                        className="wa-status-contact-item"
                                        onClick={() => openContactStatusViewer(contact)}
                                    >
                                        <div className={`wa-status-avatar-ring ${contact.hasUnviewed ? 'unviewed' : 'viewed'}`}>
                                            <div 
                                                className="wa-status-avatar-inner"
                                                style={{ backgroundColor: contact.avatarColor || '#10b981' }}
                                            >
                                                {contact.avatarUrl ? (
                                                    <img src={contact.avatarUrl} alt={contact.username} />
                                                ) : (
                                                    contact.username.slice(0, 2).toUpperCase()
                                                )}
                                            </div>
                                        </div>

                                        <div className="wa-status-contact-meta">
                                            <div className="wa-status-contact-top">
                                                <span className="contact-name">{contact.username}</span>
                                                {contact.username.toLowerCase() === 'chathub' && (
                                                    <VerifiedBadge size={14} />
                                                )}
                                            </div>
                                            <span className="contact-time">{formatTimeAgo(contact.latestTime)}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Story Viewer Modal */}
            <StatusViewerModal
                isOpen={viewerOpen}
                onClose={() => setViewerOpen(false)}
                statusList={statuses}
                initialIndex={viewerInitialIndex}
                currentUser={currentUser}
            />
        </div>
    );
}
