import { X, Monitor, Zap, Settings, Moon, Sun, Minus, Plus } from 'lucide-react';
import { cn } from '../utils';
import { CollapsibleSection } from './CollapsibleSection';
import { CustomDropdown } from './CustomDropdown';
import { getRecommendedModel } from '../utils/settingsUtils';

interface SettingsDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    isDark: boolean;
    toggleDarkMode: () => void;
    zoom: number;
    adjustZoom: (delta: number) => void;
    systemSpecs: { cpu: string, gpu: string, ram: number, vram: number, cores: number, threads: number } | null;
    currentModel: string;
    onModelChange: (model: string) => void;
    isModelChanging: boolean;
}

export const SettingsDrawer = ({
    isOpen,
    onClose,
    isDark,
    toggleDarkMode,
    zoom,
    adjustZoom,
    systemSpecs,
    currentModel,
    onModelChange,
    isModelChanging,
}: SettingsDrawerProps) => {
    return (
        <>
            {/* Backdrop */}
            <div
                className={cn(
                    "fixed inset-0 z-[60] bg-background/40 backdrop-blur-sm transition-opacity duration-300",
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                )}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className={cn(
                    "fixed top-0 left-0 h-full w-full max-w-[400px] bg-background border-r border-border z-[70] shadow-2xl transition-transform duration-500 ease-out flex flex-col",
                    isOpen ? "translate-x-0" : "-translate-x-full"
                )}
            >
                {/* Header */}
                <div className="p-6 border-b border-border flex items-center justify-between bg-accent/10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-primary/10 rounded-2xl flex items-center justify-center">
                            <Settings className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Settings</h2>
                            <p className="text-xs text-muted-foreground">Configure your workspace</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2.5 rounded-xl hover:bg-accent transition-colors text-muted-foreground hover:text-foreground"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {/* Content */}
                <div
                    className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar"
                    style={{ scrollbarGutter: 'stable' }}
                >
                    {/* Appearance Section */}
                    <section className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <Monitor className="w-4 h-4 text-muted-foreground" />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Appearance</h3>
                        </div>

                        <div className="space-y-3">
                            <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border/50 rounded-xl hover:border-border transition-all">
                                <div>
                                    <p className="text-sm font-bold">Interface Theme</p>
                                    <p className="text-[10px] text-muted-foreground">Switch between light and dark modes</p>
                                </div>
                                <button
                                    onClick={toggleDarkMode}
                                    className={cn(
                                        "relative w-14 h-8 rounded-full transition-colors duration-300 flex items-center px-1",
                                        isDark ? "bg-primary" : "bg-muted"
                                    )}
                                >
                                    <div className={cn(
                                        "w-6 h-6 rounded-full bg-white shadow-md transition-transform duration-300 flex items-center justify-center",
                                        isDark ? "translate-x-6" : "translate-x-0"
                                    )}>
                                        {isDark ? <Moon className="w-3.5 h-3.5 text-black" /> : <Sun className="w-3.5 h-3.5 text-neutral-500" />}
                                    </div>
                                </button>
                            </div>

                            <div className="flex items-center justify-between p-4 bg-secondary/30 border border-border/50 rounded-xl hover:border-border transition-all">
                                <div>
                                    <p className="text-sm font-bold">Interface Zoom</p>
                                    <p className="text-[10px] text-muted-foreground">Adjust the UI scale</p>
                                </div>
                                <div className="flex items-center gap-1 bg-background p-1.5 rounded-lg border border-border">
                                    <button
                                        onClick={() => adjustZoom(-10)}
                                        disabled={zoom <= 50}
                                        className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 transition-all"
                                    >
                                        <Minus className="w-3.5 h-3.5" />
                                    </button>
                                    <span className="text-xs font-mono w-10 text-center font-bold">{zoom}%</span>
                                    <button
                                        onClick={() => adjustZoom(10)}
                                        disabled={zoom >= 200}
                                        className="p-1.5 rounded-md hover:bg-accent disabled:opacity-30 transition-all"
                                    >
                                        <Plus className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </section>
                    {/* Al Engine Section */}
                    <section className="space-y-3">
                        <div className="flex items-center gap-2 px-1">
                            <Zap className="w-4 h-4 text-muted-foreground" />
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">AI Engine</h3>
                        </div>
                        <div className="p-4 bg-secondary/30 border border-border/50 rounded-xl hover:border-border transition-all flex items-center justify-between relative">
                            <span className="text-sm font-bold">Transcription Quality</span>

                            <CustomDropdown
                                currentValue={currentModel}
                                onChange={onModelChange}
                                options={[
                                    { value: 'tiny', label: 'Tiny', desc: 'Fastest / Low Accuracy' },
                                    { value: 'small', label: 'Small', desc: 'Fast / Standard Accuracy' },
                                    { value: 'medium', label: 'Medium', desc: 'Balanced / Good Accuracy' },
                                    { value: 'distil-large-v3', label: 'Distil-Large-v3', desc: 'High Perf / Great Accuracy' },
                                    { value: 'large-v3', label: 'Large-v3', desc: 'Slowest / Best Accuracy' },
                                ].map(opt => ({
                                    ...opt,
                                    isRecommended: opt.value === getRecommendedModel(systemSpecs)
                                }))}
                            />
                        </div>
                    </section>

                    {/* Hardware Info Section */}
                    <section className="space-y-3">
                        <CollapsibleSection title="Hardware" defaultOpen={false}>
                            {systemSpecs ? (
                                <div className="space-y-4 relative z-10 text-xs font-medium">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">CPU</span>
                                            <span className="block leading-relaxed truncate" title={systemSpecs.cpu}>{systemSpecs.cpu}</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Cores</span>
                                            <span className="block leading-relaxed">{systemSpecs.cores}</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1.5">
                                        <span className="text-[10px] text-muted-foreground uppercase font-bold block">GPU</span>
                                        <span className="block leading-relaxed truncate" title={systemSpecs.gpu}>{systemSpecs.gpu}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">RAM</span>
                                            <span className="block leading-relaxed">{Math.round(systemSpecs.ram)} GB</span>
                                        </div>
                                        <div className="space-y-1.5">
                                            <span className="text-[10px] text-muted-foreground uppercase font-bold block">Threads</span>
                                            <span className="block leading-relaxed text-primary">{systemSpecs.threads}</span>
                                        </div>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-white/5">
                                        <p className="text-[10px] leading-relaxed text-muted-foreground/80">
                                            System automatically detects capabilities to optimize performance.
                                            <span className="text-foreground/90 font-medium"> NVIDIA GPUs</span> use CUDA acceleration;
                                            others use optimized <span className="text-foreground/90 font-medium">CPU processing</span>.
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-[10px] italic opacity-80">Specifying...</p>
                            )}
                        </CollapsibleSection>
                    </section>
                </div>
            </div>
        </>
    );
};
