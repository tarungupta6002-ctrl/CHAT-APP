import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { 
    Paperclip, 
    Smile, 
    Mic, 
    X, 
    Check, 
    Eye, 
    Send, 
    Sparkles, 
    Briefcase, 
    Scissors, 
    Loader2,
    FileText,
    Image as ImageIcon
} from 'lucide-react';
import EmojiPicker from './EmojiPicker';

function formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export default function ChatFooter() {
    const {
        sendMessage,
        notifyTyping,
        replyingTo,
        setReplyingTo,
        currentChat,
        conversations,
        blockedUsers,
        unblockUser
    } = useSocket();

    const [text, setText] = useState('');
    const [selectedImageData, setSelectedImageData] = useState(null);
    const [selectedDocument, setSelectedDocument] = useState(null);
    const [isViewOnceActive, setIsViewOnceActive] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);
    const [isAttachMenuOpen, setIsAttachMenuOpen] = useState(false);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);

    // Task 1: Smart Replies State & Generator
    const [suggestedReplies, setSuggestedReplies] = useState([
        "Sounds good!",
        "I'll check and let you know",
        "Thanks!"
    ]);

    // Task 3: Tone Adjuster State & Handlers
    const [isToneMenuOpen, setIsToneMenuOpen] = useState(false);
    const [isAdjustingTone, setIsAdjustingTone] = useState(false);
    const toneMenuRef = useRef(null);
    const attachMenuRef = useRef(null);

    const mediaRecorderRef = useRef(null);
    const audioStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingIntervalRef = useRef(null);

    const fileInputRef = useRef(null);
    const docInputRef = useRef(null);
    const inputRef = useRef(null);
    const emojiBtnRef = useRef(null);

    // Process image file through Canvas resize
    const processImageFile = useCallback((file) => {
        if (!file || !file.type.startsWith('image/')) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const rawData = event.target.result;
            const img = new Image();
            img.onload = () => {
                const MAX_DIM = 1200;
                let width = img.width;
                let height = img.height;

                if (width > MAX_DIM || height > MAX_DIM) {
                    if (width > height) {
                        height = Math.round((height * MAX_DIM) / width);
                        width = MAX_DIM;
                    } else {
                        width = Math.round((width * MAX_DIM) / height);
                        height = MAX_DIM;
                    }
                }

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const optimizedData = canvas.toDataURL('image/jpeg', 0.82);
                setSelectedImageData(optimizedData);
                inputRef.current?.focus();
            };
            img.onerror = () => {
                setSelectedImageData(rawData);
                inputRef.current?.focus();
            };
            img.src = rawData;
        };
        reader.readAsDataURL(file);
    }, []);

    // Process document file
    const handleDocumentFile = useCallback((file) => {
        if (!file) return;

        // 15MB file size limit for WebSockets & client memory safety
        const MAX_SIZE = 15 * 1024 * 1024;
        if (file.size > MAX_SIZE) {
            alert('File size exceeds the 15MB limit. Please select a smaller document.');
            if (docInputRef.current) docInputRef.current.value = '';
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const rawData = event.target.result;
            const ext = (file.name.split('.').pop() || 'file').toLowerCase();
            setSelectedDocument({
                data: rawData,
                fileName: file.name,
                fileSize: formatFileSize(file.size),
                fileType: ext
            });
            setSelectedImageData(null);
            setIsViewOnceActive(false);
            setIsAttachMenuOpen(false);
            inputRef.current?.focus();
        };
        reader.readAsDataURL(file);
    }, []);

    const handleDocumentSelected = (e) => {
        if (e.target.files && e.target.files[0]) {
            handleDocumentFile(e.target.files[0]);
        }
    };

    // Clipboard Paste (Ctrl+V) for image or document attachments
    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                processImageFile(file);
                break;
            } else if (item.kind === 'file') {
                e.preventDefault();
                const file = item.getAsFile();
                handleDocumentFile(file);
                break;
            }
        }
    };

    // Voice recording handlers
    const startVoiceRecording = async () => {
        try {
            if (!navigator.mediaDevices?.getUserMedia) {
                return alert("Voice recording is not supported in this browser.");
            }
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            audioStreamRef.current = stream;
            audioChunksRef.current = [];
            setRecordingSeconds(0);

            const recorder = new MediaRecorder(stream);
            recorder.ondataavailable = (e) => {
                if (e.data && e.data.size > 0) audioChunksRef.current.push(e.data);
            };

            recorder.start();
            mediaRecorderRef.current = recorder;
            setIsRecording(true);

            recordingIntervalRef.current = setInterval(() => {
                setRecordingSeconds((prev) => prev + 1);
            }, 1000);
        } catch (err) {
            console.error("Mic error:", err);
            alert("Microphone permission was denied.");
        }
    };

    const cancelVoiceRecording = () => {
        clearInterval(recordingIntervalRef.current);
        if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
        if (audioStreamRef.current) {
            audioStreamRef.current.getTracks().forEach((t) => t.stop());
            audioStreamRef.current = null;
        }
        audioChunksRef.current = [];
        setIsRecording(false);
    };

    const stopAndSendVoiceRecording = () => {
        clearInterval(recordingIntervalRef.current);
        if (!mediaRecorderRef.current) return;

        const mins = Math.floor(recordingSeconds / 60);
        const secs = recordingSeconds % 60;
        const durationText = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

        mediaRecorderRef.current.onstop = () => {
            const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
            if (audioStreamRef.current) {
                audioStreamRef.current.getTracks().forEach((t) => t.stop());
                audioStreamRef.current = null;
            }

            const reader = new FileReader();
            reader.onload = (e) => {
                const base64Audio = e.target.result;
                sendMessage({
                    text: '',
                    audio: base64Audio,
                    audioDuration: durationText,
                    replyTo: replyingTo ? { ...replyingTo } : null,
                    isViewOnce: false
                });
                setIsRecording(false);
            };
            reader.readAsDataURL(audioBlob);
        };

        if (mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
        }
    };

    const handleFormSubmit = (e) => {
        e.preventDefault();
        if (!text.trim() && !selectedImageData && !selectedDocument) return;

        sendMessage({
            text: text.trim(),
            image: selectedImageData,
            audio: null,
            audioDuration: null,
            file: selectedDocument?.data || null,
            fileName: selectedDocument?.fileName || null,
            fileSize: selectedDocument?.fileSize || null,
            fileType: selectedDocument?.fileType || null,
            replyTo: replyingTo ? { ...replyingTo } : null,
            isViewOnce: Boolean(isViewOnceActive)
        });

        setText('');
        setSelectedImageData(null);
        setSelectedDocument(null);
        setIsViewOnceActive(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
        if (docInputRef.current) docInputRef.current.value = '';
        inputRef.current?.focus();
    };

    const handleEmojiSelect = (emoji) => {
        if (!inputRef.current) return;
        const start = inputRef.current.selectionStart || 0;
        const end = inputRef.current.selectionEnd || 0;
        const newText = text.slice(0, start) + emoji + text.slice(end);
        setText(newText);
        setIsEmojiPickerOpen(false);
        setTimeout(() => {
            inputRef.current.focus();
            inputRef.current.selectionStart = inputRef.current.selectionEnd = start + emoji.length;
        }, 10);
    };

    const formatTimer = (sec) => {
        const m = Math.floor(sec / 60);
        const s = sec % 60;
        return `${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Task 1: Smart Replies Generator (API placeholder + intelligent heuristic)
    const generateSmartReplies = useCallback((chatHistory) => {
        if (!chatHistory || chatHistory.length === 0) {
            setSuggestedReplies(["Sounds good!", "I'll check and let you know", "Thanks!"]);
            return;
        }
        const lastMsg = [...chatHistory].reverse().find(
            (m) => m.type === 'message' && m.data?.text && !m.data?.isDeleted
        );
        if (!lastMsg) {
            setSuggestedReplies(["Sounds good!", "I'll check and let you know", "Thanks!"]);
            return;
        }
        const lastText = (lastMsg.data.text || '').toLowerCase();
        if (lastText.includes('?') || lastText.includes('how') || lastText.includes('what') || lastText.includes('when')) {
            setSuggestedReplies(["Sure, let me check", "Yes, absolutely", "Not sure right now"]);
        } else if (lastText.includes('thank') || lastText.includes('thx')) {
            setSuggestedReplies(["You're welcome! 😊", "Anytime!", "Glad to help!"]);
        } else if (lastText.includes('hello') || lastText.includes('hi') || lastText.includes('hey')) {
            setSuggestedReplies(["Hey there! 👋", "Hi, how are you?", "Hello! What's up?"]);
        } else if (lastText.includes('ok') || lastText.includes('okay') || lastText.includes('done')) {
            setSuggestedReplies(["Sounds good!", "Perfect, thanks!", "Great!"]);
        } else {
            setSuggestedReplies(["Sounds good!", "I'll check and let you know", "Thanks!"]);
        }
    }, []);

    const activeKey = !currentChat || currentChat.type === 'general'
        ? 'general'
        : (currentChat.partnerName ? currentChat.partnerName.toLowerCase() : (currentChat.partnerId || 'dm'));
    const activeMessages = conversations ? (conversations[activeKey] || []) : [];

    useEffect(() => {
        generateSmartReplies(activeMessages);
    }, [activeMessages, generateSmartReplies]);

    const handleApplySmartReply = (reply) => {
        setText(reply);
        inputRef.current?.focus();
    };

    // Task 3: Tone Adjuster Handlers & Click-outside listener
    useEffect(() => {
        const handleOutside = (e) => {
            if (toneMenuRef.current && !toneMenuRef.current.contains(e.target)) {
                setIsToneMenuOpen(false);
            }
            if (attachMenuRef.current && !attachMenuRef.current.contains(e.target)) {
                setIsAttachMenuOpen(false);
            }
        };
        if (isToneMenuOpen || isAttachMenuOpen) {
            document.addEventListener('mousedown', handleOutside);
        }
        return () => document.removeEventListener('mousedown', handleOutside);
    }, [isToneMenuOpen, isAttachMenuOpen]);

    const handleAdjustTone = async (tone) => {
        if (!text.trim() || isAdjustingTone) return;
        setIsAdjustingTone(true);
        setIsToneMenuOpen(false);

        try {
            const res = await fetch('/api/ai/tone', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text, tone })
            }).catch(() => null);

            if (res && res.ok) {
                const data = await res.json();
                if (data.adjustedText) {
                    setText(data.adjustedText);
                    setIsAdjustingTone(false);
                    inputRef.current?.focus();
                    return;
                }
            }

            // Clean fallback transformation
            const trimmed = text.trim();
            let adjusted = trimmed;
            if (tone === 'professional') {
                adjusted = `Dear ${currentChat?.partnerName || 'Colleague'}, I would like to kindly note that ${trimmed.charAt(0).toLowerCase() + trimmed.slice(1)}. Best regards.`;
            } else if (tone === 'friendly') {
                adjusted = `Hey ${currentChat?.partnerName || 'there'}! 😊 Just wanted to say: ${trimmed}! Hope you're doing well ✨`;
            } else if (tone === 'shorten') {
                const firstSentence = trimmed.split(/[.?!]\s/)[0];
                adjusted = firstSentence.length > 70 ? firstSentence.slice(0, 70) + '...' : firstSentence;
            }
            setText(adjusted);
        } catch (err) {
            console.error("Tone adjustment error:", err);
        } finally {
            setIsAdjustingTone(false);
            inputRef.current?.focus();
        }
    };

    const isDm = currentChat?.type === 'dm';
    const partnerName = currentChat?.partnerName || '';
    const isContactBlocked = isDm && partnerName && blockedUsers?.includes(partnerName.toLowerCase());

    if (isContactBlocked) {
        return (
            <div className="wa-blocked-footer-wrap">
                <footer className="chat-footer wa-blocked-footer">
                    <span className="wa-blocked-text">You blocked this contact.</span>
                    <button
                        type="button"
                        className="wa-blocked-unblock-btn"
                        onClick={() => unblockUser(partnerName)}
                    >
                        Unblock
                    </button>
                </footer>
            </div>
        );
    }

    return (
        <div style={{ position: 'relative', width: '100%' }}>
            {/* Floating Emoji Picker Popover */}
            <EmojiPicker
                isOpen={isEmojiPickerOpen}
                onSelect={handleEmojiSelect}
                onClose={() => setIsEmojiPickerOpen(false)}
                anchorRef={emojiBtnRef}
            />

            {/* Image Preview Dock */}
            {selectedImageData && (
                <div className="image-preview-dock">
                    <div className="preview-thumbnail-wrap">
                        <img src={selectedImageData} alt="Preview" />
                        <button
                            type="button"
                            className="remove-preview-btn"
                            title="Remove image"
                            onClick={() => {
                                setSelectedImageData(null);
                                setIsViewOnceActive(false);
                                if (fileInputRef.current) fileInputRef.current.value = '';
                            }}
                        >
                            <X size={15} />
                        </button>
                    </div>
                    <div className="preview-controls">
                        <button
                            type="button"
                            className={`view-once-toggle-btn ${isViewOnceActive ? 'active' : ''}`}
                            onClick={() => setIsViewOnceActive((prev) => !prev)}
                        >
                            <Eye size={15} className="view-once-circle" />
                            <span className="view-once-label">View Once</span>
                        </button>
                        <span className="preview-info">
                            {isViewOnceActive
                                ? 'View Once active (disappears after 1 view)'
                                : 'Standard photo attached'}
                        </span>
                    </div>
                </div>
            )}

            {/* Document Preview Dock */}
            {selectedDocument && (
                <div className="document-preview-dock">
                    <div className="doc-preview-card">
                        <div className={`doc-preview-badge doc-type-${selectedDocument.fileType || 'file'}`}>
                            <FileText size={22} />
                            <span className="doc-preview-ext">
                                {selectedDocument.fileType?.toUpperCase().slice(0, 4) || 'FILE'}
                            </span>
                        </div>
                        <div className="doc-preview-meta">
                            <span className="doc-preview-name" title={selectedDocument.fileName}>
                                {selectedDocument.fileName}
                            </span>
                            <span className="doc-preview-size">{selectedDocument.fileSize}</span>
                        </div>
                        <button
                            type="button"
                            className="remove-preview-btn"
                            title="Discard document"
                            onClick={() => {
                                setSelectedDocument(null);
                                if (docInputRef.current) docInputRef.current.value = '';
                            }}
                        >
                            <X size={15} />
                        </button>
                    </div>
                </div>
            )}

            {/* Voice Recording Dock */}
            {isRecording && (
                <div className="voice-recording-dock">
                    <div className="recording-indicator">
                        <span className="recording-pulse-dot"></span>
                        <span>{formatTimer(recordingSeconds)}</span>
                    </div>
                    <div className="recording-wave-animation">
                        <span></span><span></span><span></span><span></span><span></span>
                    </div>
                    <div className="recording-actions">
                        <button
                            type="button"
                            className="cancel-recording-btn"
                            title="Discard voice note"
                            onClick={cancelVoiceRecording}
                        >
                            <X size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                            Cancel
                        </button>
                        <button
                            type="button"
                            className="send-recording-btn"
                            title="Send voice note"
                            onClick={stopAndSendVoiceRecording}
                        >
                            <Check size={14} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
                            Send
                        </button>
                    </div>
                </div>
            )}

            {/* Reply Preview Dock */}
            {replyingTo && (
                <div className="reply-preview-dock">
                    <div className="reply-preview-indicator"></div>
                    <div className="reply-preview-content">
                        <div className="reply-preview-user">Replying to {replyingTo.username}</div>
                        <div className="reply-preview-snippet">{replyingTo.text}</div>
                    </div>
                    <button
                        type="button"
                        className="cancel-reply-btn"
                        title="Cancel Reply"
                        onClick={() => setReplyingTo(null)}
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Task 1: Smart Replies (Suggested Responses) */}
            {!text.trim() && !isRecording && !selectedImageData && !replyingTo && suggestedReplies.length > 0 && (
                <div className="wa-smart-replies-dock">
                    <div className="wa-smart-replies-scroll">
                        {suggestedReplies.map((reply, idx) => (
                            <button
                                key={idx}
                                type="button"
                                className="wa-smart-reply-chip"
                                onClick={() => handleApplySmartReply(reply)}
                            >
                                {reply}
                            </button>
                        ))}
                    </div>
                </div>
            )}

            {/* Chat Input Footer Form */}
            <footer className="chat-footer">
                <form className="input-container" onSubmit={handleFormSubmit}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept="image/*"
                        style={{ display: 'none' }}
                        onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                                processImageFile(e.target.files[0]);
                            }
                        }}
                    />
                    <input
                        type="file"
                        ref={docInputRef}
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip,.rar,.json"
                        style={{ display: 'none' }}
                        onChange={handleDocumentSelected}
                    />

                    {/* Attachment Popover Menu */}
                    <div className="wa-attach-anchor" ref={attachMenuRef}>
                        <button
                            type="button"
                            className={`input-action-btn ${isAttachMenuOpen ? 'active' : ''}`}
                            title="Attach Document or Photo"
                            onClick={() => setIsAttachMenuOpen((prev) => !prev)}
                        >
                            <Paperclip size={18} />
                        </button>

                        {isAttachMenuOpen && (
                            <div className="wa-attach-dropdown-menu">
                                <button
                                    type="button"
                                    className="wa-attach-dropdown-item doc-item"
                                    onClick={() => {
                                        setIsAttachMenuOpen(false);
                                        docInputRef.current?.click();
                                    }}
                                >
                                    <div className="wa-attach-icon-circle doc-circle">
                                        <FileText size={18} />
                                    </div>
                                    <span>Document</span>
                                </button>
                                <button
                                    type="button"
                                    className="wa-attach-dropdown-item photo-item"
                                    onClick={() => {
                                        setIsAttachMenuOpen(false);
                                        fileInputRef.current?.click();
                                    }}
                                >
                                    <div className="wa-attach-icon-circle photo-circle">
                                        <ImageIcon size={18} />
                                    </div>
                                    <span>Photos & videos</span>
                                </button>
                            </div>
                        )}
                    </div>
                    <button
                        type="button"
                        ref={emojiBtnRef}
                        className="emoji-toggle-btn"
                        title="Insert emoji"
                        onClick={() => setIsEmojiPickerOpen((prev) => !prev)}
                    >
                        <Smile size={18} />
                    </button>
                    <button
                        type="button"
                        className="input-action-btn"
                        title="Record Voice Note"
                        onClick={() => {
                            if (isRecording) {
                                cancelVoiceRecording();
                            } else {
                                startVoiceRecording();
                            }
                        }}
                    >
                        <Mic size={18} />
                    </button>

                    {/* Task 3: Tone Adjuster (Input Box Integration) */}
                    <div className="wa-tone-anchor" ref={toneMenuRef}>
                        <button
                            type="button"
                            className={`input-action-btn wa-tone-trigger ${isToneMenuOpen ? 'active' : ''} ${!text.trim() ? 'disabled' : ''}`}
                            title={text.trim() ? "AI Tone Adjuster" : "Type a message to adjust tone"}
                            onClick={() => {
                                if (text.trim()) {
                                    setIsToneMenuOpen((prev) => !prev);
                                }
                            }}
                            disabled={!text.trim() || isAdjustingTone}
                        >
                            {isAdjustingTone ? (
                                <Loader2 size={18} className="wa-spin-icon" />
                            ) : (
                                <Sparkles size={18} />
                            )}
                        </button>

                        {isToneMenuOpen && (
                            <div className="wa-tone-dropdown-menu">
                                <button
                                    type="button"
                                    className="wa-tone-dropdown-item"
                                    onClick={() => handleAdjustTone('professional')}
                                >
                                    <Briefcase size={15} />
                                    <span>Make Professional</span>
                                </button>
                                <button
                                    type="button"
                                    className="wa-tone-dropdown-item"
                                    onClick={() => handleAdjustTone('friendly')}
                                >
                                    <Smile size={15} />
                                    <span>Make Friendly</span>
                                </button>
                                <button
                                    type="button"
                                    className="wa-tone-dropdown-item"
                                    onClick={() => handleAdjustTone('shorten')}
                                >
                                    <Scissors size={15} />
                                    <span>Shorten Text</span>
                                </button>
                            </div>
                        )}
                    </div>

                    <input
                        type="text"
                        ref={inputRef}
                        className="chat-input"
                        placeholder="Type a message or paste image (Ctrl+V)..."
                        value={text}
                        onChange={(e) => {
                            setText(e.target.value);
                            notifyTyping();
                        }}
                        onPaste={handlePaste}
                        autoComplete="off"
                    />

                    <button
                        type="submit"
                        className="send-button"
                        title="Send message"
                        aria-label="Send message"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </footer>
        </div>
    );
}
