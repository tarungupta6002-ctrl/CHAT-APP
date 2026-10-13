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
                    <div className="chathub-icon">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M12 2C6.477 2 2 6.145 2 11.259c0 2.92 1.472 5.534 3.785 7.214L4.85 22.1a.75.75 0 0 0 1.05.86l4.285-1.897c.587.13 1.194.196 1.815.196 5.523 0 10-4.145 10-9.259S17.523 2 12 2zm-3.5 10.25a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm3.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5zm3.5 0a1.25 1.25 0 1 1 0-2.5 1.25 1.25 0 0 1 0 2.5z" />
                        </svg>
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
