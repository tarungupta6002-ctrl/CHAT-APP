import React from 'react';
import { useAuth } from '../context/AuthContext';
import ChatHubNavbar from './ChatHubNavbar';

export default function LandingPage() {
    const { isAuthenticated, navigateTo } = useAuth();

    return (
        <div className="chathub-landing-page">
            {/* Top Navigation */}
            <ChatHubNavbar activePage="landing" />

            {/* Hero Section */}
            <section className="chathub-landing-hero">
                <div className="landing-container">
                    <div className="landing-hero-grid">
                        {/* Left Hero Content */}
                        <div className="hero-text-block">
                            <div className="hero-eyebrow-badge">
                                <span className="eyebrow-dot"></span>
                                <span>Real-time Messaging • HD Video Calls • VideoSDK Powered</span>
                            </div>

                            <h1 className="landing-hero-title">
                                Chat. Call. <br />
                                Share. <span className="emerald-gradient-text">Together.</span>
                            </h1>

                            <p className="landing-hero-subtitle">
                                Experience fast, secure and seamless communication with ChatHub.
                                Connect with your friends, family and teams through crystal-clear voice & video calls,
                                instant messaging, and multimedia sharing.
                            </p>

                            <div className="landing-cta-row">
                                <button
                                    type="button"
                                    className="chathub-btn-primary"
                                    onClick={() => navigateTo(isAuthenticated ? 'chat' : 'signup')}
                                >
                                    <span>{isAuthenticated ? 'Open ChatHub Web' : "Get Started — It's Free"}</span>
                                    <span className="btn-arrow-icon">→</span>
                                </button>

                                {!isAuthenticated && (
                                    <button
                                        type="button"
                                        className="chathub-btn-secondary"
                                        onClick={() => navigateTo('login')}
                                    >
                                        Log In
                                    </button>
                                )}
                            </div>

                            {/* Trust badges */}
                            <div className="hero-trust-metrics">
                                <div className="trust-item">
                                    <strong>100% Free</strong>
                                    <span>Unlimited 1-on-1 Calls</span>
                                </div>
                                <div className="trust-divider"></div>
                                <div className="trust-item">
                                    <strong>End-to-End</strong>
                                    <span>Encrypted Communication</span>
                                </div>
                                <div className="trust-divider"></div>
                                <div className="trust-item">
                                    <strong>Zero App Install</strong>
                                    <span>Works in any Browser</span>
                                </div>
                            </div>
                        </div>

                        {/* Right Product Mockup */}
                        <div className="hero-visual-block">
                            <div className="app-mockup-wrapper">
                                <div className="mockup-window-header">
                                    <div className="window-dots">
                                        <span className="dot red"></span>
                                        <span className="dot yellow"></span>
                                        <span className="dot green"></span>
                                    </div>
                                    <div className="window-title-badge">💬 ChatHub Web App</div>
                                    <div className="window-action-status">● Live</div>
                                </div>

                                <div className="mockup-window-body">
                                    {/* Sidebar preview */}
                                    <div className="mockup-sidebar-preview">
                                        <div className="mock-search-box">
                                            <span>🔍 Search chats...</span>
                                        </div>
                                        <div className="mock-contact active">
                                            <div className="mock-contact-avatar" style={{ backgroundColor: '#10b981' }}>PS</div>
                                            <div className="mock-contact-info">
                                                <h5>Priya Sharma</h5>
                                                <p>Are you free for a call?</p>
                                            </div>
                                            <span className="mock-unread-badge">2</span>
                                        </div>
                                        <div className="mock-contact">
                                            <div className="mock-contact-avatar" style={{ backgroundColor: '#6366f1' }}>RV</div>
                                            <div className="mock-contact-info">
                                                <h5>Rahul Verma</h5>
                                                <p>Let's catch up later</p>
                                            </div>
                                        </div>
                                        <div className="mock-contact">
                                            <div className="mock-contact-avatar" style={{ backgroundColor: '#f59e0b' }}>👥</div>
                                            <div className="mock-contact-info">
                                                <h5>Project Team</h5>
                                                <p>Updated the designs</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Chat stage preview */}
                                    <div className="mockup-chat-stage">
                                        <div className="mockup-chat-header">
                                            <div className="mockup-peer-chip">
                                                <div className="mock-contact-avatar small" style={{ backgroundColor: '#10b981' }}>PS</div>
                                                <div>
                                                    <strong>Priya Sharma</strong>
                                                    <span>● Online</span>
                                                </div>
                                            </div>
                                            <div className="mockup-call-buttons">
                                                <span className="mock-icon-pill">📞</span>
                                                <span className="mock-icon-pill video">📹 Video</span>
                                            </div>
                                        </div>

                                        <div className="mockup-messages-feed">
                                            <div className="mock-msg other">Hi Tarun! 👋</div>
                                            <div className="mock-msg other">How are you doing today?</div>
                                            <div className="mock-msg self">Hey Priya! Doing great. Just finishing up the project.</div>
                                            <div className="mock-msg other">Awesome! Are you free for a video call to review?</div>
                                        </div>

                                        <div className="mockup-input-bar">
                                            <span>Type a message...</span>
                                            <span className="mock-send-btn">➤</span>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Feature Cards Grid */}
            <section className="chathub-features-section">
                <div className="landing-container">
                    <div className="section-header-center">
                        <span className="section-tag">Features</span>
                        <h2>Everything you need to communicate effortlessly</h2>
                        <p>Modern features built for real-time collaboration on any device.</p>
                    </div>

                    <div className="features-cards-grid">
                        <div className="feature-card">
                            <div className="feature-card-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>💬</div>
                            <h3>Real-time Messaging</h3>
                            <p>Instant text delivery with typing indicators, delivery status, and view-once media privacy.</p>
                        </div>

                        <div className="feature-card">
                            <div className="feature-card-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>📹</div>
                            <h3>HD Video & Voice Calls</h3>
                            <p>Crystal-clear 1-on-1 audio and video calls powered by VideoSDK cloud infrastructure across 4G/5G and Wi-Fi.</p>
                        </div>

                        <div className="feature-card">
                            <div className="feature-card-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>👥</div>
                            <h3>Group & Community Chats</h3>
                            <p>Collaborate with friends, project teams and interest groups in persistent group discussion rooms.</p>
                        </div>

                        <div className="feature-card">
                            <div className="feature-card-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>🔒</div>
                            <h3>Secure & Private</h3>
                            <p>Cryptographically hashed authentication, password protection, and automated session management.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Bottom Call to Action Section */}
            <section className="chathub-bottom-cta">
                <div className="landing-container">
                    <div className="cta-banner-card">
                        <h2>Ready to experience seamless communication?</h2>
                        <p>Join ChatHub today. No apps to download — open in your browser and connect instantly.</p>
                        <button
                            type="button"
                            className="chathub-btn-primary"
                            onClick={() => navigateTo(isAuthenticated ? 'chat' : 'signup')}
                        >
                            <span>{isAuthenticated ? 'Go to My Chats' : 'Create Your Free Account'}</span>
                            <span className="btn-arrow-icon">→</span>
                        </button>
                    </div>
                </div>
            </section>

            {/* Responsive Footer */}
            <footer className="chathub-landing-footer">
                <div className="landing-container footer-content-row">
                    <div className="footer-brand">
                        <span className="brand-icon">💬</span>
                        <span className="brand-text">ChatHub</span>
                        <p>© {new Date().getFullYear()} ChatHub. Chat. Call. Share. Together.</p>
                    </div>
                    <div className="footer-links">
                        <button type="button" onClick={() => navigateTo('login')}>Log In</button>
                        <button type="button" onClick={() => navigateTo('signup')}>Sign Up</button>
                        <button type="button" onClick={() => navigateTo('forgot-password')}>Password Recovery</button>
                    </div>
                </div>
            </footer>
        </div>
    );
}
