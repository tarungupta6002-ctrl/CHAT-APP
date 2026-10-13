import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
    const { isAuthenticated, setCurrentView } = useAuth();

    return (
        <div className="landing-page-container fullscreen-mode">
            {/* Top Navigation */}
            <header className="landing-nav">
                <div className="landing-nav-brand">
                    <div className="landing-brand-logo">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                        </svg>
                    </div>
                    <span className="landing-brand-name">PulseChat</span>
                    <span className="live-status-pill">● Live</span>
                </div>

                <div className="landing-nav-actions">
                    {isAuthenticated ? (
                        <button
                            type="button"
                            className="landing-btn-primary"
                            onClick={() => setCurrentView('chat')}
                        >
                            Open Web App →
                        </button>
                    ) : (
                        <>
                            <button
                                type="button"
                                className="landing-btn-secondary"
                                onClick={() => setCurrentView('auth')}
                            >
                                Log In
                            </button>
                            <button
                                type="button"
                                className="landing-btn-primary"
                                onClick={() => setCurrentView('auth')}
                            >
                                Get Started Free
                            </button>
                        </>
                    )}
                </div>
            </header>

            {/* Main Fullscreen Hero Section */}
            <main className="landing-main-fullscreen">
                {/* Left Hero Column */}
                <div className="hero-left-column">
                    <div className="hero-badge">
                        <span className="hero-badge-dot"></span>
                        <span>WebRTC Video Calling • WhatsApp Web UI</span>
                    </div>

                    <h1 className="hero-title">
                        Simple. Fast. <br />
                        <span className="gradient-text">Private Messaging.</span>
                    </h1>

                    <p className="hero-subtitle">
                        Connect seamlessly across laptop and mobile with crystal clear 1-on-1 audio & video calls,
                        separate private chats, studio voice notes, and view-once media.
                    </p>

                    <div className="hero-cta-group">
                        <button
                            type="button"
                            className="landing-btn-primary large"
                            onClick={() => setCurrentView(isAuthenticated ? 'chat' : 'auth')}
                        >
                            <span>{isAuthenticated ? 'Open PulseChat Web' : 'Start Chatting Now'}</span>
                            <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 18, height: 18 }}>
                                <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                            </svg>
                        </button>

                        {!isAuthenticated && (
                            <button
                                type="button"
                                className="landing-btn-secondary large"
                                onClick={() => setCurrentView('auth')}
                            >
                                Sign In
                            </button>
                        )}
                    </div>

                    {/* Feature Highlights Pills */}
                    <div className="hero-feature-pills">
                        <span className="feature-pill">📹 HD Video Calls</span>
                        <span className="feature-pill">🎙️ Voice Notes</span>
                        <span className="feature-pill">① View Once</span>
                        <span className="feature-pill">🔒 Cloud Sync</span>
                        <span className="feature-pill">📱 Mobile PWA</span>
                    </div>
                </div>

                {/* Right Interactive App Mockup Preview */}
                <div className="hero-right-column">
                    <div className="hero-mockup-wrapper">
                        <div className="hero-mockup-window">
                            <div className="mockup-header">
                                <div className="mockup-dots">
                                    <span className="dot red"></span>
                                    <span className="dot yellow"></span>
                                    <span className="dot green"></span>
                                </div>
                                <div className="mockup-title">pulsechat.web — Active Call & Chat</div>
                            </div>

                            <div className="mockup-body">
                                <div className="mockup-sidebar">
                                    <div className="mockup-chat active">
                                        <div className="mockup-avatar green">TG</div>
                                        <div className="mockup-chat-info">
                                            <div className="mockup-chat-top">
                                                <strong>Tarun Gupta</strong>
                                                <span style={{ color: '#00a884' }}>Online</span>
                                            </div>
                                            <div className="mockup-chat-preview">📹 In Video Call</div>
                                        </div>
                                    </div>
                                    <div className="mockup-chat">
                                        <div className="mockup-avatar purple">AL</div>
                                        <div className="mockup-chat-info">
                                            <div className="mockup-chat-top">
                                                <strong>Alex Rivera</strong>
                                                <span>12:45 PM</span>
                                            </div>
                                            <div className="mockup-chat-preview">🎙️ Voice note (0:14)</div>
                                        </div>
                                    </div>
                                    <div className="mockup-chat">
                                        <div className="mockup-avatar orange">#</div>
                                        <div className="mockup-chat-info">
                                            <div className="mockup-chat-top">
                                                <strong>General Room</strong>
                                                <span>11:20 AM</span>
                                            </div>
                                            <div className="mockup-chat-preview">Welcome everyone!</div>
                                        </div>
                                    </div>
                                </div>

                                <div className="mockup-stage">
                                    <div className="mockup-stage-header">
                                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                            <div className="mockup-avatar green">TG</div>
                                            <div>
                                                <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>Tarun Gupta</div>
                                                <div style={{ fontSize: '0.72rem', color: '#00a884' }}>● Active Video Call</div>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: 6 }}>
                                            <span className="mockup-pill-btn">📞 Voice</span>
                                            <span className="mockup-pill-btn active">📹 Video</span>
                                        </div>
                                    </div>

                                    <div className="mockup-stage-content">
                                        <div className="mockup-msg other">
                                            <div>Private chat and WebRTC video calling are working directly between mobile and laptop! 🚀</div>
                                            <span className="mockup-time">12:30 PM</span>
                                        </div>
                                        <div className="mockup-msg self">
                                            <div>Awesome, let's also test voice notes and view-once photos.</div>
                                            <span className="mockup-time">12:31 PM ✓✓</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </main>

            {/* Compact Bottom Footer */}
            <footer className="landing-footer-compact">
                <span>© 2026 PulseChat • Realtime WebRTC Communication • End-to-End Style Encryption</span>
                <span className="footer-status-pill">All Systems Operational</span>
            </footer>
        </div>
    );
}
