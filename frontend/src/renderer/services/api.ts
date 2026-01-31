import { MediaData, TranscriptData, YouTubeInfo, TranscriptionStatus, ApiError } from '../types';

const getApiBase = () => {
    const params = new URLSearchParams(window.location.search);
    console.log(`[API Config] Raw Search: "${window.location.search}"`);
    const port = params.get('port') || '55666';
    const base = `http://127.0.0.1:${port}/api`;
    console.log(`[API Config] Constructed Base: ${base}`);
    return base;
};

const API_BASE = getApiBase();

class ApiClient {
    private baseUrl: string;

    constructor(baseUrl: string = API_BASE) {
        this.baseUrl = baseUrl;
    }

    async request<T>(
        endpoint: string,
        options: RequestInit = {}
    ): Promise<T> {
        const url = `${this.baseUrl}${endpoint}`;
        console.log(`[API Request] ${url}`, options);

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    'Content-Type': 'application/json',
                    ...options.headers,
                },
            });

            if (!response.ok) {
                const error = await response.json().catch(() => ({ detail: 'Unknown error' }));
                console.error(`[API Error Response] ${url}: ${response.status}`, error);
                throw new ApiError(
                    error.detail || `Request failed: ${response.status}`,
                    error.detail,
                    error.type
                );
            }

            return response.json();
        } catch (err) {
            console.error(`[API Network/Fetch Error] ${url}:`, err);
            throw err;
        }
    }

    // YouTube endpoints
    async getYouTubeInfo(url: string): Promise<YouTubeInfo> {
        return this.request<YouTubeInfo>('/youtube/info', {
            method: 'POST',
            body: JSON.stringify({ url }),
        });
    }

    async downloadYouTube(url: string, autoTranscribe: boolean = true) {
        return this.request<{
            media_id: number;
            transcript_id: number | null;
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
            throw new ApiError(error.detail, error.detail, error.type);
        }

        return response.json();
    }

    async getMedia(mediaId: number): Promise<MediaData> {
        const data = await this.request<any>(`/media/${mediaId}`);
        return {
            ...data,
            streamUrl: this.getMediaStreamUrl(mediaId)
        };
    }

    getMediaStreamUrl(mediaId: number): string {
        return `${this.baseUrl}/media/${mediaId}/stream`;
    }

    async getTranscriptByMedia(mediaId: number): Promise<TranscriptData> {
        return this.request<TranscriptData>(`/transcripts/media/${mediaId}`);
    }

    async startTranscription(mediaId: number) {
        return this.request<{
            transcript_id: number;
            status: TranscriptionStatus;
        }>(`/transcripts/media/${mediaId}/transcribe`, {
            method: 'POST',
        });
    }

    async deleteMedia(mediaId: number) {
        return this.request<{ message: string }>(`/media/${mediaId}`, {
            method: 'DELETE',
        });
    }

    // System endpoints
    async getSystemSpecs() {
        return this.request<{
            cpu: string;
            gpu: string;
            os: string;
            arch: string;
            ram: number;
            vram: number;
            cores: number;
            threads: number;
        }>('/system/specs');
    }

    async getConfig() {
        return this.request<{
            whisper_model: string;
        }>('/system/config');
    }

    async updateConfig(config: { whisper_model: string }) {
        return this.request<{
            status: string;
            message: string;
        }>('/system/config', {
            method: 'POST',
            body: JSON.stringify(config),
        });
    }

    async checkHealth() {
        return this.request<{ status: string; queue_size: number }>('/health');
    }

    /**
     * Wait for backend to become ready with retries.
     */
    async waitForBackend(maxRetries = 10, interval = 1000): Promise<boolean> {
        for (let i = 0; i < maxRetries; i++) {
            try {
                const health = await this.checkHealth();
                if (health.status === 'healthy') {
                    console.log('Backend connection established');
                    return true;
                }
            } catch (e) {
                console.log(`Waiting for backend... attempt ${i + 1}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, interval));
            }
        }
        return false;
    }
}

export const api = new ApiClient();
export default api;
