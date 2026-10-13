import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
    const [user, setUser] = useState(() => {
        try {
            const saved = localStorage.getItem("pulse_user");
            return saved ? JSON.parse(saved) : null;
        } catch (e) {
            return null;
        }
    });

    const [token, setToken] = useState(() => localStorage.getItem("pulse_token") || null);
    const [isLoading, setIsLoading] = useState(true);
    // currentView: 'landing' | 'auth' | 'chat'
    const [currentView, setCurrentView] = useState(() => {
        return localStorage.getItem("pulse_token") ? 'chat' : 'landing';
    });

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
                    localStorage.setItem("pulse_user", JSON.stringify(data.user));
                } else {
                    // Invalid/expired token
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

    const login = useCallback(async (username, password) => {
        const res = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Login failed');
        }

        setUser(data.user);
        setToken(data.token);
        localStorage.setItem("pulse_user", JSON.stringify(data.user));
        localStorage.setItem("pulse_token", data.token);
        setCurrentView('chat');
        return data.user;
    }, []);

    const register = useCallback(async (username, password) => {
        const res = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        const data = await res.json();
        if (!res.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        setUser(data.user);
        setToken(data.token);
        localStorage.setItem("pulse_user", JSON.stringify(data.user));
        localStorage.setItem("pulse_token", data.token);
        setCurrentView('chat');
        return data.user;
    }, []);

    const logout = useCallback(() => {
        setUser(null);
        setToken(null);
        localStorage.removeItem("pulse_user");
        localStorage.removeItem("pulse_token");
        setCurrentView('landing');
    }, []);

    const value = {
        user,
        token,
        isAuthenticated: Boolean(user && token),
        isLoading,
        currentView,
        setCurrentView,
        login,
        register,
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
