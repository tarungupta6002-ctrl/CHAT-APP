import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useSocket } from '../context/SocketContext';
import { Paperclip, Smile, Mic, X, Check, Eye, Send } from 'lucide-react';
import EmojiPicker from './EmojiPicker';

export default function ChatFooter() {
    const {
        sendMessage,
        notifyTyping,
        replyingTo,
        setReplyingTo
    } = useSocket();

    const [text, setText] = useState('');
    const [selectedImageData, setSelectedImageData] = useState(null);
    const [isViewOnceActive, setIsViewOnceActive] = useState(false);
    const [isEmojiPickerOpen, setIsEmojiPickerOpen] = useState(false);

    // Voice recording state
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);

    const mediaRecorderRef = useRef(null);
    const audioStreamRef = useRef(null);
    const audioChunksRef = useRef([]);
    const recordingIntervalRef = useRef(null);

    const fileInputRef = useRef(null);
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

    // Clipboard Paste (Ctrl+V) for image attachments
    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;
        for (const item of items) {
            if (item.type.indexOf('image') !== -1) {
                e.preventDefault();
                const file = item.getAsFile();
                processImageFile(file);
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
        if (!text.trim() && !selectedImageData) return;

        sendMessage({
            text: text.trim(),
            image: selectedImageData,
            audio: null,
            audioDuration: null,
            replyTo: replyingTo ? { ...replyingTo } : null,
            isViewOnce: Boolean(isViewOnceActive)
        });

        setText('');
        setSelectedImageData(null);
        setIsViewOnceActive(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
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
                    <button
                        type="button"
                        className="input-action-btn"
                        title="Attach Image"
                        onClick={() => fileInputRef.current?.click()}
                    >
                        <Paperclip size={18} />
                    </button>
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
