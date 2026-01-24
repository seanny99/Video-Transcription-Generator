import { useState, useEffect } from 'react';

const SETTINGS_KEY = 'transcribe-ai-settings';

interface AppSettings {
    isDark: boolean;
    zoom: number;
}

const loadSettings = (): AppSettings => {
    try {
        const saved = localStorage.getItem(SETTINGS_KEY);
        if (saved) {
            return JSON.parse(saved);
        }
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
    return { isDark: false, zoom: 100 };
};

const saveSettings = (settings: AppSettings) => {
    try {
        localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
};

export function useSettings() {
    const [isDark, setIsDark] = useState(() => loadSettings().isDark);
    const [zoom, setZoom] = useState(() => loadSettings().zoom);

    // Apply settings on mount
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
        } else {
            document.documentElement.classList.remove('dark');
        }
        document.documentElement.style.fontSize = `${zoom}%`;
    }, []);

    // Save settings whenever they change
    useEffect(() => {
        saveSettings({ isDark, zoom });
    }, [isDark, zoom]);

    const toggleDarkMode = () => {
        document.documentElement.classList.toggle('dark');
        setIsDark(!isDark);
    };

    const adjustZoom = (delta: number) => {
        const newZoom = Math.max(50, Math.min(200, zoom + delta));
        setZoom(newZoom);
        document.documentElement.style.fontSize = `${newZoom}%`;
    };

    return {
        isDark,
        zoom,
        toggleDarkMode,
        adjustZoom
    };
}
