import { useState, useCallback, useEffect, useRef } from 'react';
import { HistorySidebar } from './components/HistorySidebar';
import { cn } from './utils';
import MediaPlayer from './components/MediaPlayer';
import TranscriptPanel from './components/TranscriptPanel';
import { SettingsDrawer } from './components/SettingsDrawer';
import { Toast, ToastProps } from './components/Toast';
import { LandingScreen } from './components/LandingScreen';
import { InputModal } from './components/InputModal';
import { useTranscriptSync } from './hooks/useTranscriptSync';
import { useTranscriptPoller } from './hooks/useTranscriptPoller';
import { useSettings } from './hooks/useSettings';
import { useClickOutside } from './hooks/useClickOutside';
import { MediaData, TranscriptData, TranscriptionStatus } from './types';
import { api } from './services/api';
import { Settings, Plus, Upload, ChevronLeft, History } from 'lucide-react';

function App() {
    const [media, setMedia] = useState<MediaData | null>(null);
    const [transcript, setTranscript] = useState<TranscriptData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showInputModal, setShowInputModal] = useState(false);
    const [droppedFile, setDroppedFile] = useState<File | null>(null);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);
    const [showHistory, setShowHistory] = useState(false);
    const [historyRefreshKey, setHistoryRefreshKey] = useState(0);
    const [toasts, setToasts] = useState<ToastProps[]>([]);

    const { isDark, zoom, toggleDarkMode, adjustZoom } = useSettings();

    const addToast = (message: string, type: ToastProps['type'] = 'info') => {
        const id = Math.random().toString(36).substr(2, 9);
        setToasts(prev => [...prev, { id, message, type, onClose: removeToast }]);
    };

    const removeToast = (id: string) => {
        setToasts(prev => prev.filter(t => t.id !== id));
    };

    // System Settings State
    const [systemSpecs, setSystemSpecs] = useState<{ cpu: string, gpu: string, ram: number, vram: number, cores: number, threads: number } | null>(null);
    const [currentModel, setCurrentModel] = useState<string>('distil-large-v3');
    const [isModelChanging, setIsModelChanging] = useState(false);

    // Fetch Config & Specs on mount
    useEffect(() => {
        const fetchSystemInfo = async () => {
            try {
                // Wait for backend to be ready (max 12s)
                const isReady = await api.waitForBackend(15, 800);
                if (!isReady) {
                    console.error("Backend failed to respond after retries");
                    return;
                }

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
        } finally {
            setIsModelChanging(false);
        }
    };

    const {
        currentTime,
        activeSegmentId,
        handleTimeUpdate,
        handleSegmentClick,
    } = useTranscriptSync(transcript);

    // Poll for transcript updates when processing
    useTranscriptPoller(
        transcript,
        (updated) => {
            setTranscript(updated);
            if (updated.status !== transcript?.status && (updated.status === 'completed' || updated.status === 'failed')) {
                setHistoryRefreshKey(prev => prev + 1);
                if (updated.status === 'completed') {
                    addToast('Transcription completed successfully', 'success');
                } else {
                    addToast('Transcription failed', 'error');
                }
            }
        },
        (id) => handleHistoryDelete(id)
    );

    const handleMediaLoaded = useCallback(async (mediaData: MediaData) => {
        setMedia(mediaData);
        setTranscript(null);
        setError(null);
        setShowInputModal(false);
        try {
            const initialTranscript = await api.getTranscriptByMedia(mediaData.id);
            setTranscript(initialTranscript);
            setHistoryRefreshKey(prev => prev + 1);
        } catch (error) {
            console.log("Initial transcript load failed", error);
        }
    }, []);

    const handleTranscriptLoaded = useCallback((transcriptData: TranscriptData) => {
        setTranscript(transcriptData);
        setHistoryRefreshKey(prev => prev + 1);
    }, []);

    const handleError = useCallback((message: string) => {
        setError(message);
        setIsLoading(false);
    }, []);

    const handleHistorySelect = useCallback(async (mediaId: number) => {
        if (mediaId === -1) {
            setIsLoading(false);
            setShowInputModal(true);
            return;
        }
        try {
            setIsLoading(true);
            setError(null);
            const mediaData = await api.getMedia(mediaId);
            setMedia(mediaData);

            try {
                const transcriptData = await api.getTranscriptByMedia(mediaId);
                setTranscript(transcriptData);
                setHistoryRefreshKey(prev => prev + 1);
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
        setIsLoading(false);
    };

    const handleHistoryDelete = useCallback((mediaId: number) => {
        if (media?.id === mediaId) {
            resetState();
        }
    }, [media]);

    // Close settings on click outside
    const settingsRef = useRef<HTMLDivElement>(null);
    useClickOutside(settingsRef as React.RefObject<HTMLElement>, () => {
        if (showSettingsMenu) setShowSettingsMenu(false);
    });

    // Global Drag & Drop
    const [isDragging, setIsDragging] = useState(false);
    const dragCounter = useRef(0);

    useEffect(() => {
        const handleDragEnter = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current++;
            if (e.dataTransfer?.items && e.dataTransfer.items.length > 0) {
                setIsDragging(true);
            }
        };

        const handleDragLeave = (e: DragEvent) => {
            e.preventDefault();
            dragCounter.current--;
            if (dragCounter.current === 0) {
                setIsDragging(false);
            }
        };

        const handleDragOver = (e: DragEvent) => {
            e.preventDefault();
        };

        const handleDrop = (e: DragEvent) => {
            e.preventDefault();
            setIsDragging(false);
            dragCounter.current = 0;

            const files = e.dataTransfer?.files;
            if (files && files.length > 0) {
                setDroppedFile(files[0]);
                setShowInputModal(true);
            }
        };

        window.addEventListener('dragenter', handleDragEnter);
        window.addEventListener('dragleave', handleDragLeave);
        window.addEventListener('dragover', handleDragOver);
        window.addEventListener('drop', handleDrop);

        return () => {
            window.removeEventListener('dragenter', handleDragEnter);
            window.removeEventListener('dragleave', handleDragLeave);
            window.removeEventListener('dragover', handleDragOver);
            window.removeEventListener('drop', handleDrop);
        };
    }, []);

    // Keyboard Shortcuts
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
                return;
            }

            if (e.key === '/') {
                e.preventDefault();
                const searchInput = document.querySelector('input[placeholder*="Search transcript"]') as HTMLInputElement;
                searchInput?.focus();
            } else if (e.key === ' ') {
                e.preventDefault();
                const mediaElement = document.querySelector('video, audio') as HTMLMediaElement;
                if (mediaElement) {
                    if (mediaElement.paused) mediaElement.play();
                    else mediaElement.pause();
                }
            } else if (e.key.toLowerCase() === 'j') {
                const mediaElement = document.querySelector('video, audio') as HTMLMediaElement;
                if (mediaElement) mediaElement.currentTime = Math.max(0, mediaElement.currentTime - 10);
            } else if (e.key.toLowerCase() === 'k') {
                const mediaElement = document.querySelector('video, audio') as HTMLMediaElement;
                if (mediaElement) mediaElement.currentTime = Math.min(mediaElement.duration, mediaElement.currentTime + 10);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    const handleRetry = useCallback(async () => {
        if (!media) return;
        try {
            addToast('Retrying transcription...', 'info');
            await api.startTranscription(media.id);
            // Update local state to pending
            const pendingTranscript = await api.getTranscriptByMedia(media.id);
            setTranscript(pendingTranscript);
            setHistoryRefreshKey(prev => prev + 1);
        } catch (err: any) {
            console.error("Retry failed:", err);
            addToast(err.message || 'Retry failed', 'error');
        }
    }, [media]);

    return (
        <div className={cn(
            "flex h-screen w-full overflow-hidden font-sans selection:bg-primary/10 transition-colors duration-700 relative",
            "bg-gradient-to-br from-background via-background/95 to-background",
            isDragging && "ring-4 ring-primary ring-inset"
        )}>
            {/* Premium Background Effects */}
            <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
                <div className="absolute top-[-20%] right-[-10%] w-[800px] h-[800px] rounded-full bg-primary/5 blur-[120px] mix-blend-screen opacity-50 animate-pulse" />
                <div className="absolute bottom-[-20%] left-[-10%] w-[600px] h-[600px] rounded-full bg-blue-500/5 blur-[100px] mix-blend-screen opacity-30" />
            </div>

            {isDragging && (
                <div className="fixed inset-0 z-[100] bg-primary/10 backdrop-blur-[2px] flex items-center justify-center pointer-events-none">
                    <div className="bg-background/80 backdrop-blur-md border-2 border-primary border-dashed p-12 rounded-[40px] shadow-2xl flex flex-col items-center gap-6 animate-in zoom-in-95 duration-300">
                        <div className="w-20 h-20 bg-primary rounded-3xl flex items-center justify-center shadow-lg transform rotate-12">
                            <Upload className="w-10 h-10 text-primary-foreground" />
                        </div>
                        <p className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/70">Drop files to transcribe</p>
                    </div>
                </div>
            )}
            {/* Sidebar - Left Drawer */}
            <HistorySidebar
                isOpen={showHistory}
                onClose={() => setShowHistory(false)}
                onSelect={handleHistorySelect}
                onDelete={handleHistoryDelete}
                refreshKey={historyRefreshKey}
            />

            {/* Navigation Rail */}
            <nav className="z-50 w-[72px] h-full flex flex-col items-center py-6 bg-background/40 backdrop-blur-xl border-r border-white/10 shrink-0">
                <button
                    onClick={resetState}
                    className="w-10 h-10 rounded-xl bg-primary flex items-center justify-center mb-8 shadow-lg hover:scale-105 transition-all group"
                    title="Home"
                >
                    <Plus className="w-5 h-5 text-primary-foreground group-hover:rotate-90 transition-transform" />
                </button>

                <div className="flex-1 flex flex-col items-center gap-4 w-full px-3">
                    <button
                        onClick={() => setShowHistory(true)}
                        className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                            showHistory ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        )}
                        title="History"
                    >
                        <History className="w-5 h-5" />
                    </button>

                    <button
                        onClick={() => setShowSettingsMenu(true)}
                        className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                            showSettingsMenu ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-white/5 hover:text-foreground"
                        )}
                        title="Settings"
                    >
                        <Settings className="w-5 h-5 group-hover:rotate-45 transition-transform" />
                    </button>
                </div>

                <div className="mt-auto pb-6">
                    <p className="text-[10px] text-zinc-500 font-medium rotate-0 opacity-40">v4.3.14</p>
                </div>
            </nav>

            <SettingsDrawer
                isOpen={showSettingsMenu}
                onClose={() => setShowSettingsMenu(false)}
                isDark={isDark}
                toggleDarkMode={toggleDarkMode}
                zoom={zoom}
                adjustZoom={adjustZoom}
                systemSpecs={systemSpecs}
                currentModel={currentModel}
                onModelChange={handleModelChange}
                isModelChanging={isModelChanging}
            />

            {/* Content Area */}
            <main className="flex-1 relative flex flex-col min-w-0 transition-all duration-300 z-10">
                <div className="flex-1 flex overflow-hidden relative">
                    {!media ? (
                        <LandingScreen onNewTranscription={() => setShowInputModal(true)} />
                    ) : (
                        <div className="flex-1 flex flex-col lg:flex-row h-full">
                            <div className="flex-1 min-w-0 border-r border-border bg-accent/20 p-6 flex flex-col overflow-hidden">
                                <div className="flex items-center justify-between mb-3">
                                    <button
                                        onClick={resetState}
                                        className="text-xs font-bold uppercase tracking-widest text-muted-foreground hover:text-foreground transition-colors flex items-center gap-2"
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                        Back to Start
                                    </button>
                                </div>
                                <div className="flex-1 max-h-[55vh] my-auto flex items-center justify-center min-h-0 bg-white dark:bg-black rounded-3xl border border-border shadow-sm p-4 overflow-hidden">
                                    <MediaPlayer
                                        media={media}
                                        currentTime={currentTime}
                                        onTimeUpdate={handleTimeUpdate}
                                        transcript={transcript}
                                        onToast={addToast}
                                    />
                                </div>
                            </div>
                            <div className="flex-[1.4] min-w-0 md:min-w-[320px] lg:min-w-[400px] bg-background transition-colors duration-300 overflow-hidden">
                                <TranscriptPanel
                                    transcript={transcript}
                                    activeSegmentId={activeSegmentId}
                                    onSegmentClick={handleSegmentClick}
                                    isLoading={isLoading}
                                    onRetry={handleRetry}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <InputModal
                    isOpen={showInputModal}
                    onClose={() => {
                        setShowInputModal(false);
                        setDroppedFile(null);
                    }}
                    droppedFile={droppedFile}
                    onMediaLoaded={handleMediaLoaded}
                    onTranscriptLoaded={handleTranscriptLoaded}
                    onError={handleError}
                    isLoading={isLoading}
                    setIsLoading={setIsLoading}
                    currentModel={currentModel}
                    onModelChange={handleModelChange}
                    error={error}
                />
            </main>

            <div className="fixed bottom-8 right-8 z-[1000] flex flex-col gap-3">
                {toasts.map(toast => (
                    <Toast key={toast.id} {...toast} />
                ))}
            </div>
        </div >
    );
}

export default App;
