import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import ChatHubNavbar from './ChatHubNavbar';

export default function LandingPage() {
    const { isAuthenticated, navigateTo } = useAuth();
    const [activeTab, setActiveTab] = useState('messaging');

    return (
        <div className="chathub-landing-page">
            {/* Ambient Background Gradient Orbs */}
            <div className="ambient-glow-orb orb-1"></div>
            <div className="ambient-glow-orb orb-2"></div>
            <div className="ambient-glow-orb orb-3"></div>

            {/* Top Navigation */}
            <ChatHubNavbar activePage="landing" />

            {/* 1. HERO SECTION */}
            <section className="chathub-landing-hero">
                <div className="landing-container">
                    <div className="landing-hero-grid">
                        {/* Left Hero Content */}
                        <div className="hero-text-block">
                            <div className="hero-eyebrow-badge animate-fade-in">
                                <span className="eyebrow-dot"></span>
                                <span>Real-time Messaging • HD Video Calls • VideoSDK Cloud</span>
                            </div>

                            <h1 className="landing-hero-title animate-slide-up">
                                Chat. Call. <br />
                                Share. <span className="emerald-gradient-text">Together.</span>
                            </h1>

                            <p className="landing-hero-subtitle animate-slide-up-delay-1">
                                Experience ultra-fast, secure, and seamless communication with ChatHub.
                                Connect with your friends, family and teams across the world with crystal-clear
                                voice & video calls, view-once photos, voice notes, and real-time private messaging.
                            </p>

                            <div className="landing-cta-row animate-slide-up-delay-2">
                                <button
                                    type="button"
                                    className="chathub-btn-primary glow-btn"
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
                            <div className="hero-trust-metrics animate-slide-up-delay-3">
                                <div className="trust-item">
                                    <div className="trust-icon-pill">⚡</div>
                                    <div>
                                        <strong>100% Free</strong>
                                        <span>Unlimited Calls</span>
                                    </div>
                                </div>
                                <div className="trust-divider"></div>
                                <div className="trust-item">
                                    <div className="trust-icon-pill">🔒</div>
                                    <div>
                                        <strong>End-to-End</strong>
                                        <span>Secure Sessions</span>
                                    </div>
                                </div>
                                <div className="trust-divider"></div>
                                <div className="trust-item">
                                    <div className="trust-icon-pill">🌐</div>
                                    <div>
                                        <strong>Zero Installs</strong>
                                        <span>Works in Browser</span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Right Product Mockup with 3D Floating Animation */}
                        <div className="hero-visual-block animate-float">
                            {/* Floating Feature Badges around Mockup */}
                            <div className="floating-preview-badge badge-top-left">
                                <span className="badge-icon">📹</span>
                                <div>
                                    <strong>HD Video Calls</strong>
                                    <small>Ultra-low 60ms latency</small>
                                </div>
                            </div>

                            <div className="floating-preview-badge badge-bottom-right">
                                <span className="badge-icon">🎙️</span>
                                <div>
                                    <strong>Voice Messages</strong>
                                    <small>Crystal clear audio</small>
                                </div>
                            </div>

                            <div className="app-mockup-wrapper">
                                <div className="mockup-window-header">
                                    <div className="window-dots">
                                        <span className="dot red"></span>
                                        <span className="dot yellow"></span>
                                        <span className="dot green"></span>
                                    </div>
                                    <div className="window-title-badge">💬 ChatHub Web App</div>
                                    <div className="window-action-status">
                                        <span className="pulse-green-dot"></span> Live
                                    </div>
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
                                                    <span className="peer-online-tag">● Online</span>
                                                </div>
                                            </div>
                                            <div className="mockup-call-buttons">
                                                <span className="mock-icon-pill">📞</span>
                                                <span className="mock-icon-pill video animate-pulse-glow">📹 Video</span>
                                            </div>
                                        </div>

                                        <div className="mockup-messages-feed">
                                            <div className="mock-msg other anim-bubble-1">Hi Tarun! 👋</div>
                                            <div className="mock-msg other anim-bubble-2">How are you doing today?</div>
                                            <div className="mock-msg self anim-bubble-3">Hey Priya! Doing great. Just finishing up the project.</div>
                                            <div className="mock-msg other anim-bubble-4">Awesome! Are you free for a quick video call to review?</div>
                                            <div className="mock-typing-indicator">
                                                <span>Priya is typing</span>
                                                <span className="typing-dots">...</span>
                                            </div>
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

            {/* 2. STATS & HIGHLIGHTS BANNER */}
            <section className="chathub-stats-section">
                <div className="landing-container">
                    <div className="stats-row">
                        <div className="stat-card">
                            <h3 className="stat-number">100%</h3>
                            <p className="stat-label">Browser Based — No App Download</p>
                        </div>
                        <div className="stat-card">
                            <h3 className="stat-number">&lt;60ms</h3>
                            <p className="stat-label">Real-time WebSocket Latency</p>
                        </div>
                        <div className="stat-card">
                            <h3 className="stat-number">HD 1080p</h3>
                            <p className="stat-label">VideoSDK Crystal Clear Video</p>
                        </div>
                        <div className="stat-card">
                            <h3 className="stat-number">256-bit</h3>
                            <p className="stat-label">Cryptographic Security</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 3. FEATURE CARDS GRID */}
            <section className="chathub-features-section" id="features">
                <div className="landing-container">
                    <div className="section-header-center">
                        <span className="section-tag">Core Features</span>
                        <h2>Everything you need to communicate effortlessly</h2>
                        <p>Built with modern web standards for fast, private, and delightful conversations on mobile and desktop.</p>
                    </div>

                    <div className="features-cards-grid">
                        <div className="feature-card hover-glow">
                            <div className="feature-card-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>💬</div>
                            <h3>Real-time Messaging</h3>
                            <p>Instant text delivery with typing indicators, delivery checkmarks, and disappearing view-once media privacy.</p>
                            <span className="feature-learn-more">Instant delivery →</span>
                        </div>

                        <div className="feature-card hover-glow">
                            <div className="feature-card-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>📹</div>
                            <h3>HD Video & Voice Calls</h3>
                            <p>Crystal-clear 1-on-1 audio and video calls powered by VideoSDK infrastructure across 4G/5G and Wi-Fi networks.</p>
                            <span className="feature-learn-more">High definition →</span>
                        </div>

                        <div className="feature-card hover-glow">
                            <div className="feature-card-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>👥</div>
                            <h3>Group & Community Chats</h3>
                            <p>Collaborate with friends, project teammates, and interest groups in persistent group discussion rooms.</p>
                            <span className="feature-learn-more">Unlimited channels →</span>
                        </div>

                        <div className="feature-card hover-glow">
                            <div className="feature-card-icon" style={{ backgroundColor: '#ecfdf5', color: '#10b981' }}>🔒</div>
                            <h3>Secure & Private</h3>
                            <p>Cryptographically hashed 6-digit OTP verification, bcrypt protection, and automatic session tokens.</p>
                            <span className="feature-learn-more">Bank-grade security →</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* 4. INTERACTIVE PRODUCT SHOWCASE SECTION */}
            <section className="chathub-showcase-section">
                <div className="landing-container">
                    <div className="showcase-content-grid">
                        <div className="showcase-info-block">
                            <span className="section-tag">Designed for Speed</span>
                            <h2>Switch between messaging and video calls with a single tap.</h2>
                            <p>
                                No need to switch between different applications for calling and chatting. ChatHub brings
                                text, voice notes, photos, audio calls, and video calls into one harmonious interface.
                            </p>

                            <div className="showcase-feature-bullets">
                                <div className="showcase-bullet-item">
                                    <div className="bullet-check-icon">✓</div>
                                    <div>
                                        <strong>One-Click Call Trigger</strong>
                                        <p>Start a voice or video call directly from your chat window with zero setup.</p>
                                    </div>
                                </div>

                                <div className="showcase-bullet-item">
                                    <div className="bullet-check-icon">✓</div>
                                    <div>
                                        <strong>View-Once Privacy Media</strong>
                                        <p>Send sensitive images and documents that automatically lock once viewed.</p>
                                    </div>
                                </div>

                                <div className="showcase-bullet-item">
                                    <div className="bullet-check-icon">✓</div>
                                    <div>
                                        <strong>Cross-Device Responsive Web</strong>
                                        <p>Smooth, native-feeling performance on Chrome, Safari, Android, iPhone, and PC.</p>
                                    </div>
                                </div>
                            </div>

                            <button
                                type="button"
                                className="chathub-btn-primary"
                                onClick={() => navigateTo('signup')}
                            >
                                <span>Try ChatHub Now</span>
                                <span className="btn-arrow-icon">→</span>
                            </button>
                        </div>

                        <div className="showcase-image-block">
                            <div className="showcase-card-visual">
                                <div className="visual-top-bar">
                                    <span>📹 Active Video Call Experience</span>
                                    <span className="live-badge">HD 1080P</span>
                                </div>
                                <div className="video-call-art-frame">
                                    <div className="art-remote-feed">
                                        <div className="art-feed-overlay">
                                            <span className="caller-name">Priya Sharma</span>
                                            <span className="call-time">04:12</span>
                                        </div>
                                    </div>
                                    <div className="art-local-feed">
                                        <span>You</span>
                                    </div>
                                </div>
                                <div className="call-control-bar-mock">
                                    <button type="button" className="mock-call-btn">🎙️</button>
                                    <button type="button" className="mock-call-btn">📹</button>
                                    <button type="button" className="mock-call-btn end">📞</button>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* 5. HOW IT WORKS SECTION */}
            <section className="chathub-steps-section">
                <div className="landing-container">
                    <div className="section-header-center">
                        <span className="section-tag">Easy Setup</span>
                        <h2>Get started in 3 simple steps</h2>
                        <p>No complicated downloads, no phone storage consumed.</p>
                    </div>

                    <div className="steps-cards-row">
                        <div className="step-card">
                            <div className="step-number-badge">01</div>
                            <h4>Sign Up & Verify</h4>
                            <p>Register with your email and verify your account in seconds with a secure 6-digit OTP.</p>
                        </div>
                        <div className="step-arrow-divider">➔</div>
                        <div className="step-card">
                            <div className="step-number-badge">02</div>
                            <h4>Choose Contacts</h4>
                            <p>Find friends by username or create a group room to invite your whole community.</p>
                        </div>
                        <div className="step-arrow-divider">➔</div>
                        <div className="step-card">
                            <div className="step-number-badge">03</div>
                            <h4>Chat & Call</h4>
                            <p>Send messages, share view-once photos, and jump into HD voice & video calls instantly.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* 6. BOTTOM CALL TO ACTION BANNER */}
            <section className="chathub-bottom-cta">
                <div className="landing-container">
                    <div className="cta-banner-card glow-banner">
                        <span className="cta-pill-tag">✨ Start for Free</span>
                        <h2>Ready to experience seamless communication?</h2>
                        <p>Join ChatHub today. No apps to install — simply open in any web browser and connect instantly.</p>
                        <div className="cta-action-wrap">
                            <button
                                type="button"
                                className="chathub-btn-primary white-btn"
                                onClick={() => navigateTo(isAuthenticated ? 'chat' : 'signup')}
                            >
                                <span>{isAuthenticated ? 'Go to My Chats' : 'Create Your Free Account'}</span>
                                <span className="btn-arrow-icon">→</span>
                            </button>
                        </div>
                    </div>
                </div>
            </section>

            {/* 7. RESPONSIVE FOOTER */}
            <footer className="chathub-landing-footer">
                <div className="landing-container footer-content-row">
                    <div className="footer-brand">
                        <div className="footer-logo-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <img src="/chathub-logo.png" alt="ChatHub" style={{ width: 26, height: 26, borderRadius: 6, objectFit: 'contain' }} />
                            <span className="brand-text">ChatHub</span>
                        </div>
                        <p>© {new Date().getFullYear()} ChatHub. Real-time messaging, voice & video calls.</p>
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
