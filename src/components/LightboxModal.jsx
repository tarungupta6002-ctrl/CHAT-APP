import React, { useEffect } from 'react';
import { useSocket } from '../context/SocketContext';

export default function LightboxModal() {
    const { lightboxData, setLightboxData } = useSocket();

    useEffect(() => {
        const handleKeyDown = (e) => {
            if (e.key === 'Escape' && lightboxData) {
                setLightboxData(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [lightboxData, setLightboxData]);

    if (!lightboxData) return null;

    return (
        <div
            className="lightbox-overlay"
            onClick={(e) => {
                if (e.target.classList.contains('lightbox-overlay')) {
                    setLightboxData(null);
                }
            }}
        >
            <div className="lightbox-modal">
                <div className="lightbox-header">
                    <div className="lightbox-title-area">
                        {lightboxData.isViewOnce && (
                            <span className="lightbox-badge">① View Once</span>
                        )}
                        <span>{lightboxData.title || 'Photo'}</span>
                    </div>
                    <button
                        type="button"
                        className="lightbox-close-btn"
                        title="Close"
                        onClick={() => setLightboxData(null)}
                    >
                        ✕
                    </button>
                </div>
                <div className="lightbox-body">
                    <img src={lightboxData.src} alt="Full chat preview" />
                </div>
                {lightboxData.isViewOnce && (
                    <div className="lightbox-warning">
                        🔒 This is a View Once photo. It will disappear permanently once closed.
                    </div>
                )}
            </div>
        </div>
    );
}
