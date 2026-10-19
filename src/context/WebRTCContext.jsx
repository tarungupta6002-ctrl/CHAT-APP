import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext';
import { useAuth } from './AuthContext';

const WebRTCContext = createContext(null);

export function WebRTCProvider({ children }) {
    const { socket, currentChat, isSoundMuted, onlineUsers } = useSocket();
    const { user, token: authToken } = useAuth();

    // Call States
    const [isCallActive, setIsCallActive] = useState(false);
    const [pendingIncomingCall, setPendingIncomingCall] = useState(null);
    const [activeCallPartner, setActiveCallPartner] = useState({ id: null, name: '', color: '#00a884' });
    const [callIsVideo, setCallIsVideo] = useState(true);
    const [callStatus, setCallStatus] = useState('');
    const [callTimer, setCallTimer] = useState('00:00');
    const [isAudioMuted, setIsAudioMuted] = useState(false);
    const [isVideoMuted, setIsVideoMuted] = useState(false);
    const [isCompactMode, setIsCompactMode] = useState(false);

    // VideoSDK specific state
    const [meetingId, setMeetingId] = useState(null);
    const [videoSDKToken, setVideoSDKToken] = useState(null);

    // Refs
    const callTimerIntervalRef = useRef(null);
    const ringtoneAudioCtxRef = useRef(null);
    const ringtoneIntervalRef = useRef(null);
    const callSecondsRef = useRef(0);

    // Ringtone generator using Web Audio API
    const startRingtone = useCallback(() => {
        if (isSoundMuted) return;
        try {
            const AudioCtx = window.AudioContext || window.webkitAudioContext;
            const ctx = new AudioCtx();
            ringtoneAudioCtxRef.current = ctx;

            const playBeep = () => {
                if (!ringtoneAudioCtxRef.current) return;
                const osc = ringtoneAudioCtxRef.current.createOscillator();
                const gain = ringtoneAudioCtxRef.current.createGain();
                osc.type = "sine";
                osc.frequency.setValueAtTime(440, ringtoneAudioCtxRef.current.currentTime);
                osc.frequency.setValueAtTime(480, ringtoneAudioCtxRef.current.currentTime + 0.1);

                gain.gain.setValueAtTime(0.2, ringtoneAudioCtxRef.current.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ringtoneAudioCtxRef.current.currentTime + 1.2);

                osc.connect(gain);
                gain.connect(ringtoneAudioCtxRef.current.destination);

                osc.start();
                osc.stop(ringtoneAudioCtxRef.current.currentTime + 1.2);
            };

            playBeep();
            ringtoneIntervalRef.current = setInterval(playBeep, 3000);
        } catch (e) {
            console.warn("Ringtone error:", e);
        }
    }, [isSoundMuted]);

    const stopRingtone = useCallback(() => {
        if (ringtoneIntervalRef.current) {
            clearInterval(ringtoneIntervalRef.current);
            ringtoneIntervalRef.current = null;
        }
        if (ringtoneAudioCtxRef.current) {
            try { ringtoneAudioCtxRef.current.close(); } catch (e) {}
            ringtoneAudioCtxRef.current = null;
        }
    }, []);

    // Timer controls
    const startTimer = useCallback(() => {
        if (callTimerIntervalRef.current) return;
        callSecondsRef.current = 0;
        setCallTimer("00:00");
        callTimerIntervalRef.current = setInterval(() => {
            callSecondsRef.current += 1;
            const m = Math.floor(callSecondsRef.current / 60);
            const s = callSecondsRef.current % 60;
            setCallTimer(`${m < 10 ? "0" : ""}${m}:${s < 10 ? "0" : ""}${s}`);
        }, 1000);
    }, []);

    const stopTimer = useCallback(() => {
        if (callTimerIntervalRef.current) {
            clearInterval(callTimerIntervalRef.current);
            callTimerIntervalRef.current = null;
        }
        callSecondsRef.current = 0;
        setCallTimer("00:00");
    }, []);

    // Cleanup entire call
    const cleanupCall = useCallback(() => {
        stopRingtone();
        stopTimer();

        setIsCallActive(false);
        setPendingIncomingCall(null);
        setActiveCallPartner({ id: null, name: '', color: '#00a884' });
        setCallStatus('');
        setMeetingId(null);
        setVideoSDKToken(null);
        setIsAudioMuted(false);
        setIsVideoMuted(false);
    }, [stopRingtone, stopTimer]);

    // End Call
    const endCall = useCallback((notifyRemote = true) => {
        const currentMeetingId = meetingId;
        const duration = callSecondsRef.current;
        const partnerSocketId = activeCallPartner.id;

        if (notifyRemote && partnerSocketId && socket) {
            socket.emit("call-end", { to: partnerSocketId, roomId: currentMeetingId, durationSeconds: duration });
        }

        if (currentMeetingId && authToken) {
            fetch("/api/calls/update-status", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    roomId: currentMeetingId,
                    status: "completed",
                    durationSeconds: duration
                })
            }).catch(() => {});
        }

        cleanupCall();
    }, [activeCallPartner.id, meetingId, authToken, socket, cleanupCall]);

    // Initiate Call (Uses VideoSDK cloud room)
    const initiateCall = useCallback(async (isVideo, targetUser = null) => {
        if (isCallActive) return alert("A call is already active.");

        const partnerName = targetUser?.username || (currentChat?.type === "dm" ? currentChat.partnerName : null);
        const partnerColor = targetUser?.color || currentChat?.partnerColor || "#00a884";

        if (!partnerName) {
            return alert("Please select a private chat to start a call.");
        }

        // Look up recipient in active online users list
        const onlineEntry = onlineUsers.find(
            (u) => u.username && u.username.toLowerCase() === partnerName.toLowerCase()
        );

        let partnerSocketId = targetUser?.id || currentChat?.partnerId || (onlineEntry ? onlineEntry.id : null);
        if (onlineEntry) partnerSocketId = onlineEntry.id;

        if (!onlineEntry && !partnerSocketId) {
            return alert(`${partnerName} is currently offline. Both users must be online to connect.`);
        }

        setActiveCallPartner({ id: partnerSocketId, name: partnerName, color: partnerColor });
        setCallIsVideo(isVideo);
        setIsAudioMuted(false);
        setIsVideoMuted(!isVideo);
        setIsCallActive(true);
        setCallStatus(`Calling ${partnerName}...`);
        startRingtone();

        try {
            // Pre-request media device permissions synchronously under user gesture context for mobile browsers
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const preStream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: Boolean(isVideo)
                    });
                    preStream.getTracks().forEach((t) => t.stop());
                } catch (permErr) {
                    console.warn("[WebRTC] Media permission pre-check:", permErr?.message);
                }
            }

            // Request room creation from backend
            const res = await fetch("/api/calls/create-room", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${authToken}`
                },
                body: JSON.stringify({
                    receiverUsername: partnerName,
                    callType: isVideo ? "video" : "audio"
                })
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to create calling session");
            }

            const { roomId, token } = await res.json();
            setMeetingId(roomId);
            setVideoSDKToken(token);

            // Signal recipient via Socket.IO with target username and socket id
            socket?.emit("call-offer", {
                to: partnerSocketId,
                toUsername: partnerName,
                roomId: roomId,
                isVideo: isVideo
            });
        } catch (err) {
            console.error("Initiate call error:", err);
            cleanupCall();
            alert("Could not start call: " + err.message);
        }
    }, [isCallActive, currentChat, onlineUsers, authToken, socket, startRingtone, cleanupCall]);

    // Accept Incoming Call
    const acceptCall = useCallback(async () => {
        stopRingtone();
        if (!pendingIncomingCall) return;

        const data = pendingIncomingCall;
        setPendingIncomingCall(null);
        setActiveCallPartner({ id: data.from, name: data.fromName, color: data.fromColor || '#00a884' });
        setCallIsVideo(data.isVideo);
        setIsAudioMuted(false);
        setIsVideoMuted(!data.isVideo);
        setIsCallActive(true);
        setCallStatus("Connecting to VideoSDK...");

        try {
            // Pre-request media device permissions synchronously under user accept gesture
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                try {
                    const preStream = await navigator.mediaDevices.getUserMedia({
                        audio: true,
                        video: Boolean(data.isVideo)
                    });
                    preStream.getTracks().forEach((t) => t.stop());
                } catch (permErr) {
                    console.warn("[WebRTC] Accept media pre-check:", permErr?.message);
                }
            }

            // Fetch participant token for this room
            const res = await fetch(`/api/calls/token?roomId=${data.roomId}`, {
                headers: { Authorization: `Bearer ${authToken}` }
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to fetch participant token");
            }

            const { token } = await res.json();
            setMeetingId(data.roomId);
            setVideoSDKToken(token);

            // Notify caller that call was answered
            socket?.emit("call-answer", {
                to: data.from,
                toUsername: data.fromName,
                roomId: data.roomId
            });
        } catch (err) {
            console.error("Accept call error:", err);
            cleanupCall();
            socket?.emit("call-reject", { to: data.from, roomId: data.roomId, reason: "Token error" });
            alert("Failed to join call: " + err.message);
        }
    }, [pendingIncomingCall, stopRingtone, authToken, socket, cleanupCall]);

    // Decline Incoming Call
    const declineCall = useCallback(() => {
        stopRingtone();
        if (pendingIncomingCall && socket) {
            socket.emit("call-reject", { to: pendingIncomingCall.from, roomId: pendingIncomingCall.roomId, reason: "declined" });
        }
        setPendingIncomingCall(null);
    }, [stopRingtone, pendingIncomingCall, socket]);

    // Controls
    const toggleMic = useCallback(() => {
        setIsAudioMuted((prev) => !prev);
    }, []);

    const toggleCam = useCallback(() => {
        setIsVideoMuted((prev) => !prev);
    }, []);

    const toggleCompact = useCallback(() => {
        setIsCompactMode((prev) => !prev);
    }, []);

    // Socket Event Listeners for Call Signaling
    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = (data) => {
            if (isCallActive) {
                socket.emit("call-reject", { to: data.from, roomId: data.roomId, reason: "busy" });
                return;
            }
            setPendingIncomingCall(data);
            startRingtone();
        };

        const handleCallAnswered = () => {
            stopRingtone();
            setCallStatus("Connecting...");
        };

        const handleCallRejected = (data) => {
            stopRingtone();
            alert(`${activeCallPartner.name || "User"} declined the call.`);
            cleanupCall();
        };

        const handleCallEnded = () => {
            cleanupCall();
        };

        const handleCallFailed = (data) => {
            stopRingtone();
            alert(data.reason || "Call failed.");
            cleanupCall();
        };

        socket.on("incoming-call", handleIncomingCall);
        socket.on("call-answered", handleCallAnswered);
        socket.on("call-rejected", handleCallRejected);
        socket.on("call-ended", handleCallEnded);
        socket.on("call-failed", handleCallFailed);

        return () => {
            socket.off("incoming-call", handleIncomingCall);
            socket.off("call-answered", handleCallAnswered);
            socket.off("call-rejected", handleCallRejected);
            socket.off("call-ended", handleCallEnded);
            socket.off("call-failed", handleCallFailed);
        };
    }, [socket, isCallActive, activeCallPartner.name, startRingtone, stopRingtone, cleanupCall]);

    const value = {
        isCallActive,
        pendingIncomingCall,
        activeCallPartner,
        callIsVideo,
        callStatus,
        setCallStatus,
        callTimer,
        startTimer,
        stopTimer,
        meetingId,
        videoSDKToken,
        isAudioMuted,
        isVideoMuted,
        isCompactMode,
        initiateCall,
        acceptCall,
        declineCall,
        endCall,
        toggleMic,
        toggleCam,
        toggleCompact
    };

    return (
        <WebRTCContext.Provider value={value}>
            {children}
        </WebRTCContext.Provider>
    );
}

export function useWebRTC() {
    const ctx = useContext(WebRTCContext);
    if (!ctx) throw new Error("useWebRTC must be used within a WebRTCProvider");
    return ctx;
}
