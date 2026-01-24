import { useState, useEffect } from 'react';
import { Clock, FileVideo, Loader2, AlertCircle, Trash2, Play } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { api } from '../services/api';
import { formatDistanceToNow } from 'date-fns';

export function cn(...inputs: (string | undefined | null | false)[]) {
    return twMerge(clsx(inputs));
}

interface HistorySidebarProps {
    onSelect?: (mediaId: number) => void;
    onDelete?: (mediaId: number) => void;
    refreshKey?: number;
}

export const HistorySidebar = ({ onSelect, onDelete, refreshKey = 0 }: HistorySidebarProps) => {
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchHistory = async () => {
        try {
            setIsLoading(true);
            const data = await api.request<any[]>('/transcripts/');
            setHistory(data);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load history');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
        // Refresh every minute
        const interval = setInterval(fetchHistory, 60000);
        return () => clearInterval(interval);
    }, [refreshKey]);

    const formatRelativeDate = (dateStr: string) => {
        try {
            // Backend returns UTC timestamps, ensure proper parsing
            const date = new Date(dateStr.endsWith('Z') ? dateStr : dateStr + 'Z');
            return formatDistanceToNow(date, { addSuffix: true });
        } catch {
            return dateStr;
        }
    };

    const handleDelete = async (e: React.MouseEvent, mediaId: number) => {
        e.stopPropagation();
        if (!confirm('Delete this transcription? This cannot be undone.')) return;

        try {
            await api.deleteMedia(mediaId);
            setHistory(prev => prev.filter(item => item.media_id !== mediaId));
            onDelete?.(mediaId);
        } catch (err: any) {
            alert(err.message || 'Failed to delete');
        }
    };

    const handleResume = async (e: React.MouseEvent, mediaId: number) => {
        e.stopPropagation();
        try {
            await api.startTranscription(mediaId);
            fetchHistory(); // Refresh to get updated status
            onSelect?.(mediaId); // Navigate to the transcript view
        } catch (err: any) {
            alert(err.message || 'Failed to resume transcription');
        }
    };

    // Check if a transcript is stale (pending/processing for more than 30 seconds)
    // This matches the backend check so Resume button only appears when it will work
    const isStale = (item: any) => {
        if (item.status !== 'pending' && item.status !== 'processing') return false;
        const createdAt = new Date(item.created_at).getTime();
        const now = Date.now();
        return now - createdAt > 30 * 1000; // 30 seconds
    };

    const [isOpen, setIsOpen] = useState(false);

    return (
        <div
            className={cn(
                "fixed left-0 top-0 h-screen z-50 bg-white dark:bg-black border-r border-neutral-200 dark:border-neutral-800 transition-all duration-300 ease-in-out shadow-2xl flex flex-col",
                isOpen ? "w-80" : "w-20"
            )}
        >
            {/* Header / Toggle Area */}
            <div className="p-6 pb-4">
                <button
                    onClick={() => setIsOpen(!isOpen)}
                    className="flex items-center gap-4 group w-full"
                >
                    <div className={cn(
                        "p-2 rounded-xl transition-colors duration-300",
                        isOpen ? "bg-neutral-100 dark:bg-neutral-800" : "hover:bg-neutral-100 dark:hover:bg-neutral-800"
                    )}>
                        <Clock className={cn(
                            "w-5 h-5 transition-colors",
                            isOpen ? "text-black dark:text-white" : "text-neutral-500"
                        )} />
                    </div>

                    <span className={cn(
                        "text-sm font-bold uppercase tracking-wider text-neutral-500 transition-opacity duration-300 whitespace-nowrap",
                        isOpen ? "opacity-100" : "opacity-0 w-0 overflow-hidden"
                    )}>
                        History
                    </span>
                </button>
            </div>

            {/* List Content */}
            <div className={cn(
                "flex-1 overflow-y-auto space-y-2 px-4 pb-4 custom-scrollbar transition-opacity duration-300",
                isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
            )}>
                {isLoading && history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-neutral-400">
                        <Loader2 className="w-5 h-5 animate-spin mb-2" />
                        <span className="text-xs">Loading...</span>
                    </div>
                ) : error ? (
                    <div className="flex flex-col items-center justify-center h-40 text-red-500 p-4 text-center">
                        <AlertCircle className="w-5 h-5 mb-2" />
                        <span className="text-xs">{error}</span>
                    </div>
                ) : history.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-40 text-neutral-400">
                        <span className="text-xs">No transcriptions yet</span>
                    </div>
                ) : (
                    <AnimatePresence>
                        {history.map((item) => (
                            <motion.div
                                key={item.id}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                onClick={() => {
                                    onSelect?.(item.media_id);
                                    setIsOpen(false); // Auto-close on select
                                }}
                                className={cn(
                                    "group p-3 rounded-xl border border-transparent hover:border-neutral-200 dark:hover:border-neutral-800",
                                    "hover:bg-neutral-50 dark:hover:bg-neutral-900/50 transition-all cursor-pointer",
                                    item.status === 'processing' && "border-neutral-100 dark:border-neutral-900 bg-neutral-50/50 dark:bg-neutral-900/10"
                                )}
                            >
                                <div className="flex items-start justify-between mb-2">
                                    <div className="p-1.5 rounded-lg bg-neutral-100 dark:bg-neutral-800 text-neutral-500 group-hover:text-black dark:group-hover:text-white transition-colors">
                                        <FileVideo className="w-3.5 h-3.5" />
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[0.6rem] text-neutral-400">{formatRelativeDate(item.created_at)}</span>
                                        <button
                                            onClick={(e) => handleDelete(e, item.media_id)}
                                            className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-red-100 dark:hover:bg-red-900/30 text-neutral-400 hover:text-red-500 transition-all"
                                            title="Delete"
                                        >
                                            <Trash2 className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-sm font-medium text-neutral-900 dark:text-neutral-100 mb-1 truncate">
                                    {item.media_title || 'Untitled Transcription'}
                                </h3>

                                <div className="flex items-center gap-2">
                                    {item.duration_seconds && (
                                        <span className="text-[0.6rem] text-neutral-500 font-mono">
                                            {Math.floor(item.duration_seconds / 60)}:{Math.floor(item.duration_seconds % 60).toString().padStart(2, '0')}
                                        </span>
                                    )}
                                    <div className={cn(
                                        "flex items-center gap-1 text-[0.6rem] font-medium px-1.5 py-0.5 rounded-full",
                                        item.status === 'completed' ? "text-emerald-600 bg-emerald-50 dark:text-emerald-400 dark:bg-emerald-900/20" :
                                            item.status === 'failed' ? "text-red-600 bg-red-50 dark:text-red-400 dark:bg-red-900/20" :
                                                "text-neutral-600 bg-neutral-100 dark:text-neutral-400 dark:bg-neutral-800"
                                    )}>
                                        {item.status === 'processing' && <Loader2 className="w-2.5 h-2.5 animate-spin" />}
                                        <span className="capitalize">{item.status}</span>
                                    </div>
                                    {(item.status === 'failed' || isStale(item)) && (
                                        <button
                                            onClick={(e) => handleResume(e, item.media_id)}
                                            className="flex items-center gap-1 px-2 py-0.5 rounded-full text-[0.6rem] font-medium text-blue-600 bg-blue-50 dark:text-blue-400 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/40 transition-colors"
                                            title="Resume transcription"
                                        >
                                            <Play className="w-2.5 h-2.5" />
                                            Resume
                                        </button>
                                    )}
                                </div>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
};
