import React, { useRef, useEffect, useCallback } from 'react';
import { MediaData } from '../types';
import { Play, Pause, Volume2, Maximize, Music, Film } from 'lucide-react';

interface MediaPlayerProps {
    media: MediaData;
    currentTime: number;
    onTimeUpdate: (time: number) => void;
}

function MediaPlayer({ media, currentTime, onTimeUpdate }: MediaPlayerProps) {
    const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
    const isSeekingRef = useRef(false);

    const isVideo = media.media_type.startsWith('video');

    const handleTimeUpdate = useCallback(() => {
        if (mediaRef.current && !isSeekingRef.current) {
            onTimeUpdate(mediaRef.current.currentTime);
        }
    }, [onTimeUpdate]);

    useEffect(() => {
        if (mediaRef.current && Math.abs(mediaRef.current.currentTime - currentTime) > 0.5) {
            isSeekingRef.current = true;
            mediaRef.current.currentTime = currentTime;
            setTimeout(() => {
                isSeekingRef.current = false;
            }, 100);
        }
    }, [currentTime]);

    const formatTime = (seconds: number): string => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    return (
        <div className="w-full h-full flex flex-col items-center justify-center space-y-8 animate-in fade-in zoom-in-95 duration-500">
            {/* Backdrop / Glow Area */}
            <div className="relative w-full h-full max-h-[80vh] aspect-video bg-neutral-100 dark:bg-neutral-900 rounded-[2.5rem] overflow-hidden shadow-2xl border border-neutral-200 dark:border-neutral-800 flex items-center justify-center">

                {/* Visualizer Placeholder for Audio */}
                {!isVideo && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-neutral-50 to-neutral-200 dark:from-neutral-900 dark:to-black">
                        <div className="w-24 h-24 rounded-full bg-white dark:bg-neutral-800 shadow-xl flex items-center justify-center mb-6">
                            <Music className="w-8 h-8 text-neutral-400 animate-pulse" />
                        </div>
                        <div className="flex gap-1.5 h-8 items-end">
                            {[...Array(12)].map((_, i) => (
                                <div
                                    key={i}
                                    className="w-1.5 bg-black dark:bg-white rounded-full transition-all"
                                    style={{
                                        height: `${Math.random() * 100}%`,
                                        opacity: 0.3 + (Math.random() * 0.7)
                                    }}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {isVideo ? (
                    <video
                        ref={mediaRef as React.RefObject<HTMLVideoElement>}
                        src={media.streamUrl}
                        onTimeUpdate={handleTimeUpdate}
                        controls
                        className="w-full h-full object-contain bg-black"
                    />
                ) : (
                    <audio
                        ref={mediaRef as React.RefObject<HTMLAudioElement>}
                        src={media.streamUrl}
                        onTimeUpdate={handleTimeUpdate}
                        controls
                        className="absolute bottom-6 left-6 right-6 h-12 rounded-full opacity-60 hover:opacity-100 transition-opacity"
                    />
                )}

                {/* Info Overlay (Top) */}
                <div className="absolute top-6 left-8 right-8 flex items-center justify-between pointer-events-none">
                    <div className="flex flex-col space-y-1">
                        <div className="flex items-center gap-2">
                            {isVideo ? <Film className="w-3 h-3 text-neutral-400" /> : <Music className="w-3 h-3 text-neutral-400" />}
                            <span className="text-[10px] uppercase font-bold tracking-widest text-neutral-400 leading-none">
                                {media.source} Source
                            </span>
                        </div>
                        <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate max-w-xs transition-colors pointer-events-auto">
                            {media.title || media.original_filename}
                        </h2>
                    </div>

                    <div className="px-3 py-1.5 min-w-[3.5rem] flex items-center justify-center rounded-full bg-black/5 dark:bg-white/10 backdrop-blur-md border border-black/5 dark:border-white/10">
                        <span className="font-mono text-xs font-medium dark:text-neutral-300">
                            {formatTime(currentTime)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Secondary Controls / Info */}
            <div className="flex items-center gap-12 text-neutral-400">
                <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] mb-1">Status</span>
                    <span className="text-xs text-neutral-900 dark:text-neutral-100">Synchronized</span>
                </div>
                <div className="w-px h-8 bg-neutral-200 dark:bg-neutral-800" />
                <div className="flex flex-col items-center">
                    <span className="text-[10px] uppercase font-bold tracking-[0.2em] mb-1">Format</span>
                    <span className="text-xs text-neutral-900 dark:text-neutral-100">{media.media_type.split('/')[1].toUpperCase()}</span>
                </div>
            </div>
        </div>
    );
}

export default MediaPlayer;
