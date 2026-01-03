/**
 * API client for backend communication.
 */

const API_BASE = 'http://127.0.0.1:8081/api';

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE) {
        this.baseUrl = baseUrl;
    }

    private async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;

        const response = await fetch(url, {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers,
            },
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
            throw new Error(error.detail || `Request failed: ${response.status}`);
        }

        return response.json();
    }

    // YouTube endpoints
    async getYouTubeInfo(url: string) {
        return this.request<{
            id: string;
            title: string;
            duration: number;
            thumbnail: string;
            uploader: string;
        }>('/youtube/info', {
            method: 'POST',
            body: JSON.stringify({ url }),
        });
    }

    async downloadYouTube(url: string, autoTranscribe: boolean = true) {
        return this.request<{
            media_id: number;
            title: string;
            filename: string;
            transcription_started: boolean;
        }>('/youtube/download', {
            method: 'POST',
            body: JSON.stringify({ url, auto_transcribe: autoTranscribe }),
        });
    }

    // Media endpoints
    async uploadMedia(file: File): Promise<{
        id: number;
        filename: string;
        original_filename: string;
        media_type: string;
    }> {
        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseUrl}/media/upload`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const error = await response.json().catch(() => ({ detail: 'Upload failed' }));
            throw new Error(error.detail);
        }

        return response.json();
    }

    async getMedia(mediaId: number) {
        return this.request<{
            id: number;
            filename: string;
            original_filename: string;
            media_type: string;
            source: string;
            title: string | null;
        }>(`/media/${mediaId}`);
    }

    getMediaStreamUrl(mediaId: number): string {
        return `${this.baseUrl}/media/${mediaId}/stream`;
    }

    // Transcript endpoints
    async getTranscript(transcriptId: number) {
        return this.request<{
            id: number;
            media_id: number;
            status: string;
            full_text: string | null;
            segments: Array<{
                id: number;
                start_time: number;
                end_time: number;
                text: string;
            }>;
            error_message: string | null;
        }>(`/transcripts/${transcriptId}`);
    }

    async getTranscriptByMedia(mediaId: number) {
        return this.request<{
            id: number;
            media_id: number;
            status: string;
            full_text: string | null;
            language: string;
            duration_seconds: number | null;
            segments: Array<{
                id: number;
                start_time: number;
                end_time: number;
                text: string;
            }>;
            error_message: string | null;
        }>(`/transcripts/media/${mediaId}`);
    }

    async getTranscriptStatus(transcriptId: number) {
        return this.request<{
            id: number;
            status: string;
            error_message: string | null;
        }>(`/transcripts/${transcriptId}/status`);
    }

    async startTranscription(mediaId: number) {
        return this.request<{
            transcript_id: number;
            status: string;
        }>(`/transcripts/media/${mediaId}/transcribe`, {
            method: 'POST',
        });
    }
}

export const api = new ApiClient();
export default api;
