/**
 * Type definitions for the application.
 */

export interface TranscriptSegment {
    id: number;
    start_time: number;
    end_time: number;
    text: string;
}

export interface TranscriptData {
    id: number;
    media_id: number;
    status: 'pending' | 'processing' | 'completed' | 'failed';
    full_text: string | null;
    language: string;
    duration_seconds: number | null;
    segments: TranscriptSegment[];
    error_message: string | null;
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

export interface ApiError {
    detail: string;
}
