import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MeetingProvider, useMeeting, useParticipant } from '@videosdk.live/react-sdk';
import { useWebRTC } from '../context/WebRTCContext';
import { useAuth } from '../context/AuthContext';

// Remote Participant Audio & Video Stream Renderer
function RemoteParticipantView({ participantId, partnerName, partnerColor, callIsVideo }) {
    const videoRef = useRef(null);
    const audioRef = useRef(null);

    const { webcamStream, micStream, webcamOn, micOn } = useParticipant(participantId);

    // Build remote video stream
    const videoStream = useMemo(() => {
        if (webcamOn && webcamStream?.track) {
            const mediaStream = new MediaStream();
            mediaStream.addTrack(webcamStream.track);
            return mediaStream;
        }
        return null;
    }, [webcamStream, webcamOn]);

    // Build remote audio stream
    const audioStream = useMemo(() => {
        if (micOn && micStream?.track) {
            const mediaStream = new MediaStream();
            mediaStream.addTrack(micStream.track);
            return mediaStream;
        }
        return null;
    }, [micStream, micOn]);

    // Bind remote video stream
    useEffect(() => {
        if (videoRef.current) {
            if (videoStream && callIsVideo) {
                videoRef.current.srcObject = videoStream;
                videoRef.current.play().catch((err) => console.log("Remote video play error:", err));
            } else {
                videoRef.current.srcObject = null;
            }
        }
    }, [videoStream, callIsVideo]);

    // Bind remote audio stream
    useEffect(() => {
        if (audioRef.current) {
            if (audioStream) {
                audioRef.current.srcObject = audioStream;
                audioRef.current.play().catch((err) => console.log("Remote audio play error:", err));
            } else {
                audioRef.current.srcObject = null;
            }
        }
    }, [audioStream]);

    const showAvatar = !callIsVideo || !webcamOn;

    return (
        <>
            <video
                id="remote-video"
                ref={videoRef}
                autoPlay
                playsInline
                webkit-playsinline="true"
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    display: showAvatar ? 'none' : 'block'
                }}
            />
            <audio ref={audioRef} autoPlay playsInline />

            {showAvatar && (
                <div className="remote-avatar-placeholder">
                    <div
                        className="remote-avatar-large"
                        style={{ backgroundColor: partnerColor }}
                    >
                        {partnerName.slice(0, 2).toUpperCase()}
                    </div>
                    <span>{partnerName}</span>
                </div>
            )}
        </>
    );
}

// Local Participant Video PiP Renderer (Self Camera View)
function LocalParticipantView({ participantId, isVideoMuted, callIsVideo }) {
    const videoRef = useRef(null);
    const { webcamStream, webcamOn } = useParticipant(participantId);

    // Build local video stream
    const videoStream = useMemo(() => {
        if (webcamOn && webcamStream?.track) {
            const mediaStream = new MediaStream();
            mediaStream.addTrack(webcamStream.track);
            return mediaStream;
        }
        return null;
    }, [webcamStream, webcamOn]);

    // Bind local video stream
    useEffect(() => {
        if (videoRef.current) {
            if (videoStream && !isVideoMuted && callIsVideo) {
                videoRef.current.srcObject = videoStream;
                videoRef.current.play().catch((err) => console.log("Local video play error:", err));
            } else {
                videoRef.current.srcObject = null;
            }
        }
    }, [videoStream, isVideoMuted, callIsVideo]);

    return (
        <div className="local-pip-wrap">
            <video
                id="local-video"
                ref={videoRef}
                autoPlay
                playsInline
                webkit-playsinline="true"
                muted
                style={{
                    width: '100%',
                    height: '100%',
                    objectFit: 'cover',
                    transform: 'scaleX(-1)',
                    display: isVideoMuted || !webcamOn ? 'none' : 'block'
                }}
            />
            {(isVideoMuted || !webcamOn) && (
                <div style={{
                    width: '100%',
                    height: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: '#111b21',
                    color: '#8696a0',
                    fontSize: '0.75rem',
                    textAlign: 'center'
                }}>
                    <span>Camera Off</span>
                </div>
            )}
            <span className="pip-label">You</span>
        </div>
    );
}

// Inner Call Stage inside MeetingProvider
function VideoSDKCallStage() {
    const {
        activeCallPartner,
        callStatus,
        setCallStatus,
        callTimer,
        startTimer,
        isAudioMuted,
        isVideoMuted,
        isCompactMode,
        callIsVideo,
        endCall,
        toggleMic: toggleContextMic,
        toggleCam: toggleContextCam,
        toggleCompact
    } = useWebRTC();

    const {
        join,
        leave,
        toggleMic: sdkToggleMic,
        toggleWebcam: sdkToggleWebcam,
        participants,
        localParticipant
    } = useMeeting({
        onMeetingJoined: () => {
            console.log("[VideoSDK] Meeting joined successfully");
            setCallStatus("Connected");
            startTimer();
        },
        onMeetingLeft: () => {
            console.log("[VideoSDK] Meeting left");
        },
        onParticipantJoined: (p) => {
            console.log("[VideoSDK] Remote participant joined:", p.displayName);
            setCallStatus("Connected");
            startTimer();
        },
        onError: (error) => {
            console.error("[VideoSDK] Meeting error:", error);
        }
    });

    // Auto-join meeting on mount
    useEffect(() => {
        join();
        return () => {
            leave();
        };
    }, []);

    // Sync mic toggle
    const handleToggleMic = () => {
        toggleContextMic();
        sdkToggleMic();
    };

    // Sync cam toggle
    const handleToggleCam = () => {
        toggleContextCam();
        sdkToggleWebcam();
    };

    const partnerName = activeCallPartner.name || 'User';
    const initials = partnerName.slice(0, 2).toUpperCase();
    const partnerColor = activeCallPartner.color || '#00a884';

    // In VideoSDK, 'participants' Map contains remote participants
    const localId = localParticipant?.id;
    const remoteParticipantId = localId
        ? [...participants.keys()].find((id) => id !== localId)
        : [...participants.keys()][0];

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
                    {remoteParticipantId ? (
                        <RemoteParticipantView
                            participantId={remoteParticipantId}
                            partnerName={partnerName}
                            partnerColor={partnerColor}
                            callIsVideo={callIsVideo}
                        />
                    ) : (
                        <div className="remote-avatar-placeholder">
                            <div
                                className="remote-avatar-large"
                                style={{ backgroundColor: partnerColor }}
                            >
                                {initials}
                            </div>
                            <span>
                                {callStatus === 'Connected'
                                    ? `Connected with ${partnerName}`
                                    : `${partnerName} (${callStatus || 'Calling...'})`}
                            </span>
                        </div>
                    )}

                    {/* Local PiP Video Thumbnail (Self-View) */}
                    {callIsVideo && (
                        localId ? (
                            <LocalParticipantView
                                participantId={localId}
                                isVideoMuted={isVideoMuted}
                                callIsVideo={callIsVideo}
                            />
                        ) : (
                            <div className="local-pip-wrap">
                                <div style={{
                                    width: '100%',
                                    height: '100%',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    background: '#111b21',
                                    color: '#8696a0',
                                    fontSize: '0.72rem'
                                }}>
                                    <span>You</span>
                                </div>
                                <span className="pip-label">You</span>
                            </div>
                        )
                    )}
                </div>

                {/* In-Call Controls Dock */}
                <div className="active-call-controls">
                    <button
                        type="button"
                        className={`call-ctrl-btn ${isAudioMuted ? 'off' : 'active'}`}
                        title={isAudioMuted ? 'Unmute Mic' : 'Mute Mic'}
                        onClick={handleToggleMic}
                    >
                        <span className="ctrl-icon">{isAudioMuted ? '🔇' : '🎙️'}</span>
                        <span className="ctrl-label">{isAudioMuted ? 'Unmute' : 'Mute'}</span>
                    </button>

                    {callIsVideo && (
                        <button
                            type="button"
                            className={`call-ctrl-btn ${isVideoMuted ? 'off' : 'active'}`}
                            title={isVideoMuted ? 'Turn Camera On' : 'Turn Camera Off'}
                            onClick={handleToggleCam}
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

// Top-Level Overlay Wrapper (Only mounts MeetingProvider when meetingId & token are available)
export default function ActiveCallOverlay() {
    const { isCallActive, meetingId, videoSDKToken, isAudioMuted, isVideoMuted, callIsVideo } = useWebRTC();
    const { user } = useAuth();

    if (!isCallActive) return null;

    if (!meetingId || !videoSDKToken) {
        return (
            <div className="active-call-overlay">
                <div className="active-call-container">
                    <div className="active-call-header">
                        <div className="active-call-peer-info">
                            <span className="call-status-dot"></span>
                            <span>Setting up call connection...</span>
                        </div>
                    </div>
                    <div className="active-call-stage">
                        <div className="remote-avatar-placeholder">
                            <div className="remote-avatar-large" style={{ backgroundColor: '#00a884' }}>
                                📞
                            </div>
                            <span>Connecting via VideoSDK Cloud...</span>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <MeetingProvider
            config={{
                meetingId,
                micEnabled: !isAudioMuted,
                webcamEnabled: callIsVideo && !isVideoMuted,
                name: user?.username || "You",
                mode: "CONFERENCE"
            }}
            token={videoSDKToken}
        >
            <VideoSDKCallStage />
        </MeetingProvider>
    );
}
