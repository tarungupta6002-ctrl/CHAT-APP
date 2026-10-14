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

    const toggleTheme = () => {
        setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'));
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
