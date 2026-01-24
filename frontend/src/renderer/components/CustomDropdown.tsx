import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, Check } from 'lucide-react';
import { cn } from '../utils';

interface DropdownOption {
    value: string;
    label: string;
    desc: string;
    isRecommended?: boolean;
}

interface CustomDropdownProps {
    currentValue: string;
    onChange: (val: string) => void;
    options: DropdownOption[];
}

export const CustomDropdown = ({ currentValue, onChange, options }: CustomDropdownProps) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const selectedOption = options.find(o => o.value === currentValue);

    return (
        <div ref={containerRef} className="relative">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 text-sm font-bold text-primary hover:text-primary/80 transition-colors"
            >
                {selectedOption?.label || currentValue}
                <ChevronDown className={cn("w-4 h-4 transition-transform shrink-0", isOpen && "rotate-180")} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.95 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        className="absolute right-0 top-full mt-2 w-64 bg-background dark:bg-zinc-950 border border-border rounded-xl shadow-2xl z-[100] overflow-hidden"
                    >
                        <div className="p-1.5 space-y-0.5">
                            {options.map((option) => (
                                <button
                                    key={option.value}
                                    onClick={() => {
                                        onChange(option.value);
                                        setIsOpen(false);
                                    }}
                                    className={cn(
                                        "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-left transition-colors",
                                        "hover:bg-accent hover:text-accent-foreground",
                                        currentValue === option.value ? "bg-primary/10 text-primary" : "text-foreground"
                                    )}
                                >
                                    <div className="flex flex-col">
                                        <div className="flex items-center gap-2">
                                            <span className="text-sm font-bold leading-none mb-1">{option.label}</span>
                                            {option.isRecommended && (
                                                <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wide">
                                                    Recommended
                                                </span>
                                            )}
                                        </div>
                                        <span className="text-[10px] opacity-70 leading-none">{option.desc}</span>
                                    </div>
                                    {currentValue === option.value && <Check className="w-4 h-4 shrink-0" />}
                                </button>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
