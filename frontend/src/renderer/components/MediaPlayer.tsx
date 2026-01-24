import React, { useRef, useEffect, useCallback } from 'react';
import { MediaData } from '../types';
import { Music, CheckCircle2, FileVideo, Loader2 } from 'lucide-react';
import { cn } from '../utils';

interface MediaPlayerProps {
    media: MediaData;
    currentTime: number;
    onTimeUpdate: (time: number) => void;
    transcript: TranscriptData | null;
    onToast?: (message: string, type: 'success' | 'info' | 'error') => void;
}

function MediaPlayer({ media, currentTime, onTimeUpdate, transcript, onToast }: MediaPlayerProps) {
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
        <div className="w-full h-full flex flex-col space-y-6">
            {/* Header / Title */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
                        <FileVideo className="w-5 h-5 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-xl font-bold tracking-tight truncate max-w-xl">
                            {media.title || media.original_filename}
                        </h2>
                        <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground uppercase opacity-60">
                            <span>{media.media_type.split('/')[1]}</span>
                            {transcript?.duration_seconds ? (
                                <>
                                    <span>•</span>
                                    <span>{formatTime(transcript.duration_seconds)}</span>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>

            {/* Player Center Wrapper */}
            <div className="flex-1 flex items-center justify-center min-h-0 w-full overflow-hidden">
                <div className="relative w-full aspect-video max-h-full bg-black rounded-[32px] border border-border shadow-2xl overflow-hidden group mx-auto">
                    {!isVideo && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-accent/20 to-accent/5">
                            <div className="w-32 h-32 rounded-[2.5rem] bg-white dark:bg-neutral-900 shadow-2xl flex items-center justify-center mb-8 border border-border">
                                <Music className="w-12 h-12 text-primary" />
                            </div>
                            <div className="flex gap-2 h-12 items-end">
                                {[...Array(16)].map((_, i) => (
                                    <div
                                        key={i}
                                        className="w-2 bg-primary/20 dark:bg-primary/40 rounded-full transition-all animate-pulse"
                                        style={{
                                            height: `${Math.random() * 80 + 20}%`,
                                            animationDelay: `${i * 0.1}s`
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
                            className="w-full h-full object-contain"
                        />
                    ) : (
                        <audio
                            ref={mediaRef as React.RefObject<HTMLAudioElement>}
                            src={media.streamUrl}
                            onTimeUpdate={handleTimeUpdate}
                            controls
                            className="absolute bottom-8 left-8 right-8 h-14 rounded-2xl opacity-80 hover:opacity-100 transition-all shadow-2xl"
                        />
                    )}
                </div>
            </div>

        </div>
    );
}

export default MediaPlayer;
