import React from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ThemeProvider } from './context/ThemeContext';
import { SocketProvider } from './context/SocketContext';
import { WebRTCProvider } from './context/WebRTCContext';
import { MessageSquare } from 'lucide-react';
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
                backgroundColor: 'var(--chathub-bg-deep, #070d14)',
                color: '#10b981',
                fontSize: '1.25rem',
                fontWeight: 700,
                fontFamily: 'Inter, system-ui, sans-serif'
            }}>
                <MessageSquare size={24} style={{ marginRight: '10px' }} /> Loading ChatHub...
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
        <ThemeProvider>
            <AuthProvider>
                <AppRouter />
            </AuthProvider>
        </ThemeProvider>
    );
}
