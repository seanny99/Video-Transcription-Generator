import React, { useState, useRef, useCallback } from 'react';
import { api } from '../services/api';
import { MediaData, TranscriptData } from '../types';
import { Youtube, Upload, Loader2, Sparkles } from 'lucide-react';

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

    const handleYouTubeSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!youtubeUrl.trim()) {
            onError('Please enter a YouTube URL');
            return;
        }

        setIsLoading(true);
        setStatusMessage('Reading YouTube data...');

        try {
            const info = await api.getYouTubeInfo(youtubeUrl);
            setStatusMessage(`Downloading: ${info.title}...`);
            const result = await api.downloadYouTube(youtubeUrl, true);

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
            // Polling is now handled by the parent component via useTranscriptPoller

        } catch (err: any) {
            setStatusMessage('');
            setIsLoading(false);
            onError(err.message || 'Failed to process YouTube URL');
        }
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsLoading(true);
        setStatusMessage(`Uploading: ${file.name}...`);

        try {
            const result = await api.uploadMedia(file);
            const media: MediaData = {
                id: result.id,
                filename: result.filename,
                original_filename: result.original_filename,
                media_type: result.media_type,
                source: 'upload',
                title: result.original_filename,
                streamUrl: api.getMediaStreamUrl(result.id),
            };

            // Polling is now handled by the parent component via useTranscriptPoller

            onMediaLoaded(media);

        } catch (err: any) {
            setStatusMessage('');
            setIsLoading(false);
            onError(err.message || 'Failed to upload file');
        }

        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-6">
            {/* YouTube Section */}
            <form onSubmit={handleYouTubeSubmit} className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-neutral-400 group-focus-within:text-black dark:group-focus-within:text-white transition-colors">
                    <Youtube className="w-5 h-5" />
                </div>
                <input
                    type="text"
                    value={youtubeUrl}
                    onChange={(e) => setYoutubeUrl(e.target.value)}
                    placeholder="YouTube URL..."
                    className="w-full pl-12 pr-32 py-4 bg-neutral-100 dark:bg-neutral-800 border-none rounded-2xl focus:ring-2 focus:ring-black dark:focus:ring-white transition-all outline-none text-sm"
                    disabled={isLoading}
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="absolute right-2 inset-y-2 px-6 bg-black dark:bg-white text-white dark:text-black rounded-xl text-xs font-semibold hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                    {isLoading ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Transcribe'}
                </button>
            </form>

            <div className="relative flex items-center justify-center py-2">
                <div className="w-full border-t border-neutral-100 dark:border-neutral-800" />
                <span className="absolute bg-white dark:bg-neutral-900 px-4 text-[10px] font-bold uppercase tracking-widest text-neutral-400">or</span>
            </div>

            {/* File Upload Section */}
            <div className="relative group">
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".mp3,.mp4,.wav,.webm,.m4a,.mkv"
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload"
                    disabled={isLoading}
                />
                <label
                    htmlFor="file-upload"
                    className={`flex flex-col items-center justify-center p-8 border-2 border-dashed border-neutral-200 dark:border-neutral-800 rounded-2xl cursor-pointer hover:border-black dark:hover:border-white transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                    <div className="p-4 rounded-full bg-neutral-100 dark:bg-neutral-800 mb-4 group-hover:scale-110 transition-transform">
                        <Upload className="w-6 h-6 text-neutral-500" />
                    </div>
                    <span className="text-sm font-medium">Local Video or Audio</span>
                    <span className="text-xs text-neutral-400 mt-1 uppercase tracking-tighter">MP4, MP3, MKV, WAV</span>
                </label>
            </div>

            {/* AI Status Banner */}
            {statusMessage && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-neutral-50 dark:bg-neutral-800/50 border border-neutral-100 dark:border-neutral-800 animate-in slide-in-from-bottom-2 duration-300">
                    <Loader2 className="w-4 h-4 text-neutral-400 animate-spin" />
                    <span className="text-sm font-medium text-neutral-600 dark:text-neutral-300 tracking-tight">
                        {statusMessage}
                    </span>
                    <Sparkles className="w-3 h-3 text-emerald-500 animate-pulse ml-auto" />
                </div>
            )}
        </div>
    );
}

export default MediaInput;
