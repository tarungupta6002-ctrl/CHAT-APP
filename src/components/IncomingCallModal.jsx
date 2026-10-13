import React from 'react';
import { useWebRTC } from '../context/WebRTCContext';

export default function IncomingCallModal() {
    const { pendingIncomingCall, acceptCall, declineCall } = useWebRTC();

    if (!pendingIncomingCall) return null;

    const callerName = pendingIncomingCall.fromName || 'User';
    const callerInitials = callerName.slice(0, 2).toUpperCase();
    const callerColor = pendingIncomingCall.fromColor || '#6366f1';

    return (
        <div className="call-modal-overlay">
            <div className="incoming-call-card">
                <div className="caller-avatar-pulse-wrap">
                    <div className="pulse-ring ring-1"></div>
                    <div className="pulse-ring ring-2"></div>
                    <div
                        className="caller-avatar-circle"
                        style={{ backgroundColor: callerColor }}
                    >
                        {callerInitials}
                    </div>
                </div>
                <h3>{callerName}</h3>
                <p>
                    {pendingIncomingCall.isVideo
                        ? 'Incoming Video Call... 📹'
                        : 'Incoming Voice Call... 📞'}
                </p>
                <div className="incoming-call-actions">
                    <button
                        type="button"
                        className="call-btn btn-decline"
                        title="Decline Call"
                        onClick={declineCall}
                    >
                        <svg viewBox="0 0 24 24">
                            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C2.51 9.4 6.94 8 12 8s9.49 1.4 11.71 3.67c.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                        </svg>
                        <span>Decline</span>
                    </button>
                    <button
                        type="button"
                        className="call-btn btn-accept"
                        title="Accept Call"
                        onClick={acceptCall}
                    >
                        <svg viewBox="0 0 24 24">
                            <path d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.44-5.15-3.75-6.59-6.59l1.97-1.57c.28-.28.37-.68.25-1.02A11.36 11.36 0 0 1 8.96 4.3c0-.55-.45-1-1-1H4.07c-.55 0-1 .45-1 1 0 9.39 7.61 17 17 17 .55 0 1-.45 1-1v-3.89c0-.55-.45-1-1-.03z" />
                        </svg>
                        <span>Accept</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
