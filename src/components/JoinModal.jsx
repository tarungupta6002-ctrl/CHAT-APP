import React, { useState } from 'react';
import { useSocket } from '../context/SocketContext';

export default function JoinModal() {
    const { isJoined, joinChat, currentUser } = useSocket();
    const [nickname, setNickname] = useState(currentUser.username || '');

    if (isJoined) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (nickname.trim()) {
            joinChat(nickname.trim());
        }
    };

    return (
        <div className="modal-overlay">
            <div className="join-card">
                <div className="join-icon-wrap">
                    <svg viewBox="0 0 24 24">
                        <path d="M12 2C6.48 2 2 6.48 2 12c0 1.85.5 3.58 1.38 5.08L2 22l5.08-1.35C8.52 21.48 10.22 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2zm1 14h-2v-2h2v2zm0-4h-2V7h2v5z" />
                    </svg>
                </div>
                <h2>Join the Room</h2>
                <p>Pick a display name to start chatting with others in real-time.</p>
                <form onSubmit={handleSubmit}>
                    <div className="input-group">
                        <label htmlFor="username-input">Your Nickname</label>
                        <input
                            type="text"
                            id="username-input"
                            className="styled-input"
                            placeholder="e.g. Alex, Tarun, Sarah"
                            maxLength={20}
                            value={nickname}
                            onChange={(e) => setNickname(e.target.value)}
                            required
                            autoComplete="off"
                            autoFocus
                        />
                    </div>
                    <button type="submit" className="btn-primary" id="join-btn">
                        <span>Enter Chat</span>
                        <svg style={{ width: 18, height: 18, fill: 'currentColor' }} viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                </form>
            </div>
        </div>
    );
}
