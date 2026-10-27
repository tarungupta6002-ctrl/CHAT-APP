import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Backend API router for native mobile app (Capacitor)
const BACKEND_URL = 'https://chat-app-pmab.onrender.com';
if (typeof window !== 'undefined') {
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
        if (typeof input === 'string' && input.startsWith('/')) {
            const isLiveRender = window.location.origin.includes('onrender.com');
            const target = isLiveRender ? input : `${BACKEND_URL}${input}`;
            return originalFetch(target, init);
        }
        return originalFetch(input, init);
    };

    const markMobileApp = () => {
        try {
            const isCap = !!(window.Capacitor && (typeof window.Capacitor.isNativePlatform === 'function' ? window.Capacitor.isNativePlatform() : true));
            const isAppUa = /ChatHubApp|Capacitor/i.test(navigator.userAgent || '');
            const isStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
            const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent || '');

            if (isCap || isAppUa || (isStandalone && isMobile)) {
                document.documentElement.classList.add('native-mobile-app');
                document.body?.classList.add('native-mobile-app');
            }
        } catch (e) {}
    };
    markMobileApp();
    window.addEventListener('DOMContentLoaded', markMobileApp);
    window.addEventListener('load', markMobileApp);
}

ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        <App />
    </React.StrictMode>
);

