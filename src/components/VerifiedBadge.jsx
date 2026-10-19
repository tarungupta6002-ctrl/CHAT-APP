import React from 'react';

/**
 * Official Verified Blue Tick Badge
 * Renders an authentic scalloped blue rosette with a crisp white checkmark.
 */
export default function VerifiedBadge({ size = 16, className = '', style = {} }) {
    return (
        <span 
            className={`chathub-verified-badge ${className}`} 
            title="Official Verified Channel"
            aria-label="Verified"
            style={{ 
                display: 'inline-flex', 
                alignItems: 'center', 
                justifyContent: 'center',
                flexShrink: 0,
                lineHeight: 1,
                cursor: 'default',
                ...style 
            }}
        >
            <svg 
                viewBox="0 0 24 24" 
                width={size} 
                height={size} 
                style={{ display: 'block' }}
            >
                {/* 12-point scalloped verified rosette */}
                <path 
                    fill="#1d9bf0" 
                    d="M22.5 12.5c0-1.58-.875-2.95-2.148-3.6.154-.435.238-.905.238-1.4 0-2.21-1.79-4-4-4-.495 0-.965.084-1.4.238C14.55 2.475 13.18 1.6 11.6 1.6c-1.58 0-2.95.875-3.6 2.148-.435-.154-.905-.238-1.4-.238-2.21 0-4 1.79-4 4 0 .495.084.965.238 1.4C1.575 9.55.7 10.92.7 12.5c0 1.58.875 2.95 2.148 3.6-.154.435-.238.905-.238 1.4 0 2.21 1.79 4 4 4 .495 0 .965-.084 1.4-.238 1.05 1.273 2.42 2.148 4 2.148 1.58 0 2.95-.875 3.6-2.148.435.154.905.238 1.4.238 2.21 0 4-1.79 4-4 0-.495-.084-.965-.238-1.4 1.273-1.05 2.148-2.42 2.148-4z" 
                />
                {/* Inner white checkmark */}
                <path 
                    fill="#ffffff" 
                    d="M10.2 16.2l-3.5-3.5 1.4-1.4 2.1 2.1 5.6-5.6 1.4 1.4-7 7z" 
                />
            </svg>
        </span>
    );
}
