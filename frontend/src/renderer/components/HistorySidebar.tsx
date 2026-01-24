import { useState, useEffect, useMemo } from 'react';
import { useClickOutside } from '../hooks/useClickOutside';
import { Clock, Loader2, AlertCircle, Trash2, Search, X, FileAudio, FileVideo, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '../services/api';
import { formatDistanceToNow, isToday, isYesterday, isThisWeek } from 'date-fns';
import { cn } from '../utils';

interface HistorySidebarProps {
    onSelect?: (mediaId: number) => void;
    onDelete?: (mediaId: number) => void;
    refreshKey?: number;
}

export const HistorySidebar = ({ onSelect, onDelete, refreshKey = 0, isOpen, onClose }: HistorySidebarProps & { isOpen: boolean; onClose: () => void }) => {
    const [history, setHistory] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');

    const fetchHistory = async () => {
        try {
            setIsLoading(true);
            const data = await api.request<any[]>('/transcripts/');
            // Sort by Date Descending
            const sorted = data.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
            setHistory(sorted);
            setError(null);
        } catch (err: any) {
            setError(err.message || 'Failed to load history');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        if (isOpen) {
            fetchHistory();
        }
        const interval = setInterval(fetchHistory, 60000);
        return () => clearInterval(interval);
    }, [refreshKey, isOpen]);

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

    // Grouping Logic
    const groupedHistory = useMemo(() => {
        const filtered = history.filter(item =>
            (item.media_title || '').toLowerCase().includes(searchQuery.toLowerCase())
        );

        const groups: Record<string, any[]> = {
            'Today': [],
            'Yesterday': [],
            'This Week': [],
            'Older': []
        };

        filtered.forEach(item => {
            const date = new Date(item.created_at);
            if (isToday(date)) groups['Today'].push(item);
            else if (isYesterday(date)) groups['Yesterday'].push(item);
            else if (isThisWeek(date)) groups['This Week'].push(item);
            else groups['Older'].push(item);
        });

        return groups;
    }, [history, searchQuery]);

    const formatDuration = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-[60] bg-background/40 backdrop-blur-sm transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Sidebar Drawer */}
            <div
                className={cn(
                    "fixed top-0 left-0 h-full w-full max-w-[400px] bg-background border-r border-border z-[70] shadow-2xl transition-transform duration-500 ease-out flex flex-col",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Header */}
                <div className="px-8 pt-8 pb-5 border-b border-border bg-accent/5 flex flex-col gap-6 shrink-0">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                                <FileAudio className="w-5 h-5 text-primary" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold">History</h2>
                                <p className="text-xs text-muted-foreground">Browse your recordings</p>
                            </div>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2.5 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Search Bar */}
                    <div className="relative group">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                        <input
                            type="text"
                            placeholder="Search transcripts..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full bg-background border border-border rounded-xl py-2.5 pl-10 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                        />
                    </div>
                </div>

                {/* Content */}
                <div
                    className="flex-1 overflow-y-auto px-8 py-6 space-y-8 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
                >
                    {/* Loading State */}
                    {isLoading && history.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <Loader2 className="w-6 h-6 animate-spin mb-3" />
                            <span className="text-sm">Loading history...</span>
                        </div>
                    )}

                    {/* Error State */}
                    {!isLoading && error && (
                        <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
                            <AlertCircle className="w-8 h-8 text-destructive mb-3" />
                            <p className="text-sm font-medium text-destructive mb-1">Failed to load history</p>
                            <p className="text-xs text-muted-foreground">{error}</p>
                            <button
                                onClick={() => fetchHistory()}
                                className="mt-4 px-4 py-2 bg-secondary hover:bg-secondary/80 rounded-lg text-xs font-medium transition-colors"
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {/* Empty State */}
                    {!isLoading && !error && history.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
                            <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mb-4">
                                <FileAudio className="w-6 h-6 text-muted-foreground/50" />
                            </div>
                            <p className="text-sm font-medium text-foreground">No recordings yet</p>
                            <p className="text-xs text-muted-foreground mt-1">Your transcription history will appear here</p>
                        </div>
                    )}

                    {/* List Content */}
                    {!isLoading && !error && history.length > 0 && (
                        Object.entries(groupedHistory).map(([label, items]) => (
                            items.length > 0 && (
                                <section key={label} className="space-y-4">
                                    <div className="flex items-center gap-2 text-muted-foreground/60">
                                        <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                        <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</h3>
                                    </div>
                                    <div className="grid gap-2 w-full">
                                        {items.map((item) => (
                                            <div
                                                key={item.media_id}
                                                onClick={() => { onSelect?.(item.media_id); onClose(); }}
                                                className="group relative bg-muted/10 hover:bg-muted/30 border border-border/50 hover:border-border rounded-xl p-4 cursor-pointer transition-all duration-300 hover:shadow-sm"
                                            >
                                                {/* Hover Delete */}
                                                <button
                                                    onClick={(e) => handleDelete(e, item.media_id)}
                                                    className="absolute top-2 right-2 p-1.5 bg-background hover:bg-destructive hover:text-destructive-foreground text-muted-foreground border border-border rounded-md opacity-0 group-hover:opacity-100 transition-all scale-90 group-hover:scale-100 z-10 shadow-sm"
                                                    title="Delete"
                                                >
                                                    <Trash2 className="w-3 h-3" />
                                                </button>

                                                <div className="flex items-start gap-4">
                                                    {/* Media Icon */}
                                                    <div className={cn(
                                                        "w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border border-border/40 bg-background/50 mt-0.5",
                                                        item.media_type?.startsWith('video') ? "text-purple-500" : "text-blue-500"
                                                    )}>
                                                        {item.media_type?.startsWith('video') ? <FileVideo className="w-5 h-5" /> : <FileAudio className="w-5 h-5" />}
                                                    </div>

                                                    {/* Info */}
                                                    <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                                                        <h4 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug pr-4">
                                                            {item.media_title || 'Untitled'}
                                                        </h4>

                                                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground leading-none">
                                                            {/* Status */}
                                                            {item.status === 'completed' ? (
                                                                <span className="flex items-center gap-1 text-emerald-500 font-medium">
                                                                    <CheckCircle2 className="w-3 h-3" />
                                                                    <span>Success</span>
                                                                </span>
                                                            ) : item.status === 'processing' ? (
                                                                <span className="flex items-center gap-1 text-blue-500 font-medium animate-pulse">
                                                                    <Loader2 className="w-3 h-3 animate-spin" />
                                                                    <span>Processing</span>
                                                                </span>
                                                            ) : (
                                                                <span className="flex items-center gap-1 font-medium">
                                                                    <Clock className="w-3 h-3" />
                                                                    <span>Pending</span>
                                                                </span>
                                                            )}

                                                            <span className="opacity-30">•</span>

                                                            {/* Duration */}
                                                            <span>{formatDuration(item.duration_seconds || 0)}</span>

                                                            <span className="opacity-30">•</span>

                                                            {/* Time */}
                                                            <span title={new Date(item.created_at).toLocaleString()}>
                                                                {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
                                                            </span>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )
                        ))
                    )}
                </div>
            </div>
        </>
    );
};
