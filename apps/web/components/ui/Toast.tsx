"use client";

import React, { createContext, useContext, useState, useCallback, ReactNode } from "react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
    id: string;
    message: string;
    type: ToastType;
}

interface ToastContextValue {
    showToast: (message: string, type: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error("useToast must be used within a ToastProvider");
    }
    return context;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const showToast = useCallback((message: string, type: ToastType) => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);

        // Auto-dismiss after 3 seconds
        setTimeout(() => {
            setToasts((prev) => prev.filter((t) => t.id !== id));
        }, 4000);
    }, []);

    const removeToast = (id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    };

    return (
        <ToastContext.Provider value={{ showToast }}>
            {children}
            <div className="fixed bottom-6 right-6 z-[100] flex flex-col gap-3 pointer-events-none">
                {toasts.map((toast) => (
                    <div
                        key={toast.id}
                        className={`
              pointer-events-auto flex items-center gap-3 px-5 py-4 rounded-xl shadow-lg border backdrop-blur-md 
              min-w-[300px] max-w-sm animate-fade-in-up transition-all duration-300
              ${toast.type === "success"
                                ? "bg-white/90 dark:bg-slate-800/90 border-emerald-100 dark:border-emerald-900/30 text-emerald-800 dark:text-emerald-400"
                                : toast.type === "error"
                                    ? "bg-white/90 dark:bg-slate-800/90 border-red-100 dark:border-red-900/30 text-red-800 dark:text-red-400"
                                    : "bg-white/90 dark:bg-slate-800/90 border-slate-100 dark:border-slate-700 text-slate-800 dark:text-slate-200"
                            }
            `}
                        role="alert"
                    >
                        <span className="material-symbols-outlined text-[22px]">
                            {toast.type === "success"
                                ? "check_circle"
                                : toast.type === "error"
                                    ? "error"
                                    : "info"}
                        </span>
                        <p className="text-sm font-semibold flex-1 leading-snug">{toast.message}</p>
                        <button
                            onClick={() => removeToast(toast.id)}
                            className="opacity-50 hover:opacity-100 transition-opacity"
                        >
                            <span className="material-symbols-outlined text-[18px]">close</span>
                        </button>
                    </div>
                ))}
            </div>
        </ToastContext.Provider>
    );
}
