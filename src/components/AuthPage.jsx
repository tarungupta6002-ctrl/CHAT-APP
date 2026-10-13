import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../context/AuthContext';
import ChatHubNavbar from './ChatHubNavbar';

export default function AuthPage() {
    const {
        currentView,
        navigateTo,
        login,
        sendSignupOtp,
        verifySignupOtp,
        resendOtp,
        forgotPassword,
        verifyResetOtp,
        resetPassword,
        googleLogin,
        pendingEmail
    } = useAuth();

    // Form inputs
    const [fullName, setFullName] = useState('');
    const [email, setEmail] = useState('');
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(true);
    const [showPassword, setShowPassword] = useState(false);

    // OTP 6-digits state
    const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
    const otpInputRefs = useRef([]);

    // Timer & cooldown states
    const [timerSeconds, setTimerSeconds] = useState(300); // 5 minutes
    const [resendCooldown, setResendCooldown] = useState(30);

    // Feedback states
    const [error, setError] = useState('');
    const [successMsg, setSuccessMsg] = useState('');
    const [loading, setLoading] = useState(false);

    // Initialize OTP timer
    useEffect(() => {
        if (currentView === 'verify-otp') {
            setTimerSeconds(300);
            setResendCooldown(30);
            const interval = setInterval(() => {
                setTimerSeconds((prev) => (prev > 0 ? prev - 1 : 0));
                setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
            }, 1000);
            return () => clearInterval(interval);
        }
    }, [currentView]);

    // Focus first OTP input on mount
    useEffect(() => {
        if (currentView === 'verify-otp') {
            otpInputRefs.current[0]?.focus();
        }
    }, [currentView]);

    // Handle OTP single box input & backspace auto-navigation
    const handleOtpChange = (index, value) => {
        const clean = value.replace(/[^0-9]/g, '');
        const newDigits = [...otpDigits];
        newDigits[index] = clean.slice(-1);
        setOtpDigits(newDigits);

        if (clean && index < 5) {
            otpInputRefs.current[index + 1]?.focus();
        }
    };

    const handleOtpKeyDown = (index, e) => {
        if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
            otpInputRefs.current[index - 1]?.focus();
        }
    };

    const handleOtpPaste = (e) => {
        e.preventDefault();
        const pasted = e.clipboardData.getData('text').replace(/[^0-9]/g, '').slice(0, 6);
        if (pasted.length > 0) {
            const newDigits = [...otpDigits];
            for (let i = 0; i < 6; i++) {
                newDigits[i] = pasted[i] || '';
            }
            setOtpDigits(newDigits);
            const focusIndex = Math.min(pasted.length, 5);
            otpInputRefs.current[focusIndex]?.focus();
        }
    };

    // --- Submissions ---

    // 1. Sign Up Submit -> Request OTP
    const handleSignupSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!fullName.trim()) return setError('Please enter your full name.');
        if (!email.trim() || !email.includes('@')) return setError('Please enter a valid email address.');
        if (!username.trim() || username.length < 3) return setError('Username must be at least 3 characters.');
        if (!password || password.length < 6) return setError('Password must be at least 6 characters.');

        setLoading(true);
        try {
            await sendSignupOtp({ fullName, email, username, password });
            setSuccessMsg('Verification code sent to your email.');
        } catch (err) {
            setError(err.message || 'Signup failed');
        } finally {
            setLoading(false);
        }
    };

    // 2. Log In Submit
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const identifier = (email || username || '').trim();
        if (!identifier) return setError('Please enter your email or username.');
        if (!password) return setError('Please enter your password.');

        setLoading(true);
        try {
            await login(identifier, password);
        } catch (err) {
            setError(err.message || 'Login failed');
        } finally {
            setLoading(false);
        }
    };

    // 3. Verify OTP Submit (For Registration or Password Reset)
    const handleVerifyOtpSubmit = async (e) => {
        e.preventDefault();
        setError('');
        const fullOtp = otpDigits.join('');
        if (fullOtp.length !== 6) return setError('Please enter all 6 digits of the verification code.');

        setLoading(true);
        try {
            const targetEmail = pendingEmail || email;
            if (currentView === 'verify-otp' && targetEmail) {
                // If it came from forgot password
                if (window.location.pathname.includes('forgot') || error.includes('reset')) {
                    await verifyResetOtp({ email: targetEmail, otp: fullOtp });
                } else {
                    await verifySignupOtp({ email: targetEmail, otp: fullOtp });
                }
            }
        } catch (err) {
            setError(err.message || 'Verification failed');
        } finally {
            setLoading(false);
        }
    };

    // 4. Resend OTP
    const handleResendOtp = async () => {
        if (resendCooldown > 0) return;
        setError('');
        setSuccessMsg('');
        try {
            const targetEmail = pendingEmail || email;
            await resendOtp({ email: targetEmail });
            setSuccessMsg('New 6-digit code sent!');
            setTimerSeconds(300);
            setResendCooldown(30);
            setOtpDigits(['', '', '', '', '', '']);
            otpInputRefs.current[0]?.focus();
        } catch (err) {
            setError(err.message || 'Failed to resend code');
        }
    };

    // 5. Forgot Password Submit
    const handleForgotPasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!email.trim() || !email.includes('@')) return setError('Please enter your registered email.');

        setLoading(true);
        try {
            await forgotPassword({ email: email.trim() });
            setSuccessMsg('If an account exists, a recovery code has been sent.');
        } catch (err) {
            setError(err.message || 'Recovery request failed');
        } finally {
            setLoading(false);
        }
    };

    // 6. Reset Password Submit
    const handleResetPasswordSubmit = async (e) => {
        e.preventDefault();
        setError('');
        if (!password || password.length < 6) return setError('New password must be at least 6 characters.');
        if (password !== confirmPassword) return setError('Passwords do not match.');

        setLoading(true);
        try {
            await resetPassword({ email: pendingEmail || email, newPassword: password });
            alert('Password reset successful! You can now log in.');
        } catch (err) {
            setError(err.message || 'Password reset failed');
        } finally {
            setLoading(false);
        }
    };

    // 7. Google OAuth Sign-In
    const handleGoogleAuth = () => {
        if (window.google?.accounts?.id) {
            window.google.accounts.id.prompt();
        } else {
            // Friendly helpful prompt for development / missing Google client id
            const testEmail = prompt("Google Sign-In: Enter Google account email for simulation (or configure GOOGLE_CLIENT_ID in .env for production OAuth):", "user@gmail.com");
            if (testEmail) {
                login(testEmail, "google-auth-pass").catch(() => {
                    // Create simulated account if not exists
                    sendSignupOtp({ fullName: "Google User", email: testEmail, username: testEmail.split('@')[0], password: "google-auth-pass" })
                        .catch(err => alert("Sign in error: " + err.message));
                });
            }
        }
    };

    // Format remaining time MM:SS
    const formatTime = (secs) => {
        const m = Math.floor(secs / 60);
        const s = secs % 60;
        return `${m < 10 ? '0' : ''}${m}:${s < 10 ? '0' : ''}${s}`;
    };

    // Render Sub-Views
    const isSignupView = currentView === 'signup';
    const isLoginView = currentView === 'login';
    const isOtpView = currentView === 'verify-otp';
    const isForgotView = currentView === 'forgot-password';
    const isResetView = currentView === 'reset-password';

    return (
        <div className="chathub-auth-page-root">
            {/* Top Navigation */}
            <ChatHubNavbar activePage="auth" />

            <main className="auth-main-layout">
                {/* =========================================
                    CASE 1 & 2: SIGN UP & LOGIN (SPLIT SCREEN)
                    ========================================= */}
                {(isSignupView || isLoginView) && (
                    <div className="auth-split-grid">
                        {/* LEFT COLUMN: INTERACTIVE FORM CARD */}
                        <div className="auth-form-column">
                            <div className="auth-form-card">
                                <div className="form-title-group">
                                    <h1 className="form-main-heading">
                                        {isSignupView ? 'Create an account' : 'Welcome back'}
                                    </h1>
                                    <p className="form-sub-heading">
                                        {isSignupView
                                            ? 'Join ChatHub and stay connected with your friends, family and teams.'
                                            : 'Log in to your ChatHub account and continue your conversations.'}
                                    </p>
                                </div>

                                {error && <div className="auth-alert-box error">{error}</div>}
                                {successMsg && <div className="auth-alert-box success">{successMsg}</div>}

                                <form onSubmit={isSignupView ? handleSignupSubmit : handleLoginSubmit} className="chathub-form">
                                    {/* SIGN UP ONLY: Full Name */}
                                    {isSignupView && (
                                        <div className="chathub-input-group">
                                            <label>Full Name</label>
                                            <div className="input-with-icon">
                                                <span className="field-icon">
                                                    <svg viewBox="0 0 20 20" fill="currentColor">
                                                        <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                                                    </svg>
                                                </span>
                                                <input
                                                    type="text"
                                                    placeholder="Enter your full name"
                                                    value={fullName}
                                                    onChange={(e) => setFullName(e.target.value)}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Email Address (Or Email/Username for login) */}
                                    <div className="chathub-input-group">
                                        <label>{isSignupView ? 'Email Address' : 'Email or Username'}</label>
                                        <div className="input-with-icon">
                                            <span className="field-icon">
                                                <svg viewBox="0 0 20 20" fill="currentColor">
                                                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                                </svg>
                                            </span>
                                            <input
                                                type={isSignupView ? 'email' : 'text'}
                                                placeholder={isSignupView ? 'Enter your email address' : 'Enter your email or username'}
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                required
                                            />
                                        </div>
                                    </div>

                                    {/* SIGN UP ONLY: Username */}
                                    {isSignupView && (
                                        <div className="chathub-input-group">
                                            <label>Username</label>
                                            <div className="input-with-icon">
                                                <span className="field-icon text-symbol">@</span>
                                                <input
                                                    type="text"
                                                    placeholder="Choose a username"
                                                    value={username}
                                                    onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
                                                    required
                                                />
                                            </div>
                                        </div>
                                    )}

                                    {/* Password */}
                                    <div className="chathub-input-group">
                                        <label>Password</label>
                                        <div className="input-with-icon">
                                            <span className="field-icon">
                                                <svg viewBox="0 0 20 20" fill="currentColor">
                                                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                                                </svg>
                                            </span>
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                placeholder={isSignupView ? 'Create a password' : 'Enter your password'}
                                                value={password}
                                                onChange={(e) => setPassword(e.target.value)}
                                                required
                                            />
                                            <button
                                                type="button"
                                                className="password-toggle-btn"
                                                onClick={() => setShowPassword(!showPassword)}
                                                tabIndex={-1}
                                                title={showPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showPassword ? '👁️' : '👁️‍🗨️'}
                                            </button>
                                        </div>
                                    </div>

                                    {/* LOGIN ONLY: Remember Me & Forgot Password Row */}
                                    {isLoginView && (
                                        <div className="remember-forgot-row">
                                            <label className="checkbox-wrap">
                                                <input
                                                    type="checkbox"
                                                    checked={rememberMe}
                                                    onChange={(e) => setRememberMe(e.target.checked)}
                                                />
                                                <span>Remember me</span>
                                            </label>
                                            <button
                                                type="button"
                                                className="forgot-link-btn"
                                                onClick={() => navigateTo('forgot-password')}
                                            >
                                                Forgot password?
                                            </button>
                                        </div>
                                    )}

                                    {/* Primary CTA Submit Button */}
                                    <button
                                        type="submit"
                                        className="chathub-primary-btn"
                                        disabled={loading}
                                    >
                                        {loading ? (
                                            <span className="btn-spinner"></span>
                                        ) : (
                                            <>
                                                <span>{isSignupView ? 'Create Account' : 'Log In'}</span>
                                                <span className="btn-arrow">→</span>
                                            </>
                                        )}
                                    </button>
                                </form>

                                {/* Social Login Divider */}
                                <div className="social-divider">
                                    <span>{isSignupView ? 'Or sign up with' : 'Or continue with'}</span>
                                </div>

                                {/* Social Buttons: Google, GitHub, Microsoft */}
                                <div className="social-buttons-grid">
                                    <button
                                        type="button"
                                        className="social-btn"
                                        onClick={handleGoogleAuth}
                                        title="Continue with Google"
                                    >
                                        <svg className="social-icon" viewBox="0 0 24 24">
                                            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                                            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                                            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
                                            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
                                        </svg>
                                        <span>Google</span>
                                    </button>

                                    <button
                                        type="button"
                                        className="social-btn"
                                        onClick={() => alert("GitHub Sign-In integration ready")}
                                        title="Continue with GitHub"
                                    >
                                        <svg className="social-icon" viewBox="0 0 24 24" fill="currentColor">
                                            <path fillRule="evenodd" clipRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.53 1.032 1.53 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" />
                                        </svg>
                                        <span>GitHub</span>
                                    </button>

                                    <button
                                        type="button"
                                        className="social-btn"
                                        onClick={() => alert("Microsoft Sign-In integration ready")}
                                        title="Continue with Microsoft"
                                    >
                                        <svg className="social-icon" viewBox="0 0 24 24">
                                            <path fill="#f25022" d="M1 1h10v10H1z" />
                                            <path fill="#00a4ef" d="M1 13h10v10H1z" />
                                            <path fill="#7fba00" d="M13 1h10v10H13z" />
                                            <path fill="#ffb900" d="M13 13h10v10H13z" />
                                        </svg>
                                        <span>Microsoft</span>
                                    </button>
                                </div>

                                {isSignupView && (
                                    <p className="terms-privacy-note">
                                        By creating an account, you agree to our{' '}
                                        <a href="#terms">Terms of Service</a> and{' '}
                                        <a href="#privacy">Privacy Policy</a>.
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* RIGHT COLUMN: BRAND HERO DISPLAY */}
                        <div className={`auth-hero-column ${isLoginView ? 'emerald-night' : 'light-hero'}`}>
                            {isSignupView ? (
                                /* SIGNUP HERO: "Chat. Call. Share. Together." */
                                <div className="hero-content-wrap">
                                    <div className="hero-header-text">
                                        <h2 className="hero-headline">
                                            Chat. Call. <br />
                                            Share. <span className="highlight-green">Together.</span>
                                        </h2>
                                        <p className="hero-description">
                                            Experience fast, secure and seamless communication with ChatHub.
                                        </p>
                                    </div>

                                    {/* 4 Feature List Badges */}
                                    <div className="features-badge-list">
                                        <div className="feature-pill-item">
                                            <div className="pill-icon green">💬</div>
                                            <div className="pill-text">
                                                <h4>Real-time Messaging</h4>
                                                <p>Chat instantly with your contacts</p>
                                            </div>
                                        </div>

                                        <div className="feature-pill-item">
                                            <div className="pill-icon green">📞</div>
                                            <div className="pill-text">
                                                <h4>Voice & Video Calls</h4>
                                                <p>High quality and reliable</p>
                                            </div>
                                        </div>

                                        <div className="feature-pill-item">
                                            <div className="pill-icon green">👥</div>
                                            <div className="pill-text">
                                                <h4>Create Groups</h4>
                                                <p>Stay connected with your communities</p>
                                            </div>
                                        </div>

                                        <div className="feature-pill-item">
                                            <div className="pill-icon green">🔒</div>
                                            <div className="pill-text">
                                                <h4>Secure & Private</h4>
                                                <p>Your data stays safe with us</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Live Interactive Product Preview Mockup */}
                                    <div className="product-mockup-frame">
                                        <div className="mockup-header-bar">
                                            <div className="mockup-logo">💬 ChatHub</div>
                                            <div className="mockup-user-info">
                                                <div className="mockup-avatar">PS</div>
                                                <div>
                                                    <span className="mockup-name">Priya Sharma</span>
                                                    <span className="mockup-status-dot">● Online</span>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="mockup-chat-preview-body">
                                            <div className="mock-bubble other">Hi Tarun! 👋</div>
                                            <div className="mock-bubble other">How are you?</div>
                                            <div className="mock-bubble self">Hey Priya! Doing great.</div>
                                            <div className="mock-bubble other">Are you free for a call? I wanted to discuss the project.</div>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                /* LOGIN HERO: "Stay Connected Anywhere" with Video Call Mockup */
                                <div className="hero-content-wrap night">
                                    <div className="hero-header-text">
                                        <h2 className="hero-headline night">
                                            Stay Connected <br />
                                            <span className="highlight-green-light">Anywhere</span>
                                        </h2>
                                        <p className="hero-description night">
                                            Message, call and collaborate with the people who matter most.
                                        </p>
                                    </div>

                                    {/* Smartphone Video Call Frame */}
                                    <div className="smartphone-video-mockup">
                                        {/* Floating Badge 1 */}
                                        <div className="floating-badge top-left">
                                            <span>📹 HD Video Calls</span>
                                        </div>

                                        {/* Floating Badge 2 */}
                                        <div className="floating-badge top-right">
                                            <span>📞 Crystal Clear Voice Calls</span>
                                        </div>

                                        <div className="phone-screen-inner">
                                            <div className="phone-call-header">
                                                <div className="caller-profile-chip">
                                                    <div className="caller-avatar-circle">PS</div>
                                                    <div>
                                                        <h5>Priya Sharma</h5>
                                                        <span>00:24</span>
                                                    </div>
                                                </div>
                                                <span className="screen-expand-icon">⛶</span>
                                            </div>

                                            {/* Video Background Image / Avatar */}
                                            <div className="video-feed-placeholder">
                                                <div className="video-avatar-face">👩</div>
                                                <div className="video-pip-preview">
                                                    <span>👨 You</span>
                                                </div>
                                            </div>

                                            {/* In-Call Phone Controls */}
                                            <div className="phone-call-actions">
                                                <button type="button" className="call-btn-circle">🎙️</button>
                                                <button type="button" className="call-btn-circle">📹</button>
                                                <button type="button" className="call-btn-circle">💻</button>
                                                <button type="button" className="call-btn-circle end">📞</button>
                                            </div>
                                        </div>

                                        {/* Floating Badge 3 */}
                                        <div className="floating-badge bottom-badge">
                                            <span>💬 Fast & Secure Messaging</span>
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* =========================================
                    CASE 3: OTP VERIFICATION SCREEN
                    ========================================= */}
                {isOtpView && (
                    <div className="auth-centered-container">
                        <div className="auth-verification-card">
                            <div className="verification-icon-wrap">
                                <div className="icon-pulse-circle">✉️</div>
                            </div>

                            <h2>Verify your email</h2>
                            <p className="verification-instruction">
                                We've sent a 6-digit verification code to <br />
                                <strong>{pendingEmail || email || 'your email'}</strong>. <br />
                                Enter it below to activate your account.
                            </p>

                            {error && <div className="auth-alert-box error">{error}</div>}
                            {successMsg && <div className="auth-alert-box success">{successMsg}</div>}

                            <form onSubmit={handleVerifyOtpSubmit}>
                                {/* 6 Individual OTP Boxes */}
                                <div className="otp-boxes-row" onPaste={handleOtpPaste}>
                                    {otpDigits.map((digit, idx) => (
                                        <input
                                            key={idx}
                                            ref={(el) => (otpInputRefs.current[idx] = el)}
                                            type="text"
                                            inputMode="numeric"
                                            maxLength={1}
                                            className="otp-digit-box"
                                            value={digit}
                                            onChange={(e) => handleOtpChange(idx, e.target.value)}
                                            onKeyDown={(e) => handleOtpKeyDown(idx, e)}
                                            required
                                        />
                                    ))}
                                </div>

                                {/* Timer & Resend */}
                                <div className="otp-timer-row">
                                    <span className="countdown-text">
                                        ⏳ Code expires in <strong>{formatTime(timerSeconds)}</strong>
                                    </span>
                                    <button
                                        type="button"
                                        className="resend-code-btn"
                                        onClick={handleResendOtp}
                                        disabled={resendCooldown > 0}
                                    >
                                        {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend Code'}
                                    </button>
                                </div>

                                <button
                                    type="submit"
                                    className="chathub-primary-btn"
                                    disabled={loading || otpDigits.join('').length !== 6}
                                >
                                    {loading ? <span className="btn-spinner"></span> : 'Verify Code →'}
                                </button>
                            </form>

                            <div className="verification-card-footer">
                                <button
                                    type="button"
                                    className="text-link-btn"
                                    onClick={() => navigateTo('signup')}
                                >
                                    ← Change email / Register again
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* =========================================
                    CASE 4: FORGOT PASSWORD REQUEST SCREEN
                    ========================================= */}
                {isForgotView && (
                    <div className="auth-centered-container">
                        <div className="auth-verification-card">
                            <div className="verification-icon-wrap">
                                <div className="icon-pulse-circle">🔑</div>
                            </div>

                            <h2>Forgot password?</h2>
                            <p className="verification-instruction">
                                Enter your registered email address and we'll send you a 6-digit code to recover your account.
                            </p>

                            {error && <div className="auth-alert-box error">{error}</div>}
                            {successMsg && <div className="auth-alert-box success">{successMsg}</div>}

                            <form onSubmit={handleForgotPasswordSubmit} className="chathub-form">
                                <div className="chathub-input-group">
                                    <label>Registered Email</label>
                                    <div className="input-with-icon">
                                        <span className="field-icon">
                                            <svg viewBox="0 0 20 20" fill="currentColor">
                                                <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z" />
                                                <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z" />
                                            </svg>
                                        </span>
                                        <input
                                            type="email"
                                            placeholder="Enter your email address"
                                            value={email}
                                            onChange={(e) => setEmail(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="chathub-primary-btn" disabled={loading}>
                                    {loading ? <span className="btn-spinner"></span> : 'Send Recovery Code →'}
                                </button>
                            </form>

                            <div className="verification-card-footer">
                                <button
                                    type="button"
                                    className="text-link-btn"
                                    onClick={() => navigateTo('login')}
                                >
                                    ← Back to Log In
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* =========================================
                    CASE 5: RESET PASSWORD SCREEN
                    ========================================= */}
                {isResetView && (
                    <div className="auth-centered-container">
                        <div className="auth-verification-card">
                            <div className="verification-icon-wrap">
                                <div className="icon-pulse-circle">🛡️</div>
                            </div>

                            <h2>Set new password</h2>
                            <p className="verification-instruction">
                                Please create a strong password of at least 6 characters.
                            </p>

                            {error && <div className="auth-alert-box error">{error}</div>}
                            {successMsg && <div className="auth-alert-box success">{successMsg}</div>}

                            <form onSubmit={handleResetPasswordSubmit} className="chathub-form">
                                <div className="chathub-input-group">
                                    <label>New Password</label>
                                    <div className="input-with-icon">
                                        <span className="field-icon">🔒</span>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Enter new password"
                                            value={password}
                                            onChange={(e) => setPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="chathub-input-group">
                                    <label>Confirm New Password</label>
                                    <div className="input-with-icon">
                                        <span className="field-icon">🔒</span>
                                        <input
                                            type={showPassword ? 'text' : 'password'}
                                            placeholder="Confirm new password"
                                            value={confirmPassword}
                                            onChange={(e) => setConfirmPassword(e.target.value)}
                                            required
                                        />
                                    </div>
                                </div>

                                <button type="submit" className="chathub-primary-btn" disabled={loading}>
                                    {loading ? <span className="btn-spinner"></span> : 'Reset Password →'}
                                </button>
                            </form>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
