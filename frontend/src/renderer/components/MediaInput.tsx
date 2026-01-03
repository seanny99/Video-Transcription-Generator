/**
 * Media input component for YouTube URLs and file uploads.
 */

import React, { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { MediaData, TranscriptData } from '../types';

interface MediaInputProps {
    onMediaLoaded: (media: MediaData) => void;
    onTranscriptLoaded: (transcript: TranscriptData) => void;
    onError: (message: string) => void;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
}

function MediaInput({
    onMediaLoaded,
    onTranscriptLoaded,
    onError,
    isLoading,
    setIsLoading,
}: MediaInputProps) {
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);

    const pollTranscriptStatus = useCallback(async (mediaId: number) => {
        try {
            const transcript = await api.getTranscriptByMedia(mediaId);

            if (transcript.status === 'completed') {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
                setStatusMessage('');
                setIsLoading(false);
                onTranscriptLoaded(transcript as TranscriptData);
            } else if (transcript.status === 'failed') {
                if (pollIntervalRef.current) {
                    clearInterval(pollIntervalRef.current);
                    pollIntervalRef.current = null;
                }
                setStatusMessage('');
                setIsLoading(false);
                onError(transcript.error_message || 'Transcription failed');
            } else {
                setStatusMessage(`Transcribing... (${transcript.status})`);
            }
        } catch (err) {
            // Transcript might not exist yet, keep polling
            setStatusMessage('Waiting for transcription to start...');
        }
    }, [onTranscriptLoaded, onError, setIsLoading]);

    const handleYouTubeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!youtubeUrl.trim()) {
            onError('Please enter a YouTube URL');
            return;
        }

        setIsLoading(true);
        setStatusMessage('Fetching video info...');

        try {
            // Get video info first
            const info = await api.getYouTubeInfo(youtubeUrl);
            setStatusMessage(`Downloading: ${info.title}...`);

            // Download and start transcription
            const result = await api.downloadYouTube(youtubeUrl, true);

            // Create media data
            const media: MediaData = {
                id: result.media_id,
                filename: result.filename,
                original_filename: result.filename,
                media_type: 'video/mp4',
                source: 'youtube',
                title: result.title,
                streamUrl: api.getMediaStreamUrl(result.media_id),
            };

            onMediaLoaded(media);
            setStatusMessage('Transcribing audio...');

            // Start polling for transcript status
            pollIntervalRef.current = setInterval(() => {
                pollTranscriptStatus(result.media_id);
            }, 2000);

        } catch (err) {
            setStatusMessage('');
            setIsLoading(false);
            onError(err instanceof Error ? err.message : 'Failed to process YouTube URL');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setStatusMessage(`Uploading: ${file.name}...`);

        try {
            // Upload file
            const result = await api.uploadMedia(file);

            // Create media data
            const media: MediaData = {
                id: result.id,
                filename: result.filename,
                original_filename: result.original_filename,
                media_type: result.media_type,
                source: 'upload',
                title: result.original_filename,
                streamUrl: api.getMediaStreamUrl(result.id),
            };

            onMediaLoaded(media);
            setStatusMessage('Starting transcription...');

            // Start transcription
            await api.startTranscription(result.id);

            // Start polling for transcript status
            pollIntervalRef.current = setInterval(() => {
                pollTranscriptStatus(result.id);
            }, 2000);

        } catch (err) {
            setStatusMessage('');
            setIsLoading(false);
            onError(err instanceof Error ? err.message : 'Failed to upload file');
        }

        // Reset file input
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="media-input">
            {/* YouTube URL Input */}
            <form onSubmit={handleYouTubeSubmit} className="youtube-form">
                <div className="input-group">
                    <span className="input-icon">🎬</span>
                    <input
                        type="text"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="Paste YouTube URL here..."
                        className="url-input"
                        disabled={isLoading}
                    />
                    <button type="submit" className="btn btn-primary" disabled={isLoading}>
                        {isLoading ? 'Processing...' : 'Transcribe'}
                    </button>
                </div>
            </form>

            {/* Divider */}
            <div className="divider">
                <span>or</span>
            </div>

            {/* File Upload */}
            <div className="file-upload">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.mp4,.wav,.webm,.m4a,.mkv"
                    onChange={handleFileUpload}
                    className="file-input"
                    id="file-upload"
                    disabled={isLoading}
                />
                <label htmlFor="file-upload" className="file-label">
                    <span className="upload-icon">📁</span>
                    <span className="upload-text">
                        {isLoading ? 'Processing...' : 'Upload Video/Audio File'}
                    </span>
                    <span className="upload-hint">MP4, MP3, WAV, WebM, M4A, MKV</span>
                </label>
            </div>

            {/* Status Message */}
            {statusMessage && (
                <div className="status-message">
                    <span className="spinner"></span>
                    {statusMessage}
                </div>
            )}
        </div>
    );
}

export default MediaInput;
