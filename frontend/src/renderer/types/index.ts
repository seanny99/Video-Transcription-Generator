/**
 * Type definitions for the application.
 */

export interface TranscriptSegment {
    id: number;
    start_time: number;
    end_time: number;
    text: string;
}

export enum TranscriptionStatus {
    Pending = 'pending',
    Processing = 'processing',
    Downloading = 'downloading',
    Completed = 'completed',
    Failed = 'failed',
    Canceled = 'canceled',
}

export interface TranscriptData {
    id: number;
    media_id: number;
    status: TranscriptionStatus;
    full_text: string | null;
    language: string;
    duration_seconds: number | null;
    segments: TranscriptSegment[];
    error_message: string | null;
    total_chunks?: number | null;
    last_processed_chunk?: number | null;
    estimated_seconds?: number | null;
    download_progress?: number | null;
}

export interface MediaData {
    id: number;
    filename: string;
    original_filename: string;
    media_type: string;
    source: 'upload' | 'youtube';
    title: string | null;
    streamUrl: string;
}

export interface YouTubeInfo {
    id: string;
    title: string;
    duration: number;
    thumbnail: string;
    uploader: string;
}

export class ApiError extends Error {
    detail: string;
    type?: string;

    constructor(message: string, detail?: string, type?: string) {
        super(message);
        this.name = 'ApiError';
        this.detail = detail || message;
        this.type = type;
    }
}
