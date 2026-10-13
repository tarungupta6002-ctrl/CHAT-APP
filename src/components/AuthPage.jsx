import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';

export default function AuthPage() {
    const { login, register, setCurrentView } = useAuth();
    const [isRegisterMode, setIsRegisterMode] = useState(false);
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            if (isRegisterMode) {
                await register(username, password);
            } else {
                await login(username, password);
            }
        } catch (err) {
            setError(err.message || 'Authentication failed');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="auth-page-container">
            <button
                type="button"
                className="auth-back-btn"
                onClick={() => setCurrentView('landing')}
            >
                ← Back to Home
            </button>

            <div className="auth-card">
                <div className="auth-header">
                    <div className="auth-brand-logo">
                        <svg viewBox="0 0 24 24" fill="currentColor">
                            <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H5.17L4 17.17V4h16v12z" />
                        </svg>
                    </div>
                    <h2>PulseChat Web</h2>
                    <p>
                        {isRegisterMode
                            ? 'Create an account to start chatting with your contacts.'
                            : 'Sign in to access your chats, voice notes, and calls.'}
                    </p>
                </div>

                <div className="auth-tabs">
                    <button
                        type="button"
                        className={`auth-tab ${!isRegisterMode ? 'active' : ''}`}
                        onClick={() => {
                            setIsRegisterMode(false);
                            setError('');
                        }}
                    >
                        Sign In
                    </button>
                    <button
                        type="button"
                        className={`auth-tab ${isRegisterMode ? 'active' : ''}`}
                        onClick={() => {
                            setIsRegisterMode(true);
                            setError('');
                        }}
                    >
                        Create Account
                    </button>
                </div>

                {error && (
                    <div className="auth-error-alert">
                        ⚠️ {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="auth-form">
                    <div className="form-group">
                        <label htmlFor="auth-username">Username</label>
                        <input
                            type="text"
                            id="auth-username"
                            className="styled-input"
                            placeholder="e.g. tarungupta, alex, sarah"
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            maxLength={20}
                            required
                            autoComplete="username"
                            autoFocus
                        />
                    </div>

                    <div className="form-group">
                        <label htmlFor="auth-password">Password</label>
                        <input
                            type="password"
                            id="auth-password"
                            className="styled-input"
                            placeholder="••••••••"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            minLength={4}
                            required
                            autoComplete={isRegisterMode ? "new-password" : "current-password"}
                        />
                    </div>

                    <button
                        type="submit"
                        className="btn-primary auth-submit-btn"
                        disabled={loading}
                    >
                        {loading
                            ? 'Please wait...'
                            : (isRegisterMode ? 'Create Account & Enter' : 'Sign In to PulseChat')}
                    </button>
                </form>

                <div className="auth-footer-hint">
                    {isRegisterMode ? (
                        <span>
                            Already have an account?{' '}
                            <button
                                type="button"
                                className="auth-link-btn"
                                onClick={() => {
                                    setIsRegisterMode(false);
                                    setError('');
                                }}
                            >
                                Sign in here
                            </button>
                        </span>
                    ) : (
                        <span>
                            New to PulseChat?{' '}
                            <button
                                type="button"
                                className="auth-link-btn"
                                onClick={() => {
                                    setIsRegisterMode(true);
                                    setError('');
                                }}
                            >
                                Create an account
                            </button>
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}
