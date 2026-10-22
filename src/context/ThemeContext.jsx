import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
    const [theme, setTheme] = useState(() => {
        try {
            const saved = localStorage.getItem('chathub_theme');
            if (saved === 'light' || saved === 'dark') return saved;
            // Check system preference if no saved preference
            if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
                return 'light';
            }
        } catch (_) {}
        return 'dark'; // Default to dark navy theme
    });

    useEffect(() => {
        document.documentElement.setAttribute('data-theme', theme);
        document.body.classList.remove('theme-dark', 'theme-light', 'light-theme');
        document.body.classList.add(`theme-${theme}`);
        if (theme === 'light') {
            document.body.classList.add('light-theme');
        }
        try {
            localStorage.setItem('chathub_theme', theme);
        } catch (_) {}
    }, [theme]);

    const toggleTheme = (event) => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';

        // Check if View Transitions API is supported and user has not requested reduced motion
        const isReducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

        if (document.startViewTransition && !isReducedMotion) {
            // Get click origin coordinates from event, fallback to center of screen
            const x = event?.clientX ?? (window.innerWidth / 2);
            const y = event?.clientY ?? (window.innerHeight / 2);

            // Compute distance to the furthest corner of the viewport
            const endRadius = Math.hypot(
                Math.max(x, window.innerWidth - x),
                Math.max(y, window.innerHeight - y)
            );

            const transition = document.startViewTransition(() => {
                setTheme(nextTheme);
            });

            transition.ready.then(() => {
                document.documentElement.animate(
                    {
                        clipPath: [
                            `circle(0px at ${x}px ${y}px)`,
                            `circle(${endRadius}px at ${x}px ${y}px)`
                        ]
                    },
                    {
                        duration: 520,
                        easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
                        pseudoElement: '::view-transition-new(root)'
                    }
                );
            });
        } else {
            // Fallback for browsers without View Transitions
            setTheme(nextTheme);
        }
    };

    return (
        <ThemeContext.Provider value={{ theme, setTheme, toggleTheme, isDark: theme === 'dark' }}>
            {children}
        </ThemeContext.Provider>
    );
}

export function useTheme() {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
}
