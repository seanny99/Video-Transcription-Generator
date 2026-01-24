import { TranscriptSegment } from '../types';

/**
 * Formats seconds into M:SS or H:MM:SS string.
 */
export const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);

    if (hours > 0) {
        return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
};

/**
 * Formats seconds into SRT timestamp format (HH:MM:SS,mmm).
 */
export const formatSrtTime = (seconds: number): string => {
    const date = new Date(0);
    date.setSeconds(Math.floor(seconds));
    const iso = date.toISOString().substring(11, 19);
    const ms = Math.floor((seconds % 1) * 1000).toString().padStart(3, '0');
    return `${iso},${ms}`;
};

/**
 * Generates SRT file content from segments.
 */
export const generateSrt = (segments: TranscriptSegment[]): string => {
    return segments.map((seg, i) => {
        const start = formatSrtTime(seg.start_time);
        const end = formatSrtTime(seg.end_time);
        return `${i + 1}\n${start} --> ${end}\n${seg.text}\n`;
    }).join('\n');
};

/**
 * Generates plain text content from segments.
 */
export const generateTxt = (segments: TranscriptSegment[], fullText?: string | null): string => {
    if (fullText) return fullText;
    return segments.map(s => s.text).join(' ');
};

/**
 * Downloads a string as a file.
 */
export const downloadFile = (content: string, filename: string, mimeType: string = 'text/plain') => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
};
