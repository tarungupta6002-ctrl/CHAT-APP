import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

// Dynamic safe-area runtime verification for Android & iOS Capacitor apps
if (typeof window !== 'undefined') {
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

