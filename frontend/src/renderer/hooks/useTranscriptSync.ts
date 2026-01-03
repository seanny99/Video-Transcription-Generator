/**
 * Hook for synchronizing transcript with media playback.
 */

import { useState, useCallback, useMemo } from 'react';
import { TranscriptData } from '../types';

interface UseTranscriptSyncResult {
    currentTime: number;
    activeSegmentId: number | null;
    handleTimeUpdate: (time: number) => void;
    handleSegmentClick: (time: number) => void;
}

export function useTranscriptSync(
    transcript: TranscriptData | null
): UseTranscriptSyncResult {
    const [currentTime, setCurrentTime] = useState(0);
    const [seekTime, setSeekTime] = useState<number | null>(null);

    // Find the active segment based on current time
    const activeSegmentId = useMemo(() => {
        if (!transcript || !transcript.segments.length) {
            return null;
        }

        // Binary search for efficiency with large transcripts
        const segments = transcript.segments;
        let left = 0;
        let right = segments.length - 1;
        let result: number | null = null;

        while (left <= right) {
            const mid = Math.floor((left + right) / 2);
            const segment = segments[mid];

            if (currentTime >= segment.start_time && currentTime < segment.end_time) {
                return segment.id;
            } else if (currentTime < segment.start_time) {
                right = mid - 1;
            } else {
                result = segment.id; // Keep track of last segment before current time
                left = mid + 1;
            }
        }

        // If we're past the last segment, highlight it
        if (result === null && segments.length > 0) {
            const lastSegment = segments[segments.length - 1];
            if (currentTime >= lastSegment.end_time) {
                return lastSegment.id;
            }
        }

        return result;
    }, [transcript, currentTime]);

    // Handle time updates from the media player
    const handleTimeUpdate = useCallback((time: number) => {
        setCurrentTime(time);
    }, []);

    // Handle segment click - seek to that time
    const handleSegmentClick = useCallback((time: number) => {
        setCurrentTime(time);
        setSeekTime(time);
    }, []);

    // Return seek time if there's a pending seek, otherwise current time
    const effectiveTime = seekTime !== null ? seekTime : currentTime;

    // Clear seek time after it's been applied
    if (seekTime !== null) {
        setTimeout(() => setSeekTime(null), 100);
    }

    return {
        currentTime: effectiveTime,
        activeSegmentId,
        handleTimeUpdate,
        handleSegmentClick,
    };
}
