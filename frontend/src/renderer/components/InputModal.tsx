import React from 'react';
import { X, AlertCircle } from 'lucide-react';
import MediaInput from './MediaInput';
import { MediaData, TranscriptData } from '../types';

interface InputModalProps {
    isOpen: boolean;
    onClose: () => void;
    droppedFile: File | null;
    onMediaLoaded: (media: MediaData) => void;
    onTranscriptLoaded: (transcript: TranscriptData) => void;
    onError: (message: string) => void;
    isLoading: boolean;
    setIsLoading: (loading: boolean) => void;
    currentModel: string;
    onModelChange: (model: string) => void;
    error: string | null;
}

export const InputModal: React.FC<InputModalProps> = ({
    isOpen,
    onClose,
    droppedFile,
    onMediaLoaded,
    onTranscriptLoaded,
    onError,
    isLoading,
    setIsLoading,
    currentModel,
    onModelChange,
    error
}) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4 animate-in fade-in duration-300">
            <div className="w-full max-w-xl bg-background border border-border rounded-3xl shadow-2xl p-10 relative overflow-hidden">
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                    <X className="w-5 h-5" />
                </button>

                <div className="mb-8">
                    <h2 className="text-3xl font-bold mb-2">New transcription</h2>
                    <p className="text-muted-foreground">Choose an input method to begin.</p>
                </div>

                <MediaInput
                    droppedFile={droppedFile}
                    onMediaLoaded={onMediaLoaded}
                    onTranscriptLoaded={onTranscriptLoaded}
                    onError={onError}
                    isLoading={isLoading}
                    setIsLoading={setIsLoading}
                    currentModel={currentModel}
                    onModelChange={onModelChange}
                />

                {error && (
                    <div className="mt-6 p-4 rounded-2xl bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/30 text-red-600 dark:text-red-400 text-sm flex items-start gap-3">
                        <AlertCircle className="w-5 h-5 mt-0.5" />
                        <span>{error}</span>
                    </div>
                )}
            </div>
        </div>
    );
};
