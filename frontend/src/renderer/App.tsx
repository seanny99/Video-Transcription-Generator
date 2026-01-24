import { useState, useCallback, useEffect } from 'react';
import { HistorySidebar } from './components/HistorySidebar';
import MediaInput from './components/MediaInput';
import MediaPlayer from './components/MediaPlayer';
import TranscriptPanel from './components/TranscriptPanel';
import { useTranscriptSync } from './hooks/useTranscriptSync';
import { useTranscriptPoller } from './hooks/useTranscriptPoller';
import { MediaData, TranscriptData } from './types';
import { api } from './services/api';
import { Settings, Moon, Sun, X, ZoomIn, Minus, Plus } from 'lucide-react';

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

function App() {
    const [media, setMedia] = useState<MediaData | null>(null);
    const [transcript, setTranscript] = useState<TranscriptData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showInputModal, setShowInputModal] = useState(false);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [historyRefreshKey, setHistoryRefreshKey] = useState(0);

    // Load settings from localStorage on mount
    const [isDark, setIsDark] = useState(() => loadSettings().isDark);
    const [zoom, setZoom] = useState(() => loadSettings().zoom);

    // Apply settings on mount
    useEffect(() => {
        if (isDark) {
            document.documentElement.classList.add('dark');
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

    // System Settings State
    const [systemSpecs, setSystemSpecs] = useState<{ cpu: string, gpu: string } | null>(null);
    const [currentModel, setCurrentModel] = useState<string>('distil-large-v3');
    const [isModelChanging, setIsModelChanging] = useState(false);

    // Fetch Config & Specs on mount
    useEffect(() => {
        const fetchSystemInfo = async () => {
            try {
                const specs = await api.getSystemSpecs();
                setSystemSpecs(specs);

                const config = await api.getConfig();
                setCurrentModel(config.whisper_model);
            } catch (e) {
                console.error("Failed to load system info:", e);
            }
        };
        fetchSystemInfo();
    }, []);

    const handleModelChange = async (model: string) => {
        try {
            setIsModelChanging(true);
            setCurrentModel(model); // Optimistic update
            await api.updateConfig({ whisper_model: model });
        } catch (e) {
            console.error("Failed to update model:", e);
            // Revert on error could be added here
        } finally {
            setIsModelChanging(false);
        }
    };

    const getModelDescription = (model: string) => {
        switch (model) {
            case 'tiny': return "Instant speed, suitable for quick checks. Lowest accuracy.";
            case 'base': return "Very fast, decent for clear audio.";
            case 'small': return "Good balance of speed and accuracy.";
            case 'distil-medium.en': return "Highly optimized for English. Fast and accurate.";
            case 'medium': return "High accuracy, slower. Good for accents.";
            case 'distil-large-v3': return "Top choice for CPUs. 6x faster than Large-v3 with similar accuracy.";
            case 'large-v3': return "Maximum possible accuracy. Very slow on CPU.";
            default: return "Select a model to see details.";
        }
    };

    const {
        currentTime,
        activeSegmentId,
        handleTimeUpdate,
        handleSegmentClick,
    } = useTranscriptSync(transcript);

    // Poll for transcript updates when processing
    useTranscriptPoller(transcript, setTranscript, (id) => handleHistoryDelete(id)); // Pass delete handler


    const handleMediaLoaded = useCallback(async (mediaData: MediaData) => {
        setMedia(mediaData);
        setTranscript(null);
        setError(null);
        setShowInputModal(false);
        try {
            // Fetch initial transcript state to kick off polling
            const initialTranscript = await api.getTranscriptByMedia(mediaData.id);
            setTranscript(initialTranscript);
        } catch (error) {
            console.log("Initial transcript load failed", error);
        }
    }, []);

    const handleTranscriptLoaded = useCallback((transcriptData: TranscriptData) => {
        setTranscript(transcriptData);
    }, []);

    const handleError = useCallback((message: string) => {
        setError(message);
        setIsLoading(false);
    }, []);

    const handleHistorySelect = useCallback(async (mediaId: number) => {
        try {
            setIsLoading(true);
            setError(null);
            const mediaData = await api.getMedia(mediaId);
            const formattedMedia: MediaData = {
                ...mediaData,
                streamUrl: api.getMediaStreamUrl(mediaId)
            };
            setMedia(formattedMedia);

            try {
                const transcriptData = await api.getTranscriptByMedia(mediaId);
                setTranscript(transcriptData);
                setHistoryRefreshKey(prev => prev + 1); // Refresh sidebar to sync status
            } catch (err) {
                setTranscript(null);
            }

            setShowInputModal(false);
        } catch (err: any) {
            setError(err.message || 'Failed to load history item');
        } finally {
            setIsLoading(false);
        }
    }, []);

    const resetState = () => {
        setMedia(null);
        setTranscript(null);
        setError(null);
        setShowInputModal(false);
    };

    const handleHistoryDelete = useCallback((mediaId: number) => {
        // If the deleted media is currently active, clear the view
        if (media?.id === mediaId) {
            resetState();
        }
    }, [media]);

    return (
        <div className="flex h-screen w-full bg-background text-foreground overflow-hidden font-sans selection:bg-neutral-200 dark:selection:bg-neutral-800 transition-colors duration-700">
            {/* Sidebar - Left */}
            <HistorySidebar
                onSelect={handleHistorySelect}
                onDelete={handleHistoryDelete}
                refreshKey={historyRefreshKey}
            />

            {/* Main Content - Right */}
            <main className="flex-1 relative flex flex-col min-w-0 pl-20 transition-all duration-300">
                {/* Header / Top Bar */}
                <header className="absolute top-0 right-0 w-full p-6 flex justify-end items-center z-50 pointer-events-none">
                    <div className="relative pointer-events-auto">
                        <button
                            onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                            className="p-3 rounded-full hover:bg-neutral-100 dark:hover:bg-neutral-800 transition-colors text-neutral-500 hover:text-black dark:hover:text-white"
                        >
                            <Settings className="w-5 h-5" />
                        </button>

                        {/* Settings Dropdown */}
                        {showSettingsMenu && (
                            <div className="absolute top-full right-0 mt-2 w-80 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-2xl shadow-xl overflow-hidden">
                                <div className="p-4 border-b border-neutral-100 dark:border-neutral-800">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-sm">Settings</h3>
                                        <button
                                            onClick={() => setShowSettingsMenu(false)}
                                            className="p-1 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-800"
                                        >
                                            <X className="w-4 h-4 text-neutral-400" />
                                        </button>
                                    </div>
                                </div>
                                <div className="p-2">
                                    <button
                                        onClick={toggleDarkMode}
                                        className="w-full flex items-center justify-between gap-3 p-3 rounded-xl hover:bg-neutral-50 dark:hover:bg-neutral-800/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-3">
                                            {isDark ? <Moon className="w-4 h-4 text-neutral-500" /> : <Sun className="w-4 h-4 text-neutral-500" />}
                                            <span className="text-sm">Dark Mode</span>
                                        </div>
                                        <div className={`w-10 h-6 rounded-full p-0.5 transition-colors ${isDark ? 'bg-black' : 'bg-neutral-200'}`}>
                                            <div className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${isDark ? 'translate-x-4' : ''}`} />
                                        </div>
                                    </button>

                                    {/* Zoom Control */}
                                    <div className="flex items-center justify-between gap-3 p-3 rounded-xl">
                                        <div className="flex items-center gap-3">
                                            <ZoomIn className="w-4 h-4 text-neutral-500" />
                                            <span className="text-sm">Zoom</span>
                                        </div>
                                        <div className="flex items-center gap-1 bg-neutral-100 dark:bg-neutral-800 rounded-lg p-1">
                                            <button
                                                onClick={() => adjustZoom(-10)}
                                                disabled={zoom <= 50}
                                                className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <Minus className="w-3 h-3" />
                                            </button>
                                            <span className="text-xs font-mono w-10 text-center">{zoom}%</span>
                                            <button
                                                onClick={() => adjustZoom(10)}
                                                disabled={zoom >= 200}
                                                className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                                            >
                                                <Plus className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="my-2 border-t border-neutral-100 dark:border-neutral-800" />

                                    {/* Performance Section */}
                                    <div className="p-3 pt-1">
                                        <div className="flex items-center justify-between mb-3">
                                            <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Model & Performance</h4>
                                        </div>

                                        {/* Hardware Badge */}
                                        <div className="mb-4 bg-neutral-50 dark:bg-neutral-800/50 rounded-lg p-2.5 border border-neutral-100 dark:border-neutral-800">
                                            <div className="flex items-center gap-2 mb-1">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-neutral-500"><rect width="18" height="12" x="3" y="4" rx="2" ry="2" /><line x1="12" x2="12" y1="16" y2="20" /><line x1="8" x2="16" y1="20" y2="20" /></svg>
                                                <span className="text-xs font-medium text-neutral-600 dark:text-neutral-300">System Hardware</span>
                                            </div>
                                            {systemSpecs ? (
                                                <div className="space-y-0.5">
                                                    <div className="text-[0.65rem] text-neutral-400 truncate" title={systemSpecs.cpu}>{systemSpecs.cpu}</div>
                                                    <div className="text-[0.65rem] text-neutral-400 truncate" title={systemSpecs.gpu}>{systemSpecs.gpu}</div>
                                                </div>
                                            ) : (
                                                <div className="text-[0.65rem] text-neutral-400 italic">Detecting hardware...</div>
                                            )}
                                        </div>

                                        {/* Model Selector */}
                                        <div className="space-y-2">
                                            <label className="text-xs text-neutral-500">Active Model</label>
                                            <select
                                                value={currentModel}
                                                onChange={(e) => handleModelChange(e.target.value)}
                                                disabled={isModelChanging}
                                                className="w-full bg-neutral-100 dark:bg-neutral-800 border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 rounded-lg px-2 py-1.5 text-xs outline-none focus:ring-2 focus:ring-black dark:focus:ring-white transition-all appearance-none cursor-pointer disabled:opacity-50"
                                            >
                                                <option value="tiny">🐇 Tiny (Fastest)</option>
                                                <option value="base">🐇 Base (Fast)</option>
                                                <option value="small">⚖️ Small (Balanced)</option>
                                                <option value="distil-medium.en">⚡ Distil-Medium (Fast English)</option>
                                                <option value="medium">🐢 Medium (High Quality)</option>
                                                <option value="distil-large-v3">🚀 Distil-Large-v3 (CPU Optimized)</option>
                                                <option value="large-v3">🐢 Large-v3 (Max Accuracy)</option>
                                            </select>

                                            {/* Model Description/Tip */}
                                            <div className="text-[0.65rem] leading-relaxed text-neutral-400">
                                                {getModelDescription(currentModel)}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                </header>


                {/* Content Area */}
                <div className="flex-1 flex overflow-hidden relative">
                    {!media ? (
                        /* Idle View: Simple Entry */
                        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-white dark:bg-black transition-colors duration-500">
                            {/* Simple New Transcription Button */}
                            <div className="text-center space-y-6">
                                <h1 className="text-4xl font-bold tracking-tight text-black dark:text-white">
                                    TRANSCRIBE AI
                                </h1>
                                <p className="text-neutral-500 max-w-md mx-auto">
                                    Convert audio and video to accurate text transcriptions using AI.
                                </p>
                                <button
                                    onClick={() => setShowInputModal(true)}
                                    className="px-8 py-4 bg-black dark:bg-white text-white dark:text-black font-semibold rounded-full hover:scale-105 transition-transform shadow-lg"
                                >
                                    New Transcription
                                </button>
                            </div>

                            {/* Overlay Input Modal */}
                            {showInputModal && (
                                <div className="absolute inset-0 z-50 flex items-center justify-center bg-white/40 dark:bg-black/40 backdrop-blur-sm p-4 animate-in fade-in duration-300">
                                    <div className="w-full max-w-xl bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-3xl shadow-2xl p-8 relative overflow-hidden">
                                        <button
                                            onClick={() => setShowInputModal(false)}
                                            className="absolute top-4 right-4 p-2 text-neutral-400 hover:text-black dark:hover:text-white transition-colors"
                                        >
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                                        </button>

                                        <div className="mb-6">
                                            <h2 className="text-2xl font-semibold mb-2">New Transcription</h2>
                                            <p className="text-neutral-500 text-sm">Paste a YouTube URL or upload a local file to begin.</p>
                                        </div>

                                        <MediaInput
                                            onMediaLoaded={handleMediaLoaded}
                                            onTranscriptLoaded={handleTranscriptLoaded}
                                            onError={handleError}
                                            isLoading={isLoading}
                                            setIsLoading={setIsLoading}
                                        />

                                        {error && (
                                            <div className="mt-4 p-4 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
                                                <span className="mt-0.5">⚠️</span>
                                                <span>{error}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Active View: Player + Transcript */
                        <div className="flex-1 flex flex-col md:flex-row h-full">
                            {/* Media Player Section */}
                            <div className="flex-[1.5] min-w-0 border-r border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/20 p-6 flex flex-col overflow-hidden">
                                <div className="flex items-center justify-between mb-6">
                                    <button
                                        onClick={resetState}
                                        className="text-xs font-medium uppercase tracking-widest text-neutral-400 hover:text-black dark:hover:text-white transition-colors flex items-center gap-2"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6" /></svg>
                                        Back to Start
                                    </button>
                                </div>
                                <div className="flex-1 flex items-center justify-center min-h-0">
                                    <MediaPlayer
                                        media={media}
                                        currentTime={currentTime}
                                        onTimeUpdate={handleTimeUpdate}
                                    />
                                </div>
                            </div>

                            {/* Transcript Section */}
                            <div className="flex-1 min-w-[350px] bg-white dark:bg-black transition-colors duration-300 overflow-hidden">
                                <TranscriptPanel
                                    transcript={transcript}
                                    activeSegmentId={activeSegmentId}
                                    onSegmentClick={handleSegmentClick}
                                    isLoading={isLoading}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </main>
        </div>
    );
}

export default App;
