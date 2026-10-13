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
                backgroundColor: '#f8fafc',
                color: '#10b981',
                fontSize: '1.25rem',
                fontWeight: 700,
                fontFamily: 'Inter, system-ui, sans-serif'
            }}>
                <span style={{ marginRight: '8px' }}>💬</span> Loading ChatHub...
            </div>
        );
    }

    if (currentView === 'landing' && !isAuthenticated) {
        return <LandingPage />;
    }

    if (!isAuthenticated || ['login', 'signup', 'verify-otp', 'forgot-password', 'reset-password'].includes(currentView)) {
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
