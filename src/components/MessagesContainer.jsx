import React, { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import { MessageSquare, Lock } from 'lucide-react';
import MessageItem from './MessageItem';
import VerifiedBadge from './VerifiedBadge';

// Helper to determine the WhatsApp-style date label for a message
function getMessageDateLabel(item) {
    if (!item) return null;
    const data = item.data;
    if (!data) return null;

    let ts = data.createdAt;
    if (!ts && data.id) {
        // Fallback: extract timestamp from id pattern (socketId-timestamp)
        const parts = String(data.id).split('-');
        if (parts.length >= 2) {
            const parsed = parseInt(parts[parts.length - 1], 10);
            if (!isNaN(parsed) && parsed > 1600000000000) {
                ts = parsed;
            }
        }
    }

    if (!ts) {
        return "Today";
    }

    const d = new Date(ts);
    if (isNaN(d.getTime())) return "Today";

    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diffDays = Math.round((today - target) / (1000 * 60 * 60 * 24));

    if (diffDays === 0) {
        return "Today";
    }
    if (diffDays === 1) {
        return "Yesterday";
    }
    if (diffDays > 1 && diffDays < 7) {
        // Return day name like "Monday", "Tuesday"
        return d.toLocaleDateString([], { weekday: 'long' });
    }

    // Return e.g. "15 October 2026"
    return d.toLocaleDateString([], {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });
}

export default function MessagesContainer({ searchQuery = '' }) {
    const { currentChat, conversations } = useSocket();
    const containerRef = useRef(null);

    const activeKey = !currentChat || currentChat.type === 'general'
        ? 'general'
        : currentChat.type === 'group'
            ? `group:${currentChat.groupId}`
            : (currentChat.partnerName ? currentChat.partnerName.toLowerCase() : (currentChat.partnerId || 'dm'));

    const activeList = conversations[activeKey] || [];

    // Auto scroll to bottom smoothly (only when not actively searching)
    useEffect(() => {
        if (containerRef.current && !searchQuery) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [activeList.length, searchQuery]);

    // Track date groups across list
    let lastDateGroup = null;

    return (
        <main className="messages-container" ref={containerRef}>
            {/* WhatsApp End-to-End Encryption Security Capsule */}
            <div className="wa-e2ee-banner-wrap">
                <div className="wa-e2ee-banner">
                    <Lock size={12} className="wa-e2ee-lock-icon" />
                    <span>Messages and calls are end-to-end encrypted. No one outside of this chat, not even ChatHub, can read or listen to them.</span>
                </div>
            </div>

            {activeList.length === 0 ? (
                <div className="messages-empty-view">
                    <div className="messages-empty-icon-circle">
                        <MessageSquare size={36} />
                    </div>
                    <div className="messages-empty-title" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        {currentChat?.type === 'general' ? (
                            <>
                                <span>Welcome to ChatHub Community!</span>
                                <VerifiedBadge size={18} />
                            </>
                        ) : currentChat?.type === 'group' ? (
                            `Group: ${currentChat?.partnerName || 'Group Chat'}`
                        ) : (
                            `Private chat with ${currentChat?.partnerName || 'User'}`
                        )}
                    </div>
                    <div className="messages-empty-sub">
                        Say hello, send a voice note, or share a photo to get the conversation started.
                    </div>
                </div>
            ) : (
                activeList.map((item, idx) => {
                    const dateGroup = getMessageDateLabel(item);
                    let showDateHeader = false;
                    if (dateGroup && dateGroup !== lastDateGroup) {
                        showDateHeader = true;
                        lastDateGroup = dateGroup;
                    }

                    return (
                        <React.Fragment key={item.data?.id || `msg-${idx}`}>
                            {showDateHeader && (
                                <div className="whatsapp-date-divider-row">
                                    <span className="whatsapp-date-divider-pill">
                                        {dateGroup}
                                    </span>
                                </div>
                            )}
                            <MessageItem item={item} searchQuery={searchQuery} />
                        </React.Fragment>
                    );
                })
            )}
        </main>
    );
}
