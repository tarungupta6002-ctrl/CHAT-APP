import React, { useEffect } from 'react';
import { useWebRTC } from '../context/WebRTCContext';

export default function ActiveCallOverlay() {
    const {
        isCallActive,
        activeCallPartner,
        callStatus,
        callTimer,
        isAudioMuted,
        isVideoMuted,
        isCompactMode,
        callIsVideo,
        remoteVideoAvailable,
        localStream,
        remoteStream,
        localVideoRef,
        remoteVideoRef,
        remoteAudioRef,
        endCall,
        toggleMic,
        toggleCam,
        toggleCompact
    } = useWebRTC();

    // Automatically bind local video stream whenever mounted or updated
    useEffect(() => {
        if (localVideoRef.current && localStream) {
            localVideoRef.current.srcObject = localStream;
            localVideoRef.current.play().catch((err) => console.log("Local video play err:", err));
        }
    }, [localStream, isCallActive]);

    // Automatically bind remote video and audio stream with mobile tap fallback
    useEffect(() => {
        if (remoteVideoRef.current && remoteStream) {
            remoteVideoRef.current.srcObject = remoteStream;
            remoteVideoRef.current.play().catch((err) => {
                console.warn("[WebRTC] Autoplay blocked, waiting for tap:", err);
                const retry = () => {
                    remoteVideoRef.current?.play().catch(() => {});
                    if (remoteAudioRef.current) remoteAudioRef.current.play().catch(() => {});
                    document.removeEventListener("touchstart", retry);
                    document.removeEventListener("click", retry);
                };
                document.addEventListener("touchstart", retry, { once: true });
                document.addEventListener("click", retry, { once: true });
            });
        }
        if (remoteAudioRef.current && remoteStream) {
            remoteAudioRef.current.srcObject = remoteStream;
            remoteAudioRef.current.play().catch(() => {});
        }
    }, [remoteStream, isCallActive]);

    if (!isCallActive) return null;

    const partnerName = activeCallPartner.name || 'User';
    const initials = partnerName.slice(0, 2).toUpperCase();
    const partnerColor = activeCallPartner.color || '#00a884';

    const showAvatarPlaceholder = !callIsVideo || (!remoteVideoAvailable && callStatus !== "Connected");

    return (
        <div className="active-call-overlay">
            <div className={`active-call-container ${isCompactMode ? 'compact-mode' : ''}`}>
                {/* Header */}
                <div className="active-call-header">
                    <div className="active-call-peer-info">
                        <span className="call-status-dot"></span>
                        <span>{partnerName} • {callStatus || 'Connecting...'}</span>
                        <span className="call-timer-badge">{callTimer}</span>
                    </div>
                    <button
                        type="button"
                        className="call-icon-btn"
                        title="Toggle Compact Mode"
                        onClick={toggleCompact}
                    >
                        {isCompactMode ? '🗖' : '🗗'}
                    </button>
                </div>

                {/* Call Stage */}
                <div className="active-call-stage">
                    {/* Remote Video */}
                    <video
                        ref={remoteVideoRef}
                        autoPlay
                        playsInline
                        webkit-playsinline="true"
                        style={{ display: showAvatarPlaceholder ? 'none' : 'block' }}
                    />
                    
                    {/* Remote Audio element (Unmuted, guarantees audio playback even if video element fails) */}
                    <audio ref={remoteAudioRef} autoPlay playsInline />

                    {/* Remote Avatar Placeholder */}
                    {showAvatarPlaceholder && (
                        <div className="remote-avatar-placeholder">
                            <div
                                className="remote-avatar-large"
                                style={{ backgroundColor: partnerColor }}
                            >
                                {initials}
                            </div>
                            <span>{callStatus === 'Connected' ? partnerName : `${partnerName} (${callStatus || 'Connecting...'})`}</span>
                        </div>
                    )}

                    {/* Local PiP Video Thumbnail */}
                    <div className="local-pip-wrap">
                        <video
                            ref={localVideoRef}
                            autoPlay
                            playsInline
                            webkit-playsinline="true"
                            muted
                            style={{ display: isVideoMuted ? 'none' : 'block' }}
                        />
                        <span className="pip-label">You</span>
                    </div>
                </div>

                {/* In-Call Controls Dock */}
                <div className="active-call-controls">
                    <button
                        type="button"
                        className={`call-ctrl-btn ${isAudioMuted ? 'off' : 'active'}`}
                        title={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
                        onClick={toggleMic}
                    >
                        <span className="ctrl-icon">{isAudioMuted ? '🔇' : '🎙️'}</span>
                        <span className="ctrl-label">{isAudioMuted ? 'Unmute' : 'Mute'}</span>
                    </button>

                    {callIsVideo && (
                        <button
                            type="button"
                            className={`call-ctrl-btn ${isVideoMuted ? 'off' : 'active'}`}
                            title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
                            onClick={toggleCam}
                        >
                            <span className="ctrl-icon">{isVideoMuted ? '🚫' : '📹'}</span>
                            <span className="ctrl-label">{isVideoMuted ? 'Turn On' : 'Camera'}</span>
                        </button>
                    )}

                    <button
                        type="button"
                        className="call-ctrl-btn btn-hangup"
                        title="End Call"
                        onClick={() => endCall(true)}
                    >
                        <svg viewBox="0 0 24 24">
                            <path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08a.996.996 0 0 1 0-1.41C2.51 9.4 6.94 8 12 8s9.49 1.4 11.71 3.67c.39.39.39 1.02 0 1.41l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z" />
                        </svg>
                        <span className="ctrl-label">End</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
