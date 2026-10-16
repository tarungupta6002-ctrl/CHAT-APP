import React from 'react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';
import { Sparkles, Phone, Video, ArrowLeft, Users } from 'lucide-react';
import MessagesContainer from './MessagesContainer';
import TypingBar from './TypingBar';
import ChatFooter from './ChatFooter';

export default function WhatsAppChatWindow({ isAiOpen, setIsAiOpen }) {
    const { currentChat, selectChat, onlineUsers, allRegisteredUsers } = useSocket();
    const { initiateCall } = useWebRTC();

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

    return (
        <section className="whatsapp-chat-stage">
            {/* WhatsApp Chat Header */}
            <header className="whatsapp-chat-header">
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
                        <h3>{partnerName}</h3>
                        <span className="contact-status">
                            {isDm ? (isOnline ? 'online' : 'offline') : 'public community'}
                        </span>
                    </div>
                </div>

                {/* Right Call & AI Action Buttons */}
                <div className="chat-header-actions">
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
                </div>
            </header>

            {/* Messages Content Viewport */}
            <div className="whatsapp-messages-viewport">
                <MessagesContainer />
                <TypingBar />
            </div>

            {/* Chat Input Footer */}
            <ChatFooter />
        </section>
    );
}
