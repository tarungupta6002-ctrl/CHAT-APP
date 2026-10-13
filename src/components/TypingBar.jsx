import React from 'react';
import { useSocket } from '../context/SocketContext';

export default function TypingBar() {
    const { typingInfo } = useSocket();

    if (!typingInfo.isTyping) return null;

    return (
        <div className="typing-bar">
            <span>{typingInfo.text}</span>
            <div className="typing-dots">
                <span></span>
                <span></span>
                <span></span>
            </div>
        </div>
    );
}
