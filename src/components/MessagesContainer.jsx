import React, { useEffect, useRef } from 'react';
import { useSocket } from '../context/SocketContext';
import MessageItem from './MessageItem';

export default function MessagesContainer() {
    const { currentChat, conversations } = useSocket();
    const containerRef = useRef(null);

    const activeKey = !currentChat || currentChat.type === 'general'
        ? 'general'
        : (currentChat.partnerName ? currentChat.partnerName.toLowerCase() : (currentChat.partnerId || 'dm'));

    const activeList = conversations[activeKey] || [];

    // Auto scroll to bottom
    useEffect(() => {
        if (containerRef.current) {
            containerRef.current.scrollTop = containerRef.current.scrollHeight;
        }
    }, [activeList.length]);

    return (
        <main className="messages-container" ref={containerRef}>
            {activeList.length === 0 ? (
                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    height: '100%',
                    color: 'var(--text-muted)',
                    textAlign: 'center',
                    padding: '2rem'
                }}>
                    <div style={{ fontSize: '2.5rem', marginBottom: '0.75rem' }}>💬</div>
                    <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>
                        {currentChat.type === 'general' ? 'Welcome to PulseChat General Room!' : `Private chat with ${currentChat.partnerName}`}
                    </div>
                    <div style={{ fontSize: '0.85rem', marginTop: '0.25rem' }}>
                        Say hello, send a voice note, or share a photo to get the conversation started.
                    </div>
                </div>
            ) : (
                activeList.map((item, idx) => (
                    <MessageItem
                        key={item.data?.id || `msg-${idx}`}
                        item={item}
                    />
                ))
            )}
        </main>
    );
}
