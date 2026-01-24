/**
 * Logic to recommend a whisper model based on hardware specs.
 */
export const getRecommendedModel = (specs: { gpu: string, vram: number, ram: number, cores: number } | null): string => {
    if (!specs) return 'distil-large-v3';

    const hasNvidia = specs.gpu.toLowerCase().includes('nvidia');
    const vram = specs.vram || 0;
    const ram = specs.ram || 0;
    const cores = specs.cores || 4;

    // 1. High-end GPU (Big VRAM) -> Large-v3
    if (hasNvidia && vram >= 6) return 'large-v3';

    // 2. Mid-range GPU or Strong CPU -> Distil-Large-v3
    if ((hasNvidia && vram >= 2) || (ram >= 16 && cores >= 8)) return 'distil-large-v3';

    // 3. Decent RAM -> Medium
    if (ram >= 12) return 'medium';

    // 4. Low RAM -> Small
    if (ram >= 8) return 'small';

    // 5. Minimal -> Tiny
    return 'tiny';
};

export const getModelDescription = (model: string) => {
    switch (model) {
        case 'tiny': return "Instant speed, suitable for quick checks. Lowest accuracy.";
        case 'base': return "Very fast, decent for clear audio.";
        case 'small': return "Good balance of speed and accuracy.";
        case 'distil-medium.en': return "Highly optimized for English. Fast and accurate.";
        case 'medium': return "High accuracy, slower. Good for accents.";
        case 'distil-large-v3': return "Top choice for CPUs. 6x faster than Large-v3 with similar accuracy.";
        case 'large-v3': return "Maximum possible accuracy. Very slow on CPU.";
        default: return "Select a model to see details.";
    }
};
