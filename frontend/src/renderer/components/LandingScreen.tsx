import React from 'react';
import { Plus } from 'lucide-react';

interface LandingScreenProps {
    onNewTranscription: () => void;
}

export const LandingScreen: React.FC<LandingScreenProps> = ({ onNewTranscription }) => {
    return (
        <div className="flex-1 flex flex-col items-center justify-center p-8 transition-colors duration-500">
            <div className="max-w-3xl w-full text-center space-y-12">
                <div className="space-y-6">
                    <h1 className="text-7xl font-bold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-foreground to-foreground/50 drop-shadow-sm">
                        Transcribe AI
                    </h1>
                    <p className="text-xl text-muted-foreground/80 max-w-2xl mx-auto font-medium leading-relaxed">
                        Professional-grade automated transcription.<br />
                        Secure, local, and lightning fast.
                    </p>
                </div>

                <div className="flex items-center justify-center gap-4">
                    <button
                        onClick={onNewTranscription}
                        className="relative group h-16 px-10 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-2xl transition-all shadow-xl hover:shadow-2xl hover:shadow-primary/20 hover:-translate-y-1 overflow-hidden"
                    >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent translate-x-[-200%] group-hover:translate-x-[200%] transition-transform duration-1000" />
                        <div className="flex items-center gap-3 relative z-10">
                            <Plus className="w-6 h-6" />
                            <span className="text-lg">New Transcription</span>
                        </div>
                    </button>
                </div>

                {/* Mini Feature Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 pt-12">
                    {[
                        { icon: '🤖', title: 'Smart AI', desc: 'Advanced speaker detection' },
                        { icon: '📝', title: 'Export Ready', desc: 'SRT, TXT, & JSON formats' },
                        { icon: '⚡', title: 'Local Speed', desc: 'Private on-device processing' }
                    ].map((feat, i) => (
                        <div key={i} className="p-6 bg-background/40 backdrop-blur-md border border-white/10 rounded-3xl text-left space-y-2 hover:bg-background/60 hover:scale-[1.02] transition-all duration-300 shadow-lg hover:shadow-xl">
                            <div className="text-3xl mb-3 grayscale group-hover:grayscale-0 transition-all">{feat.icon}</div>
                            <h3 className="font-bold text-foreground">{feat.title}</h3>
                            <p className="text-xs text-muted-foreground font-medium">{feat.desc}</p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};
