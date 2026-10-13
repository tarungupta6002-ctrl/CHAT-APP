import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function LandingPage() {
    const { isAuthenticated, setCurrentView } = useAuth();

    return (
        <div className="landing-page-container">
            {/* Top Navigation */}
            <header className="landing-nav">
                <div className="landing-nav-brand">
                    <div className="landing-brand-logo">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                        </svg>
                    </div>
                    <span className="landing-brand-name">PulseChat</span>
                </div>

                <nav className="landing-nav-links">
                    <a href="#features">Features</a>
                    <a href="#calls">Calls</a>
                    <a href="#security">Privacy</a>
                </nav>

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

            {/* Hero Section */}
            <section className="landing-hero">
                <div className="hero-badge">
                    <span className="hero-badge-dot"></span>
                    <span>Next-Gen WebRTC & Realtime Messaging</span>
                </div>
                <h1 className="hero-title">
                    Simple. Fast. <span className="gradient-text">Private Messaging.</span>
                </h1>
                <p className="hero-subtitle">
                    Connect seamlessly across laptop and mobile with crystal clear 1-on-1 audio & video calls,
                    WhatsApp-style private chats, voice notes, and view-once media.
                </p>

                <div className="hero-cta-group">
                    <button
                        type="button"
                        className="landing-btn-primary large"
                        onClick={() => setCurrentView(isAuthenticated ? 'chat' : 'auth')}
                    >
                        <span>{isAuthenticated ? 'Open PulseChat Web' : 'Start Chatting Now'}</span>
                        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: 20, height: 20 }}>
                            <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 110-2h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                        </svg>
                    </button>
                    <a href="#features" className="landing-btn-secondary large">
                        Explore Features
                    </a>
                </div>

                {/* Hero Interactive App Mockup Preview */}
                <div className="hero-mockup-wrapper">
                    <div className="hero-mockup-window">
                        <div className="mockup-header">
                            <div className="mockup-dots">
                                <span className="dot red"></span>
                                <span className="dot yellow"></span>
                                <span className="dot green"></span>
                            </div>
                            <div className="mockup-title">pulsechat-web.app</div>
                        </div>
                        <div className="mockup-body">
                            <div className="mockup-sidebar">
                                <div className="mockup-chat active">
                                    <div className="mockup-avatar green">TG</div>
                                    <div className="mockup-chat-info">
                                        <div className="mockup-chat-top">
                                            <strong>Tarun Gupta</strong>
                                            <span>Just now</span>
                                        </div>
                                        <div className="mockup-chat-preview">📹 Video call connected</div>
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
                                        <div className="mockup-chat-preview">Welcome to the chat!</div>
                                    </div>
                                </div>
                            </div>
                            <div className="mockup-stage">
                                <div className="mockup-stage-header">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                        <div className="mockup-avatar green">TG</div>
                                        <div>
                                            <div style={{ fontWeight: 600 }}>Tarun Gupta</div>
                                            <div style={{ fontSize: '0.75rem', color: '#00a884' }}>Online • In Video Call</div>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: 8 }}>
                                        <span className="mockup-pill-btn">📞 Audio</span>
                                        <span className="mockup-pill-btn active">📹 Video</span>
                                    </div>
                                </div>
                                <div className="mockup-stage-content">
                                    <div className="mockup-msg other">
                                        <div>Hey! Video calling between laptop and phone is working smoothly now! 🚀</div>
                                        <span className="mockup-time">12:30 PM</span>
                                    </div>
                                    <div className="mockup-msg self">
                                        <div>Yes, audio and video quality is crisp! Let's share some voice notes too.</div>
                                        <span className="mockup-time">12:31 PM ✓✓</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Section */}
            <section id="features" className="landing-features">
                <div className="section-header">
                    <h2>Everything you love about WhatsApp, on the web.</h2>
                    <p>Engineered for speed, privacy, and seamless cross-device communication.</p>
                </div>

                <div className="features-grid">
                    <div className="feature-card">
                        <div className="feature-icon-wrap green">📹</div>
                        <h3>HD Audio & Video Calls</h3>
                        <p>Direct peer-to-peer WebRTC video calling with robust STUN/TURN relay to bypass firewalls and mobile carrier NAT.</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrap blue">💬</div>
                        <h3>WhatsApp-Style Layout</h3>
                        <p>Dedicated individual chats, contact search, message read receipts, and seamless switching between private DMs.</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrap purple">🔒</div>
                        <h3>Secure Authentication</h3>
                        <p>Private user accounts with scrypt password hashing, persistent chat history, and authorization protection.</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrap orange">①</div>
                        <h3>View-Once Photos</h3>
                        <p>Share photos that vanish permanently after being viewed once, giving you total peace of mind.</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrap red">🎙️</div>
                        <h3>Studio Voice Notes</h3>
                        <p>Record and send voice notes with real-time waveform animation and interactive seek bar playback.</p>
                    </div>

                    <div className="feature-card">
                        <div className="feature-icon-wrap teal">📱</div>
                        <h3>Mobile Friendly Design</h3>
                        <p>Crafted specifically for mobile phones and laptops with responsive touch gestures and native app-like UX.</p>
                    </div>
                </div>
            </section>

            {/* Call To Action Footer */}
            <footer className="landing-footer">
                <div className="footer-content">
                    <div className="footer-brand">
                        <div className="landing-brand-logo">
                            <svg viewBox="0 0 24 24" fill="currentColor">
                                <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                            </svg>
                        </div>
                        <h3>PulseChat</h3>
                    </div>
                    <p>© 2026 PulseChat. Realtime messaging & WebRTC communication.</p>
                    <button
                        type="button"
                        className="landing-btn-primary"
                        onClick={() => setCurrentView(isAuthenticated ? 'chat' : 'auth')}
                    >
                        Launch Web App
                    </button>
                </div>
            </footer>
        </div>
    );
}
