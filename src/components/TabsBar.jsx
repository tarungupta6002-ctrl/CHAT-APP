import React from 'react';
import { useSocket } from '../context/SocketContext';
import { useWebRTC } from '../context/WebRTCContext';

export default function TabsBar() {
    const { currentChat, switchChat, activeDmPartners, closeDmTab, unreadCounts } = useSocket();
    const { initiateCall } = useWebRTC();

    const isGeneralActive = currentChat.type === 'general';
    const isDmActive = currentChat.type === 'dm';

    return (
        <nav className="chat-tabs-bar">
            <div className="tabs-scroll-area">
                {/* General Room Tab */}
                <button
                    type="button"
                    className={`chat-tab ${isGeneralActive ? 'active' : ''}`}
                    onClick={() => switchChat({ type: 'general' })}
                >
                    <span className="tab-icon">#</span>
                    <span>General Room</span>
                    {unreadCounts.general > 0 && (
                        <span className="unread-badge">{unreadCounts.general}</span>
                    )}
                </button>

                {/* Direct Message Tabs */}
                <div className="dm-tabs-container">
                    {activeDmPartners.map((partner) => {
                        const isActive = isDmActive && currentChat.partnerId === partner.id;
                        const unreads = unreadCounts[partner.id] || 0;

                        return (
                            <div
                                key={partner.id}
                                className={`chat-tab dm-tab ${isActive ? 'active' : ''}`}
                                onClick={() => switchChat({
                                    type: 'dm',
                                    partnerId: partner.id,
                                    partnerName: partner.username,
                                    partnerColor: partner.color
                                })}
                            >
                                <span className="tab-status-dot"></span>
                                <span className="dm-tab-title">{partner.username}</span>
                                {unreads > 0 && (
                                    <span className="unread-badge">{unreads}</span>
                                )}
                                <button
                                    type="button"
                                    className="close-tab-btn"
                                    title="Close Tab"
                                    onClick={(e) => closeDmTab(partner.id, e)}
                                >
                                    ✕
                                </button>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* 1-on-1 DM Call Action Buttons (Visible only in private DM) */}
            {isDmActive && (
                <div className="dm-call-actions">
                    <button
                        type="button"
                        className="dm-call-btn"
                        title="Start Audio Call"
                        onClick={() => initiateCall(false)}
                    >
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 4V3z" />
                        </svg>
                        <span>Audio</span>
                    </button>
                    <button
                        type="button"
                        className="dm-call-btn video-accent"
                        title="Start Video Call"
                        onClick={() => initiateCall(true)}
                    >
                        <svg viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 6a2 2 0 012-2h6a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" />
                        </svg>
                        <span>Video</span>
                    </button>
                </div>
            )}
        </nav>
    );
}
