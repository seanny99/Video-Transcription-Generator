import { useEffect, useRef } from 'react';
import { api } from '../services/api';
import { TranscriptData } from '../types';

export function useTranscriptPoller(
    transcript: TranscriptData | null,
    onUpdate: (updated: TranscriptData) => void,
    onDelete: (mediaId: number) => void
) {
    const pollInterval = useRef<NodeJS.Timeout | null>(null);

    useEffect(() => {
        // Only poll if we have a transcript that is pending or processing
        if (!transcript || (transcript.status !== 'pending' && transcript.status !== 'processing')) {
            return;
        }

        const poll = async () => {
            try {
                // Use getTranscriptStatus (lighter weight) or getTranscript (full data)
                // We likely need full data eventually, but status check is faster.
                // Let's fetch full data if status changed, or just fetch full data to be simple.
                const updated = await api.getTranscript(transcript.id);

                if (updated.status !== transcript.status || updated.segments.length !== (transcript.segments?.length || 0)) {
                    onUpdate(updated as TranscriptData);
                }
            } catch (err: any) {
                // Handle 404 (Deleted)
                if (err.message && (err.message.includes('404') || err.message.toLowerCase().includes('not found'))) {
                    onDelete(transcript.media_id);
                }
            }
        };

        // Poll every 2 seconds
        pollInterval.current = setInterval(poll, 2000);

        return () => {
            if (pollInterval.current) {
                clearInterval(pollInterval.current);
            }
        };
    }, [transcript?.id, transcript?.status]); // Re-create if status changes (e.g. to completed, which stops polling)
}
