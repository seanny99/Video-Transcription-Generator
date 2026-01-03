/**
 * Media player component for video/audio playback.
 */

import React, { useRef, useEffect, useCallback } from 'react';
import { MediaData } from '../types';

interface MediaPlayerProps {
    media: MediaData;
    currentTime: number;
    onTimeUpdate: (time: number) => void;
}

function MediaPlayer({ media, currentTime, onTimeUpdate }: MediaPlayerProps) {
    const mediaRef = useRef<HTMLVideoElement | HTMLAudioElement>(null);
    const isSeekingRef = useRef(false);

    const isVideo = media.media_type.startsWith('video');

    // Handle time updates from playback
    const handleTimeUpdate = useCallback(() => {
        if (mediaRef.current && !isSeekingRef.current) {
            onTimeUpdate(mediaRef.current.currentTime);
        }
    }, [onTimeUpdate]);

    // Seek to time when currentTime changes externally (e.g., from transcript click)
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
        <div className="media-player">
            {/* Title */}
            <div className="player-header">
                <h2 className="media-title">{media.title || media.original_filename}</h2>
                <span className="media-source badge">{media.source}</span>
            </div>

            {/* Player */}
            <div className="player-wrapper">
                {isVideo ? (
                    <video
                        ref={mediaRef as React.RefObject<HTMLVideoElement>}
                        src={media.streamUrl}
                        onTimeUpdate={handleTimeUpdate}
                        controls
                        className="video-element"
                    />
                ) : (
                    <div className="audio-container">
                        <div className="audio-visualizer">
                            <span className="audio-icon">🎵</span>
                        </div>
                        <audio
                            ref={mediaRef as React.RefObject<HTMLAudioElement>}
                            src={media.streamUrl}
                            onTimeUpdate={handleTimeUpdate}
                            controls
                            className="audio-element"
                        />
                    </div>
                )}
            </div>

            {/* Current Time Display */}
            <div className="player-info">
                <span className="current-time">{formatTime(currentTime)}</span>
            </div>
        </div>
    );
}

export default MediaPlayer;
