/**
 * Main application component.
 * Orchestrates media input, player, and transcript panel.
 */

import React, { useState, useCallback } from 'react';
import MediaInput from './components/MediaInput';
import MediaPlayer from './components/MediaPlayer';
import TranscriptPanel from './components/TranscriptPanel';
import { useTranscriptSync } from './hooks/useTranscriptSync';
import { TranscriptData, MediaData } from './types';

function App() {
    const [media, setMedia] = useState<MediaData | null>(null);
    const [transcript, setTranscript] = useState<TranscriptData | null>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const {
        currentTime,
        activeSegmentId,
        handleTimeUpdate,
        handleSegmentClick,
    } = useTranscriptSync(transcript);

    const handleMediaLoaded = useCallback((mediaData: MediaData) => {
        setMedia(mediaData);
        setTranscript(null);
        setError(null);
    }, []);

    const handleTranscriptLoaded = useCallback((transcriptData: TranscriptData) => {
        setTranscript(transcriptData);
    }, []);

    const handleError = useCallback((message: string) => {
        setError(message);
        setIsLoading(false);
    }, []);

    return (
        <div className="app">
            <header className="app-header">
                <h1 className="app-title">
                    <span className="title-icon">🎬</span>
                    Video Transcription Generator
                </h1>
            </header>

            <main className="app-main">
                {/* Input Section */}
                <section className="input-section">
                    <MediaInput
                        onMediaLoaded={handleMediaLoaded}
                        onTranscriptLoaded={handleTranscriptLoaded}
                        onError={handleError}
                        isLoading={isLoading}
                        setIsLoading={setIsLoading}
                    />
                    {error && (
                        <div className="error-message">
                            <span className="error-icon">⚠️</span>
                            {error}
                        </div>
                    )}
                </section>

                {/* Content Section - Player + Transcript */}
                {media && (
                    <section className="content-section">
                        <div className="player-container">
                            <MediaPlayer
                                media={media}
                                currentTime={currentTime}
                                onTimeUpdate={handleTimeUpdate}
                            />
                        </div>

                        <div className="transcript-container">
                            <TranscriptPanel
                                transcript={transcript}
                                activeSegmentId={activeSegmentId}
                                onSegmentClick={handleSegmentClick}
                                isLoading={isLoading}
                            />
                        </div>
                    </section>
                )}

                {/* Empty State */}
                {!media && !isLoading && (
                    <section className="empty-state">
                        <div className="empty-state-content">
                            <span className="empty-icon">📝</span>
                            <h2>Get Started</h2>
                            <p>Enter a YouTube URL or upload a video/audio file to generate a transcript.</p>
                        </div>
                    </section>
                )}
            </main>
        </div>
    );
}

export default App;
