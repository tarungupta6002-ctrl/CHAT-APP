import React from 'react';
import { useAuth } from '../context/AuthContext';

export default function ChatHubNavbar({ activePage = 'auth' }) {
    const { currentView, navigateTo } = useAuth();

    const isSignup = currentView === 'signup';

    return (
        <header className="chathub-global-nav">
            <div className="nav-container">
                {/* Brand Logo */}
                <div 
                    className="brand-logo-wrap" 
                    onClick={() => navigateTo('landing')}
                    role="button"
                    tabIndex={0}
                    title="ChatHub Home"
                >
                    <div className="chathub-icon" style={{ overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        <img 
                            src="/chathub-logo.png" 
                            alt="ChatHub Logo" 
                            style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'contain' }} 
                        />
                    </div>
                    <span className="brand-name">ChatHub</span>
                </div>

                {/* Right Action Links */}
                <div className="nav-actions">
                    {activePage === 'landing' ? (
                        <>
                            <button
                                type="button"
                                className="nav-link-btn"
                                onClick={() => navigateTo('login')}
                            >
                                Log in
                            </button>
                            <button
                                type="button"
                                className="nav-cta-btn"
                                onClick={() => navigateTo('signup')}
                            >
                                Get Started — It's Free
                            </button>
                        </>
                    ) : (
                        <div className="auth-switch-text">
                            {isSignup ? (
                                <>
                                    <span>Already have an account?</span>
                                    <button
                                        type="button"
                                        className="auth-switch-btn"
                                        onClick={() => navigateTo('login')}
                                    >
                                        Log in
                                    </button>
                                </>
                            ) : (
                                <>
                                    <span>Don't have an account?</span>
                                    <button
                                        type="button"
                                        className="auth-switch-btn"
                                        onClick={() => navigateTo('signup')}
                                    >
                                        Sign up
                                    </button>
                                </>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </header>
    );
}
