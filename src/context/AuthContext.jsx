import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem("chathub_user") || localStorage.getItem("pulse_user");
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });

    const [token, setToken] = useState(() => localStorage.getItem("chathub_token") || localStorage.getItem("pulse_token") || null);
    const [isLoading, setIsLoading] = useState(true);

    // Navigation View State: 'landing' | 'login' | 'signup' | 'verify-otp' | 'forgot-password' | 'reset-password' | 'chat'
    const [currentView, setCurrentView] = useState(() => {
        const path = window.location.pathname.toLowerCase();
        const hasToken = localStorage.getItem("chathub_token") || localStorage.getItem("pulse_token");
        if (hasToken) return 'chat';
        if (path === '/signup') return 'signup';
        if (path === '/login') return 'login';
        if (path === '/forgot-password') return 'forgot-password';
        if (path === '/verify-otp') return 'verify-otp';
        return 'landing';
    });

    // OTP / Password recovery context states
    const [pendingEmail, setPendingEmail] = useState('');
    const [pendingPurpose, setPendingPurpose] = useState('signup'); // 'signup' | 'forgot_password'
    const [resetToken, setResetToken] = useState('');
    const [devOtp, setDevOtp] = useState('');

    // URL synchronizer
    const navigateTo = useCallback((view) => {
        setCurrentView(view);
        try {
            let path = '/';
            if (view === 'signup') path = '/signup';
            else if (view === 'login') path = '/login';
            else if (view === 'forgot-password') path = '/forgot-password';
            else if (view === 'verify-otp') path = '/verify-otp';
            else if (view === 'reset-password') path = '/reset-password';
            else if (view === 'landing') path = '/';
            window.history.pushState({}, '', path);
        } catch (e) {}
    }, []);

    // Listen to browser popstate (Back/Forward buttons)
    useEffect(() => {
        const handlePopState = () => {
            const path = window.location.pathname.toLowerCase();
            if (token) {
                setCurrentView('chat');
                return;
            }
            if (path === '/signup') setCurrentView('signup');
            else if (path === '/login') setCurrentView('login');
            else if (path === '/forgot-password') setCurrentView('forgot-password');
            else if (path === '/verify-otp') setCurrentView('verify-otp');
            else setCurrentView('landing');
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, [token]);

    // Check existing session on load
    useEffect(() => {
        async function verifySession() {
            if (!token) {
                setIsLoading(false);
                return;
            }
            try {
                const res = await fetch('/api/auth/me', {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    setUser(data.user);
                    localStorage.setItem("chathub_user", JSON.stringify(data.user));
                    setCurrentView('chat');
                } else {
                    logout();
                }
            } catch (err) {
                console.warn("Session check offline/error:", err);
            } finally {
                setIsLoading(false);
            }
        }
        verifySession();
    }, [token]);

    // 1. Login with identifier (username or email) and password
    const login = useCallback(async (identifier, password) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ identifier, password })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Login failed. Please check your credentials.');
        }

        setUser(data.user);
        setToken(data.token);
        localStorage.setItem("chathub_user", JSON.stringify(data.user));
        localStorage.setItem("chathub_token", data.token);
        navigateTo('chat');
        return data.user;
    }, [navigateTo]);

    // 2. Send Registration OTP
    const sendSignupOtp = useCallback(async ({ fullName, email, username, password }) => {
        const res = await fetch('/api/auth/send-signup-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ fullName, email, username, password })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to send verification code.');
        }

        setPendingEmail(email);
        setPendingPurpose('signup');
        if (data.devOtp) {
            setDevOtp(data.devOtp);
        } else {
            setDevOtp('');
        }
        navigateTo('verify-otp');
        return data;
    }, [navigateTo]);

    // 3. Verify Registration OTP
    const verifySignupOtp = useCallback(async ({ email, otp }) => {
        const res = await fetch('/api/auth/verify-signup-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Verification code failed.');
        }

        setUser(data.user);
        setToken(data.token);
        localStorage.setItem("chathub_user", JSON.stringify(data.user));
        localStorage.setItem("chathub_token", data.token);
        setPendingEmail('');
        setDevOtp('');
        navigateTo('chat');
        return data.user;
    }, [navigateTo]);

    // 4. Resend OTP
    const resendOtp = useCallback(async ({ email, purpose = 'signup' }) => {
        const res = await fetch('/api/auth/resend-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, purpose })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to resend code.');
        }
        if (data.devOtp) {
            setDevOtp(data.devOtp);
        }
        return data;
    }, []);

    // 5. Forgot Password - Request Recovery OTP
    const forgotPassword = useCallback(async ({ email }) => {
        const res = await fetch('/api/auth/forgot-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to request password reset.');
        }

        setPendingEmail(email);
        setPendingPurpose('forgot_password');
        navigateTo('verify-otp');
        return data;
    }, [navigateTo]);

    // 6. Verify Reset OTP
    const verifyResetOtp = useCallback(async ({ email, otp }) => {
        const res = await fetch('/api/auth/verify-reset-otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, otp })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Invalid reset code.');
        }

        setResetToken(data.resetToken);
        navigateTo('reset-password');
        return data.resetToken;
    }, [navigateTo]);

    // 7. Reset Password with Authorized Token
    const resetPassword = useCallback(async ({ email, newPassword }) => {
        const res = await fetch('/api/auth/reset-password', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, resetToken, newPassword })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Failed to reset password.');
        }

        setResetToken('');
        setPendingEmail('');
        navigateTo('login');
        return data;
    }, [resetToken, navigateTo]);

    // 8. Google Sign-In
    const googleLogin = useCallback(async (credential) => {
        const res = await fetch('/api/auth/google', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ credential })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Google sign-in failed.');
        }

        setUser(data.user);
        setToken(data.token);
        localStorage.setItem("chathub_user", JSON.stringify(data.user));
        localStorage.setItem("chathub_token", data.token);
        navigateTo('chat');
        return data.user;
    }, [navigateTo]);

    // 9. Logout
    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("chathub_user");
        localStorage.removeItem("chathub_token");
        localStorage.removeItem("pulse_user");
        localStorage.removeItem("pulse_token");
        navigateTo('landing');
    }, [navigateTo]);

    // 10. Update Profile (Name, Username, Date of Birth, Bio, Avatar Color, Avatar Picture)
    const updateProfile = useCallback(async ({ fullName, username, dob, bio, color, avatarUrl }) => {
        try {
            const currentUsername = user?.username;
            const res = await fetch("/api/user/profile", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {})
                },
                body: JSON.stringify({
                    userId: user?.id,
                    currentUsername,
                    fullName,
                    username,
                    dob,
                    bio,
                    color,
                    avatarUrl
                })
            });

            const data = await res.json();
            if (!res.ok) {
                return { success: false, error: data.error || "Failed to update profile." };
            }

            setUser(data.user);
            if (data.token) {
                setToken(data.token);
                localStorage.setItem("chathub_token", data.token);
            }
            localStorage.setItem("chathub_user", JSON.stringify(data.user));
            return { success: true, user: data.user };
        } catch (err) {
            console.error("updateProfile error:", err);
            return { success: false, error: err.message || "Failed to update profile." };
        }
    }, [user, token]);

    const value = {
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        currentView,
        setCurrentView,
        navigateTo,
        pendingEmail,
        setPendingEmail,
        pendingPurpose,
        setPendingPurpose,
        devOtp,
        resetToken,
        login,
        sendSignupOtp,
        verifySignupOtp,
        resendOtp,
        forgotPassword,
        verifyResetOtp,
        resetPassword,
        googleLogin,
        updateProfile,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
}

export function useAuth() {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
    return ctx;
}
