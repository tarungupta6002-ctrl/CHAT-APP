import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { SocketProvider } from './context/SocketContext';
import { WebRTCProvider } from './context/WebRTCContext';
import LandingPage from './components/LandingPage';
import AuthPage from './components/AuthPage';
import WhatsAppLayout from './components/WhatsAppLayout';

function AppRouter() {
    const { currentView, isAuthenticated, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div style={{
                height: '100vh',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                backgroundColor: 'var(--bg-primary)',
                color: 'var(--accent-primary)',
                fontSize: '1.2rem',
                fontWeight: 600
            }}>
                Loading PulseChat...
            </div>
        );
    }

    if (currentView === 'landing') {
        return <LandingPage />;
    }

    if (currentView === 'auth' || !isAuthenticated) {
        return <AuthPage />;
    }

    return (
        <SocketProvider>
            <WebRTCProvider>
                <WhatsAppLayout />
            </WebRTCProvider>
        </SocketProvider>
    );
}

export default function App() {
    return (
        <AuthProvider>
            <AppRouter />
        </AuthProvider>
    );
}
