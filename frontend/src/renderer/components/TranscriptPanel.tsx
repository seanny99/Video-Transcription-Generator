/**
 * Transcript panel with synchronized highlighting.
 */

import React, { useEffect, useRef } from 'react';
import { TranscriptData, TranscriptSegment } from '../types';

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

    // Auto-scroll to active segment
    useEffect(() => {
        if (activeRef.current && containerRef.current) {
            const container = containerRef.current;
            const active = activeRef.current;

            const containerRect = container.getBoundingClientRect();
            const activeRect = active.getBoundingClientRect();

            // Check if active segment is out of view
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

    // Loading state
    if (isLoading && !transcript) {
        return (
            <div className="transcript-panel">
                <div className="transcript-header">
                    <h3>Transcript</h3>
                </div>
                <div className="transcript-loading">
                    <span className="spinner large"></span>
                    <p>Generating transcript...</p>
                    <p className="loading-hint">This may take a few minutes for longer videos</p>
                </div>
            </div>
        );
    }

    // No transcript yet
    if (!transcript) {
        return (
            <div className="transcript-panel">
                <div className="transcript-header">
                    <h3>Transcript</h3>
                </div>
                <div className="transcript-empty">
                    <p>Transcript will appear here once processing is complete.</p>
                </div>
            </div>
        );
    }

    // Processing state
    if (transcript.status === 'processing' || transcript.status === 'pending') {
        return (
            <div className="transcript-panel">
                <div className="transcript-header">
                    <h3>Transcript</h3>
                    <span className="badge badge-processing">{transcript.status}</span>
                </div>
                <div className="transcript-loading">
                    <span className="spinner large"></span>
                    <p>Processing transcript...</p>
                </div>
            </div>
        );
    }

    // Failed state
    if (transcript.status === 'failed') {
        return (
            <div className="transcript-panel">
                <div className="transcript-header">
                    <h3>Transcript</h3>
                    <span className="badge badge-error">Failed</span>
                </div>
                <div className="transcript-error">
                    <span className="error-icon">❌</span>
                    <p>{transcript.error_message || 'Transcription failed'}</p>
                </div>
            </div>
        );
    }

    // Completed - show segments
    return (
        <div className="transcript-panel">
            <div className="transcript-header">
                <h3>Transcript</h3>
                <span className="badge badge-success">Complete</span>
            </div>

            <div className="transcript-content" ref={containerRef}>
                {transcript.segments.map((segment) => (
                    <div
                        key={segment.id}
                        ref={segment.id === activeSegmentId ? activeRef : null}
                        className={`segment ${segment.id === activeSegmentId ? 'active' : ''}`}
                        onClick={() => onSegmentClick(segment.start_time)}
                    >
                        <span className="segment-time">
                            {formatTime(segment.start_time)}
                        </span>
                        <span className="segment-text">{segment.text}</span>
                    </div>
                ))}
            </div>

            {/* Full text toggle could go here */}
        </div>
    );
}

export default TranscriptPanel;
