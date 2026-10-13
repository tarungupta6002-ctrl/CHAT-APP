import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { useSocket } from './SocketContext';

const WebRTCContext = createContext(null);

const RTC_CONFIG = {
    iceServers: [
        { urls: "stun:stun.l.google.com:19302" },
        { urls: "stun:stun1.l.google.com:19302" },
        { urls: "stun:stun2.l.google.com:19302" },
        { urls: "stun:stun3.l.google.com:19302" },
        { urls: "stun:stun4.l.google.com:19302" },
        { urls: "stun:stun.relay.metered.ca:80" },
        {
            urls: "turn:openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:openrelay.metered.ca:443?transport=tcp",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turn:staticauth.openrelay.metered.ca:80",
            username: "openrelayproject",
            credential: "openrelayproject"
        },
        {
            urls: "turns:staticauth.openrelay.metered.ca:443",
            username: "openrelayproject",
            credential: "openrelayproject"
        }
    ],
    iceCandidatePoolSize: 10
};

export function WebRTCProvider({ children }) {
    const { socket, currentChat, isSoundMuted } = useSocket();

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
    const [remoteVideoAvailable, setRemoteVideoAvailable] = useState(false);

    // Media Streams in React State (Ensures components re-render and attach srcObject)
    const [localStream, setLocalStream] = useState(null);
    const [remoteStream, setRemoteStream] = useState(null);

    // Internal refs
    const localVideoRef = useRef(null);
    const remoteVideoRef = useRef(null);
    const remoteAudioRef = useRef(null);
    const peerConnectionRef = useRef(null);
    const localStreamRef = useRef(null);
    const remoteStreamRef = useRef(null);
    const iceQueueRef = useRef([]);
    const callTimerIntervalRef = useRef(null);
    const ringtoneAudioCtxRef = useRef(null);
    const ringtoneIntervalRef = useRef(null);
    const callSecondsRef = useRef(0);
    const disconnectTimeoutRef = useRef(null);

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
        clearTimeout(disconnectTimeoutRef.current);
        disconnectTimeoutRef.current = null;

        setIsCallActive(false);
        setPendingIncomingCall(null);
        setActiveCallPartner({ id: null, name: '', color: '#00a884' });
        iceQueueRef.current = [];
        setCallStatus('');
        setRemoteVideoAvailable(false);

        if (localStreamRef.current) {
            localStreamRef.current.getTracks().forEach((t) => t.stop());
            localStreamRef.current = null;
        }
        remoteStreamRef.current = null;
        setLocalStream(null);
        setRemoteStream(null);

        if (peerConnectionRef.current) {
            peerConnectionRef.current.close();
            peerConnectionRef.current = null;
        }

        if (localVideoRef.current) localVideoRef.current.srcObject = null;
        if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
        if (remoteAudioRef.current) remoteAudioRef.current.srcObject = null;
    }, [stopRingtone, stopTimer]);

    // End Call
    const endCall = useCallback((notifyRemote = true) => {
        if (notifyRemote && activeCallPartner.id && socket) {
            socket.emit("call-end", { to: activeCallPartner.id });
        }
        cleanupCall();
    }, [activeCallPartner.id, socket, cleanupCall]);

    // Get Media Stream with fallback
    const getMediaStream = useCallback(async (isVideo) => {
        try {
            return await navigator.mediaDevices.getUserMedia({
                audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
                video: isVideo ? { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } : false
            });
        } catch (err) {
            console.warn("Retrying getUserMedia with basic constraints:", err);
            return await navigator.mediaDevices.getUserMedia({
                audio: true,
                video: isVideo ? true : false
            });
        }
    }, []);

    // Flush ICE candidates
    const flushIceQueue = useCallback(async () => {
        while (iceQueueRef.current.length > 0) {
            const cand = iceQueueRef.current.shift();
            try {
                if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription) {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(cand));
                }
            } catch (err) {
                console.warn("Error adding queued ICE candidate:", err);
            }
        }
    }, []);

    // Create RTCPeerConnection
    const createPeerConnection = useCallback((targetSocketId) => {
        const pc = new RTCPeerConnection(RTC_CONFIG);
        const unifiedRemoteStream = new MediaStream();
        remoteStreamRef.current = unifiedRemoteStream;
        setRemoteStream(unifiedRemoteStream);

        pc.onicecandidate = (event) => {
            if (event.candidate && socket) {
                socket.emit("ice-candidate", {
                    to: targetSocketId,
                    candidate: event.candidate
                });
            }
        };

        pc.ontrack = (event) => {
            console.log("[WebRTC] Track received:", event.track.kind);
            unifiedRemoteStream.addTrack(event.track);

            // Re-trigger stream reference in state
            setRemoteStream(new MediaStream(unifiedRemoteStream.getTracks()));

            if (event.track.kind === "video") {
                setRemoteVideoAvailable(true);
                event.track.onunmute = () => {
                    console.log("[WebRTC] Video unmuted");
                    setRemoteVideoAvailable(true);
                    setRemoteStream(new MediaStream(unifiedRemoteStream.getTracks()));
                };
            }

            if (event.track.kind === "audio") {
                event.track.onunmute = () => {
                    console.log("[WebRTC] Audio unmuted");
                    setRemoteStream(new MediaStream(unifiedRemoteStream.getTracks()));
                };
            }
        };

        pc.oniceconnectionstatechange = () => {
            console.log("[WebRTC] ICE state:", pc.iceConnectionState);
            if (pc.iceConnectionState === "connected" || pc.iceConnectionState === "completed") {
                clearTimeout(disconnectTimeoutRef.current);
                setCallStatus("Connected");
                startTimer();
            }
            if (pc.iceConnectionState === "disconnected") {
                setCallStatus("Reconnecting...");
                disconnectTimeoutRef.current = setTimeout(() => {
                    if (peerConnectionRef.current?.iceConnectionState === "disconnected") {
                        endCall(true);
                    }
                }, 15000);
            }
            if (pc.iceConnectionState === "failed") {
                setCallStatus("Connection Failed");
                disconnectTimeoutRef.current = setTimeout(() => {
                    if (peerConnectionRef.current?.iceConnectionState === "failed") {
                        endCall(true);
                    }
                }, 10000);
            }
        };

        pc.onconnectionstatechange = () => {
            console.log("[WebRTC] Connection state:", pc.connectionState);
            if (pc.connectionState === "connected") {
                clearTimeout(disconnectTimeoutRef.current);
                setCallStatus("Connected");
                startTimer();
            }
            if (pc.connectionState === "failed") {
                endCall(true);
            }
        };

        peerConnectionRef.current = pc;
        return pc;
    }, [socket, startTimer, endCall]);

    // Initiate Call
    const initiateCall = useCallback(async (isVideo, targetUser = null) => {
        if (isCallActive) return alert("A call is already active.");

        const partnerId = targetUser?.id || (currentChat.type === "dm" ? currentChat.partnerId : null);
        const partnerName = targetUser?.username || currentChat.partnerName || "User";
        const partnerColor = targetUser?.color || currentChat.partnerColor || "#00a884";

        if (!partnerId) {
            return alert("Please select a private chat to start a call.");
        }

        setActiveCallPartner({ id: partnerId, name: partnerName, color: partnerColor });
        setCallIsVideo(isVideo);
        setIsAudioMuted(false);
        setIsVideoMuted(!isVideo);
        setIsCallActive(true);
        setCallStatus(`Calling ${partnerName}...`);
        iceQueueRef.current = [];

        try {
            const stream = await getMediaStream(isVideo);
            localStreamRef.current = stream;
            setLocalStream(stream);

            const pc = createPeerConnection(partnerId);
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            const offer = await pc.createOffer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await pc.setLocalDescription(offer);

            socket?.emit("call-offer", {
                to: partnerId,
                offer: offer,
                isVideo: isVideo
            });
        } catch (err) {
            console.error("Initiate call failed:", err);
            cleanupCall();
            alert("Could not access camera or microphone: " + err.message);
        }
    }, [isCallActive, currentChat, getMediaStream, createPeerConnection, socket, cleanupCall]);

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
        setCallStatus("Connecting...");

        try {
            const stream = await getMediaStream(data.isVideo);
            localStreamRef.current = stream;
            setLocalStream(stream);

            const pc = createPeerConnection(data.from);
            stream.getTracks().forEach((track) => pc.addTrack(track, stream));

            await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
            await flushIceQueue();

            const answer = await pc.createAnswer({
                offerToReceiveAudio: true,
                offerToReceiveVideo: true
            });
            await pc.setLocalDescription(answer);

            socket?.emit("call-answer", {
                to: data.from,
                answer: answer
            });

            startTimer();
        } catch (err) {
            console.error("Accept call error:", err);
            cleanupCall();
            socket?.emit("call-reject", { to: data.from });
            alert("Failed to connect call: " + err.message);
        }
    }, [pendingIncomingCall, stopRingtone, getMediaStream, createPeerConnection, flushIceQueue, socket, startTimer, cleanupCall]);

    // Decline Incoming Call
    const declineCall = useCallback(() => {
        stopRingtone();
        if (pendingIncomingCall && socket) {
            socket.emit("call-reject", { to: pendingIncomingCall.from });
        }
        setPendingIncomingCall(null);
    }, [stopRingtone, pendingIncomingCall, socket]);

    // Toggle Mic
    const toggleMic = useCallback(() => {
        if (!localStreamRef.current) return;
        const track = localStreamRef.current.getAudioTracks()[0];
        if (track) {
            const next = !track.enabled;
            track.enabled = next;
            setIsAudioMuted(!next);
        }
    }, []);

    // Toggle Cam
    const toggleCam = useCallback(() => {
        if (!localStreamRef.current) return;
        const track = localStreamRef.current.getVideoTracks()[0];
        if (track) {
            const next = !track.enabled;
            track.enabled = next;
            setIsVideoMuted(!next);
        }
    }, []);

    const toggleCompact = useCallback(() => {
        setIsCompactMode((prev) => !prev);
    }, []);

    // Socket Event Listeners for WebRTC Signaling
    useEffect(() => {
        if (!socket) return;

        const handleIncomingCall = (data) => {
            if (isCallActive) {
                socket.emit("call-reject", { to: data.from });
                return;
            }
            setPendingIncomingCall(data);
            startRingtone();
        };

        const handleCallAnswered = async (data) => {
            if (peerConnectionRef.current && data.answer) {
                try {
                    await peerConnectionRef.current.setRemoteDescription(new RTCSessionDescription(data.answer));
                    await flushIceQueue();
                    setCallStatus("Connected");
                    startTimer();
                } catch (err) {
                    console.error("Error setting remote description:", err);
                }
            }
        };

        const handleIceCandidate = async (data) => {
            if (!data.candidate) return;
            if (peerConnectionRef.current && peerConnectionRef.current.remoteDescription && peerConnectionRef.current.remoteDescription.type) {
                try {
                    await peerConnectionRef.current.addIceCandidate(new RTCIceCandidate(data.candidate));
                } catch (err) {
                    console.error("Error adding ICE candidate:", err);
                }
            } else {
                iceQueueRef.current.push(data.candidate);
            }
        };

        const handleCallRejected = () => {
            alert(`${activeCallPartner.name || "User"} declined the call.`);
            cleanupCall();
        };

        const handleCallEnded = () => {
            cleanupCall();
        };

        const handleCallFailed = (data) => {
            alert(data.reason || "Call failed.");
            cleanupCall();
        };

        socket.on("incoming-call", handleIncomingCall);
        socket.on("call-answered", handleCallAnswered);
        socket.on("ice-candidate", handleIceCandidate);
        socket.on("call-rejected", handleCallRejected);
        socket.on("call-ended", handleCallEnded);
        socket.on("call-failed", handleCallFailed);

        return () => {
            socket.off("incoming-call", handleIncomingCall);
            socket.off("call-answered", handleCallAnswered);
            socket.off("ice-candidate", handleIceCandidate);
            socket.off("call-rejected", handleCallRejected);
            socket.off("call-ended", handleCallEnded);
            socket.off("call-failed", handleCallFailed);
        };
    }, [socket, isCallActive, activeCallPartner.name, startRingtone, flushIceQueue, startTimer, cleanupCall]);

    const value = {
        isCallActive,
        pendingIncomingCall,
        activeCallPartner,
        callIsVideo,
        callStatus,
        callTimer,
        isAudioMuted,
        isVideoMuted,
        isCompactMode,
        remoteVideoAvailable,
        localStream,
        remoteStream,
        localVideoRef,
        remoteVideoRef,
        remoteAudioRef,
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
