import React, { useEffect, useRef, useState, useMemo } from 'react';
import { TranscriptData } from '../types';
import { Search, Hash, MessageSquareText, FileText } from 'lucide-react';
import { cn } from './HistorySidebar';

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

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const [searchQuery, setSearchQuery] = useState('');

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
                <mark className="bg-yellow-200 dark:bg-yellow-800 text-inherit rounded px-0.5">
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
            content = transcript.full_text || transcript.segments.map(s => s.text).join(' ');
        } else {
            // Generate SRT
            content = transcript.segments.map((seg, i) => {
                const start = formatSrtTime(seg.start_time);
                const end = formatSrtTime(seg.end_time);
                return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
            }).join('\n');
        }

        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `transcript.${format}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const formatSrtTime = (seconds: number): string => {
        const date = new Date(0);
        date.setSeconds(seconds);
        const iso = date.toISOString().substr(11, 8);
        const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
        return `${iso},${ms}`;
    };

    return (
        <div className="h-full flex flex-col bg-white dark:bg-black transition-colors duration-300">
            {/* Panel Header */}
            <div className="p-6 pb-4 border-b border-neutral-100 dark:border-neutral-900">
                <div className="flex items-center gap-4 mb-4">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800">
                            <MessageSquareText className="w-5 h-5 text-neutral-600 dark:text-neutral-400" />
                        </div>
                        <h2 className="text-lg font-semibold tracking-tight">Transcript</h2>
                    </div>
                    {transcript && (
                        <div className="px-2.5 h-6 flex items-center justify-center rounded-full bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-900/30">
                            <span className="text-[0.6rem] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 pt-px">
                                {transcript.status}
                            </span>
                        </div>
                    )}
                </div>

                {/* Search / Context Bar */}
                <div className="relative group mb-2">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400 transition-colors group-focus-within:text-black dark:group-focus-within:text-white" />
                    <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search transcript..."
                        className="w-full bg-neutral-50 dark:bg-neutral-900/50 border border-neutral-100 dark:border-neutral-800 rounded-xl pl-10 pr-4 py-2.5 text-sm outline-none focus:ring-1 focus:ring-black dark:focus:ring-white transition-all"
                    />
                </div>

                {/* Export Button */}
                {transcript && (
                    <div className="flex gap-2">
                        <button
                            onClick={() => handleExport('txt')}
                            className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-neutral-600 dark:text-neutral-400"
                            title="Export as Text"
                        >
                            <FileText className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => handleExport('srt')}
                            className="p-2 rounded-lg bg-neutral-100 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors text-neutral-600 dark:text-neutral-400 font-mono text-[0.65rem] font-bold flex items-center"
                            title="Export as SRT"
                        >
                            SRT
                        </button>
                    </div>
                )}
            </div>

            {/* Main Content Area */}
            <div className="flex-1 overflow-hidden relative">
                <div
                    ref={containerRef}
                    className="h-full overflow-y-auto px-6 py-4 space-y-1 scroll-smooth custom-scrollbar"
                >
                    {isLoading && !transcript ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center">
                            <div className="w-12 h-12 border-4 border-neutral-100 dark:border-neutral-800 border-t-emerald-500 rounded-full animate-spin mb-6" />
                            <h3 className="text-sm font-semibold mb-2">Transcribing...</h3>
                            <p className="text-xs text-neutral-500 max-w-[200px] leading-relaxed">
                                Analyzing audio and generating text. Segments will appear here automatically.
                            </p>
                        </div>
                    ) : (transcript?.status === 'processing' || transcript?.status === 'pending') && (!transcript.segments || transcript.segments.length === 0) ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center text-neutral-400">
                            <div className="w-12 h-12 border-4 border-neutral-100 dark:border-neutral-800 border-t-emerald-500 rounded-full animate-spin mb-6" />
                            <h3 className="text-sm font-semibold mb-2">Transcribing...</h3>
                            <p className="text-xs text-neutral-500 max-w-[200px] leading-relaxed">
                                Analyzing audio and generating text. Segments will appear here automatically.
                            </p>
                        </div>
                    ) : !transcript ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center text-neutral-400">
                            <FileText className="w-10 h-10 mb-4 opacity-20" />
                            <p className="text-sm font-medium">Ready to process</p>
                            <p className="text-xs mt-1">Segments will appear here synchronized with playback.</p>
                        </div>
                    ) : filteredSegments.length === 0 ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 text-center text-neutral-400">
                            <Search className="w-10 h-10 mb-4 opacity-20" />
                            <p className="text-sm font-medium">No matches found</p>
                            <p className="text-xs mt-1">Try a different search term.</p>
                        </div>
                    ) : (
                        filteredSegments.map((segment) => (
                            <div
                                key={segment.id}
                                ref={segment.id === activeSegmentId ? activeRef : null}
                                onClick={() => onSegmentClick(segment.start_time)}
                                className={cn(
                                    "group relative p-4 rounded-xl cursor-pointer transition-all duration-300",
                                    segment.id !== activeSegmentId && "hover:bg-neutral-50 dark:hover:bg-neutral-900",
                                    segment.id === activeSegmentId
                                        ? "bg-black !text-white dark:bg-white dark:!text-black shadow-lg shadow-black/10 scale-[1.02] z-10"
                                        : "text-neutral-600 dark:text-neutral-400"
                                )}
                            >
                                <div className="flex gap-4 items-start">
                                    <span className={cn(
                                        "font-mono text-[0.65rem] font-bold mt-1 min-w-[2.5rem]",
                                        segment.id === activeSegmentId
                                            ? "!text-neutral-400"
                                            : "text-neutral-300 dark:text-neutral-700"
                                    )}>
                                        {formatTime(segment.start_time)}
                                    </span>
                                    <p className={cn(
                                        "text-sm leading-relaxed font-normal transition-colors",
                                        segment.id === activeSegmentId ? "!text-white dark:!text-black" : ""
                                    )}>
                                        {highlightText(segment.text)}
                                    </p>
                                </div>

                                {segment.id === activeSegmentId && (
                                    <div
                                        className="absolute left-1 top-4 bottom-4 w-1 bg-white dark:bg-black rounded-full"
                                    />
                                )}
                            </div>
                        ))
                    )}
                </div>

                {/* Bottom Fade Gradient */}
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-white dark:from-black to-transparent pointer-events-none" />
            </div>
        </div >
    );
}

export default TranscriptPanel;
