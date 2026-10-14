import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';
import { Sparkles, Phone, Video, ShieldCheck, ArrowLeft, MessageSquare } from 'lucide-react';
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
                        <MessageSquare size={36} />
                    </div>
                    <h2>ChatHub Web</h2>
                    <p>
                        Select a conversation from the sidebar or click <strong>+ New</strong> to start chatting.
                        Experience high-definition audio & video calls and view-once media.
                    </p>
                    <div className="encryption-pill">
                        <ShieldCheck size={14} style={{ display: 'inline', marginRight: '6px', verticalAlign: 'middle', color: '#10b981' }} />
                        End-to-end style encrypted real-time connection
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
                        <ArrowLeft size={16} className="dash-back-arrow" />
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
                        <Sparkles size={16} className="ai-btn-sparkle" />
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
                                <Phone size={15} />
                                <span>Voice</span>
                            </button>
                            <button
                                type="button"
                                className="call-action-btn video"
                                title="Start Video Call"
                                onClick={() => initiateCall(true)}
                            >
                                <Video size={15} />
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

