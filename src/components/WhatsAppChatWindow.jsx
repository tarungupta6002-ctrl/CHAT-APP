import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';
import MessagesContainer from './MessagesContainer';
import TypingBar from './TypingBar';
import ChatFooter from './ChatFooter';
import ChatHubAiPanel from './ChatHubAiPanel';

export default function WhatsAppChatWindow() {
    const { currentChat, selectChat, onlineUsers } = useSocket();
    const { initiateCall } = useWebRTC();
    const [isAiOpen, setIsAiOpen] = useState(false);

    if (!currentChat) {
        return (
            <div className="whatsapp-empty-placeholder">
                <div className="empty-placeholder-content">
                    <div className="placeholder-logo-circle">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                        </svg>
                    </div>
                    <h2>ChatHub Web</h2>
                    <p>
                        Select a conversation from the sidebar or click <strong>+ New</strong> to start chatting.
                        Experience high-definition audio & video calls and view-once media.
                    </p>
                    <div className="encryption-pill">
                        🔒 End-to-end style encrypted real-time connection
                    </div>
                </div>
            </div>
        );
    }

    const isDm = currentChat.type === 'dm';
    const partnerName = isDm ? currentChat.partnerName : 'General Room';
    const isOnline = isDm && onlineUsers.some(
        (u) => u.username.toLowerCase() === currentChat.partnerName?.toLowerCase()
    );
    const initials = isDm ? partnerName.slice(0, 2).toUpperCase() : '#';
    const avatarColor = currentChat.partnerColor || '#00a884';

    return (
        <section className="whatsapp-chat-stage">
            {/* WhatsApp Chat Header */}
            <header className="whatsapp-chat-header">
                <div className="chat-header-left">
                    {/* Back to Dashboard button */}
                    <button
                        type="button"
                        className="back-to-dash-btn"
                        title="Back to Dashboard"
                        onClick={() => selectChat(null)}
                    >
                        <span className="dash-back-arrow">←</span>
                        <span className="dash-back-text">Dashboard</span>
                    </button>

                    <div
                        className="chat-avatar-circle"
                        style={{ backgroundColor: avatarColor }}
                    >
                        {initials}
                    </div>

                    <div className="chat-contact-info">
                        <h3>{partnerName}</h3>
                        <span className="contact-status">
                            {isDm ? (isOnline ? 'Online' : 'Offline') : 'Public group chat'}
                        </span>
                    </div>
                </div>

                {/* Right Call & AI Action Buttons */}
                <div className="chat-header-actions">
                    {/* Ask AI Action Button */}
                    <button
                        type="button"
                        className="ai-header-action-btn"
                        title="Ask ChatHub AI about this conversation"
                        onClick={() => setIsAiOpen(true)}
                    >
                        <svg viewBox="0 0 24 24" fill="currentColor" className="ai-btn-sparkle">
                            <path d="M19 9l1.25-2.75L23 5l-2.75-1.25L19 1l-1.25 2.75L15 5l2.75 1.25L19 9zm-7.5.5L9 4 6.5 9.5 1 12l5.5 2.5L9 20l2.5-5.5L17 12l-5.5-2.5zM19 15l-1.25 2.75L15 19l2.75 1.25L19 23l1.25-2.75L23 19l-2.75-1.25L19 15z" />
                        </svg>
                        <span>Ask AI</span>
                    </button>

                    {isDm && (
                        <>
                            <button
                                type="button"
                                className="call-action-btn"
                                title="Start Audio Call"
                                onClick={() => initiateCall(false)}
                            >
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z" />
                                </svg>
                                <span>Voice</span>
                            </button>
                            <button
                                type="button"
                                className="call-action-btn video"
                                title="Start Video Call"
                                onClick={() => initiateCall(true)}
                            >
                                <svg viewBox="0 0 20 20" fill="currentColor">
                                    <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                                </svg>
                                <span>Video</span>
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Messages Content */}
            <div className="whatsapp-messages-viewport">
                <MessagesContainer />
                <TypingBar />
            </div>

            {/* Chat Input Footer */}
            <ChatFooter />

            {/* ChatHub AI Assistant Slide-in Panel */}
            <ChatHubAiPanel
                isOpen={isAiOpen}
                onClose={() => setIsAiOpen(false)}
                currentChat={currentChat}
            />
        </section>
    );
}

