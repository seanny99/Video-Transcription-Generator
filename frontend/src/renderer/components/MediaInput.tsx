import React, { useState, useRef } from 'react';
import { api } from '../services/api';
import { MediaData, TranscriptData } from '../types';
import { Youtube, Upload, Loader2, Sparkles, X, FileText, CheckCircle2, ChevronRight } from 'lucide-react';
import { cn } from '../utils'; // Reusing the cn utility

interface MediaInputProps {
    droppedFile?: File | null;
    onMediaLoaded: (media: MediaData) => void;
    onTranscriptLoaded: (transcript: TranscriptData) => void;
    onError: (message: string) => void;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    currentModel: string;
    onModelChange: (model: string) => void;
}

function MediaInput({
    droppedFile,
    onMediaLoaded,
    onTranscriptLoaded,
    onError,
    isLoading,
    setIsLoading,
    currentModel,
    onModelChange,
}: MediaInputProps) {
    const [activeTab, setActiveTab] = useState<'upload' | 'youtube'>('upload');
    const [youtubeUrl, setYoutubeUrl] = useState('');
    const [statusMessage, setStatusMessage] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    React.useEffect(() => {
        if (droppedFile) {
            setSelectedFile(droppedFile);
            setActiveTab('upload');
        }
    }, [droppedFile]);
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
        } catch (err: any) {
            setStatusMessage('');
            setIsLoading(false);
            onError(err.message || 'Failed to process YouTube URL');
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
    };

    const handleFileUpload = async () => {
        if (!selectedFile) return;

        setIsLoading(true);
        setStatusMessage(`Uploading: ${selectedFile.name}...`);

        try {
            const result = await api.uploadMedia(selectedFile);
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
        } catch (err: any) {
            setStatusMessage('');
            setIsLoading(false);
            onError(err.message || 'Failed to upload file');
        }
    };

    return (
        <div className="space-y-8">
            {/* Tabs */}
            <div className="flex p-1 bg-accent/50 rounded-2xl w-full">
                <button
                    onClick={() => setActiveTab('upload')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                        activeTab === 'upload' ? "bg-white dark:bg-primary shadow-sm text-foreground dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Upload className="w-4 h-4" />
                    Upload File
                </button>
                <button
                    onClick={() => setActiveTab('youtube')}
                    className={cn(
                        "flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all",
                        activeTab === 'youtube' ? "bg-white dark:bg-primary shadow-sm text-foreground dark:text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                    )}
                >
                    <Youtube className="w-4 h-4" />
                    YouTube Link
                </button>
            </div>

            {/* Tab Content */}
            <div className="min-h-[240px] flex flex-col">
                {activeTab === 'upload' ? (
                    <div className="flex-1 flex flex-col items-stretch space-y-4">
                        {!selectedFile ? (
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="flex-1 flex flex-col items-center justify-center border-2 border-dashed border-border rounded-3xl hover:border-primary/50 hover:bg-accent/30 transition-all cursor-pointer group p-8"
                            >
                                <div className="w-16 h-16 bg-accent rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <Upload className="w-8 h-8 text-muted-foreground" />
                                </div>
                                <p className="text-lg font-bold text-foreground">Drop audio/video here</p>
                                <p className="text-sm text-muted-foreground">or browse files</p>
                                <p className="mt-4 text-[10px] text-muted-foreground uppercase tracking-widest font-bold">
                                    MP4, MP3, MKV, WAV • Up to 2GB
                                </p>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".mp3,.mp4,.wav,.webm,.m4a,.mkv"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />
                            </div>
                        ) : (
                            <div className="flex-1 flex flex-col items-center justify-center bg-accent/30 border border-border rounded-3xl p-8 relative overflow-hidden">
                                <button
                                    onClick={() => setSelectedFile(null)}
                                    className="absolute top-4 right-4 p-1 rounded-full hover:bg-white dark:hover:bg-primary transition-colors text-muted-foreground"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                                <FileText className="w-12 h-12 text-primary mb-4" />
                                <p className="text-lg font-bold text-foreground text-center truncate w-full px-4 mb-2">
                                    {selectedFile.name}
                                </p>
                                <div className="flex items-center gap-4 text-xs font-medium text-muted-foreground">
                                    <span>{(selectedFile.size / (1024 * 1024)).toFixed(1)} MB</span>
                                    <span>•</span>
                                    <span className="uppercase">{selectedFile.name.split('.').pop()}</span>
                                </div>

                                <button
                                    onClick={handleFileUpload}
                                    disabled={isLoading}
                                    className="mt-8 w-full h-12 bg-primary text-primary-foreground rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                                >
                                    <>
                                        <span>Start Transcription</span>
                                        <ChevronRight className="w-4 h-4" />
                                    </>
                                </button>
                            </div>
                        )}
                    </div>
                ) : (
                    <form onSubmit={handleYouTubeSubmit} className="flex-1 flex flex-col space-y-4">
                        <div className="relative flex-1">
                            <div className="absolute top-5 left-5 text-muted-foreground">
                                <Youtube className="w-6 h-6" />
                            </div>
                            <textarea
                                value={youtubeUrl}
                                onChange={(e) => setYoutubeUrl(e.target.value)}
                                placeholder="Paste YouTube video link here..."
                                className="w-full h-full min-h-[160px] pl-16 pr-6 pt-5 bg-accent/30 border border-border rounded-3xl outline-none focus:ring-2 focus:ring-primary/20 transition-all text-lg font-medium resize-none"
                            />
                        </div>
                        <div className="text-xs text-muted-foreground flex items-center gap-2 px-2">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Public videos supported</span>
                        </div>
                        <button
                            type="submit"
                            disabled={isLoading || !youtubeUrl.trim()}
                            className="h-14 bg-primary text-primary-foreground rounded-2xl font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-50"
                        >
                            <>
                                <span>Transcribe Video</span>
                                <ChevronRight className="w-4 h-4" />
                            </>
                        </button>
                    </form>
                )}
            </div>


            {/* Status Message */}
            {
                statusMessage && (
                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary shadow-lg text-primary-foreground animate-in slide-in-from-bottom-2 duration-300">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span className="text-sm font-bold">
                            {statusMessage}
                        </span>
                        <Sparkles className="w-3 h-3 animate-pulse ml-auto" />
                    </div>
                )
            }
        </div >
    );
}

export default MediaInput;
