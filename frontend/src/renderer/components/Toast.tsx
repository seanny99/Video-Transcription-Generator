import React, { useEffect } from 'react';
import { CheckCircle2, Info, AlertCircle, X } from 'lucide-react';
import { cn } from '../utils';

export interface ToastProps {
    id: string;
    message: string;
    type?: 'success' | 'info' | 'error';
    onClose: (id: string) => void;
}

export const Toast = ({ id, message, type = 'info', onClose }: ToastProps) => {
    useEffect(() => {
        const timer = setTimeout(() => onClose(id), 5000);
        return () => clearTimeout(timer);
    }, [id, onClose]);

    return (
        <div
            className={cn(
                "flex items-center gap-3 px-5 py-4 rounded-2xl shadow-2xl border animate-in slide-in-from-right-10 duration-500 min-w-[320px] max-w-md",
                "bg-background backdrop-blur-md",
                type === 'success' && "border-emerald-500/20 text-emerald-600 dark:text-emerald-400",
                type === 'info' && "border-primary/20 text-primary",
                type === 'error' && "border-red-500/20 text-red-600 dark:text-red-400"
            )}
        >
            <div className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
                type === 'success' && "bg-emerald-500/10",
                type === 'info' && "bg-primary/10",
                type === 'error' && "bg-red-500/10"
            )}>
                {type === 'success' && <CheckCircle2 className="w-5 h-5" />}
                {type === 'info' && <Info className="w-5 h-5" />}
                {type === 'error' && <AlertCircle className="w-5 h-5" />}
            </div>

            <div className="flex-1">
                <p className="text-sm font-bold text-foreground">{message}</p>
            </div>

            <button
                onClick={() => onClose(id)}
                className="p-1 rounded-lg hover:bg-accent transition-colors opacity-50 hover:opacity-100"
            >
                <X className="w-4 h-4" />
            </button>
        </div>
    );
};
