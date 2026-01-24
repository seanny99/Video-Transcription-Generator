import React, { useEffect, useRef, useState, useMemo } from 'react';
import { TranscriptData, TranscriptionStatus } from '../types';
import { Search, MessageSquareText, FileText, Loader2, Download, Copy, Clock, ToggleLeft, ToggleRight, Check, CheckCircle2, AlertCircle } from 'lucide-react';
import { cn } from '../utils';
import { formatTime, generateSrt, generateTxt, downloadFile } from '../utils/transcriptUtils';

interface TranscriptPanelProps {
    transcript: TranscriptData | null;
    activeSegmentId: number | null;
    onSegmentClick: (time: number) => void;
    isLoading: boolean;
}

function TranscriptPanel({
    transcript,
    activeSegmentId,
    onSegmentClick,
    isLoading,
}: TranscriptPanelProps) {
    const containerRef = useRef<HTMLDivElement>(null);
    const activeRef = useRef<HTMLDivElement>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [showTimestamps, setShowTimestamps] = useState(true);
    const [isCopied, setIsCopied] = useState(false);

    const handleCopy = async () => {
        if (!transcript) return;
        const text = generateTxt(transcript.segments, transcript.full_text);
        await navigator.clipboard.writeText(text);
        setIsCopied(true);
        setTimeout(() => setIsCopied(false), 2000);
    };

    useEffect(() => {
        if (activeRef.current && containerRef.current) {
            const container = containerRef.current;
            const active = activeRef.current;
            const containerRect = container.getBoundingClientRect();
            const activeRect = active.getBoundingClientRect();

            if (activeRect.top < containerRect.top || activeRect.bottom > containerRect.bottom) {
                active.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
        }
    }, [activeSegmentId]);

    // Filter segments based on search query
    const filteredSegments = useMemo(() => {
        if (!transcript?.segments) return [];
        if (!searchQuery.trim()) return transcript.segments;
        const query = searchQuery.toLowerCase();
        return transcript.segments.filter(seg =>
            seg.text.toLowerCase().includes(query)
        );
    }, [transcript?.segments, searchQuery]);

    // Highlight matching text
    const highlightText = (text: string) => {
        if (!searchQuery.trim()) return text;
        const query = searchQuery.toLowerCase();
        const index = text.toLowerCase().indexOf(query);
        if (index === -1) return text;
        return (
            <>
                {text.slice(0, index)}
                <mark className="bg-primary/20 text-primary rounded px-0.5 font-semibold">
                    {text.slice(index, index + searchQuery.length)}
                </mark>
                {text.slice(index + searchQuery.length)}
            </>
        );
    };

    const handleExport = (format: 'txt' | 'srt') => {
        if (!transcript?.segments) return;

        let content = '';
        if (format === 'txt') {
            content = generateTxt(transcript.segments, transcript.full_text);
        } else {
            content = generateSrt(transcript.segments);
        }

        downloadFile(content, `transcript.${format}`);
    };

    return (
        <div className="w-full h-full flex flex-col space-y-4 bg-background border-l border-border">
            {/* Panel Header */}
            <div className="p-4 pb-2 border-b border-border bg-accent/5">
                <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-xl">
                            <MessageSquareText className="w-4 h-4 text-primary" />
                        </div>
                        <h2 className="font-bold">Transcript</h2>
                        {transcript && (
                            <div className="flex items-center gap-2">
                                {transcript.status === TranscriptionStatus.Completed ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                                        <CheckCircle2 className="w-3 h-3" />
                                        SUCCESS
                                    </span>
                                ) : transcript.status === TranscriptionStatus.Processing ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-500 border border-blue-500/20 animate-pulse">
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                        PROCESSING
                                    </span>
                                ) : transcript.status === TranscriptionStatus.Failed ? (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-500/10 text-red-500 border border-red-500/20">
                                        <AlertCircle className="w-3 h-3" />
                                        FAILED
                                    </span>
                                ) : (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold bg-zinc-500/10 text-zinc-500 border border-zinc-500/20">
                                        PENDING
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-accent/30 rounded-xl p-1 gap-1">
                            <button
                                onClick={handleCopy}
                                disabled={!transcript}
                                className="p-2 hover:bg-white dark:hover:bg-black rounded-lg text-muted-foreground hover:text-foreground transition-all flex items-center gap-2"
                                title="Copy Full Text"
                            >
                                {isCopied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                            </button>
                            <button
                                onClick={() => handleExport('txt')}
                                disabled={!transcript}
                                className="p-2 hover:bg-white dark:hover:bg-black rounded-lg text-muted-foreground hover:text-foreground transition-all flex items-center gap-2"
                                title="Download Text"
                            >
                                <FileText className="w-4 h-4" />
                            </button>
                            <button
                                onClick={() => handleExport('srt')}
                                disabled={!transcript}
                                className="p-2 hover:bg-white dark:hover:bg-black rounded-lg text-muted-foreground hover:text-foreground transition-all flex items-center gap-2"
                                title="Download SRT"
                            >
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="w-[1px] h-6 bg-border mx-1" />
                        <button
                            onClick={() => setShowTimestamps(!showTimestamps)}
                            className="p-2 rounded-xl hover:bg-accent transition-all text-muted-foreground"
                            title="Toggle Timestamps"
                        >
                            {showTimestamps ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5" />}
                        </button>
                    </div>
                </div>

                {/* Search / Context Bar (⌘K style) */}
                <div className="relative group mb-4">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground group-focus-within:text-foreground transition-colors" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search transcript..."
                        className="w-full bg-accent/30 border border-border rounded-2xl pl-12 pr-4 py-3 text-sm font-medium outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                    />
                </div>
            </div>

            {/* List Content */}
            <div className="flex-1 overflow-hidden relative">
                <div
                    ref={containerRef}
                    className="h-full overflow-y-auto px-6 py-4 space-y-2 custom-scrollbar"
                >
                    {isLoading && !transcript ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                            <Loader2 className="w-10 h-10 animate-spin text-primary mb-6" />
                            <h3 className="text-lg font-bold mb-2">Analyzing audio...</h3>
                            <p className="text-sm text-muted-foreground max-w-[240px]">
                                Generating your transcript with high accuracy AI models.
                            </p>
                        </div>
                    ) : filteredSegments.length === 0 && transcript ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
                            <Search className="w-12 h-12 mb-4 opacity-20" />
                            <p className="text-sm font-bold">No matches found</p>
                        </div>
                    ) : (
                        filteredSegments.map((segment) => (
                            <div
                                key={segment.id}
                                ref={segment.id === activeSegmentId ? activeRef : null}
                                onClick={() => onSegmentClick(segment.start_time)}
                                className={cn(
                                    "group relative p-5 rounded-3xl border transition-all duration-300 cursor-pointer",
                                    segment.id === activeSegmentId
                                        ? "bg-white dark:bg-accent/20 border-border shadow-md ring-1 ring-primary/5"
                                        : "bg-transparent border-transparent hover:bg-accent/10"
                                )}
                            >
                                {/* Left Accent Bar */}
                                {segment.id === activeSegmentId && (
                                    <div className="absolute left-1.5 top-5 bottom-5 w-1 bg-primary rounded-full" />
                                )}

                                <div className="flex gap-4 items-start">
                                    {showTimestamps && (
                                        <div className={cn(
                                            "flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-mono font-bold transition-all",
                                            segment.id === activeSegmentId
                                                ? "bg-primary text-primary-foreground"
                                                : "bg-accent/50 text-muted-foreground group-hover:bg-accent"
                                        )}>
                                            <Clock className="w-3 h-3" />
                                            {formatTime(segment.start_time)}
                                        </div>
                                    )}
                                    <div className="flex-1">
                                        <p className={cn(
                                            "text-sm leading-relaxed font-medium transition-colors",
                                            segment.id === activeSegmentId
                                                ? "text-foreground"
                                                : "text-muted-foreground group-hover:text-foreground"
                                        )}>
                                            {highlightText(segment.text)}
                                        </p>
                                    </div>
                                </div>

                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}

export default TranscriptPanel;
