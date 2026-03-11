"use client";

import { useCallback, useState } from "react";

export type ToastType = "success" | "error" | "info";

export interface Toast {
  id: string;
  message: string;
  type: ToastType;
}

let toastListeners: ((toast: Toast) => void)[] = [];

function notify(toast: Omit<Toast, "id">) {
  const t: Toast = { ...toast, id: Math.random().toString(36).slice(2) };
  toastListeners.forEach((fn) => fn(t));
}

export function toast(message: string, type: ToastType = "info") {
  notify({ message, type });
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const addToast = useCallback((t: Toast) => {
    setToasts((prev) => [...prev.slice(-4), t]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== t.id));
    }, 4000);
  }, []);

  const subscribe = useCallback(() => {
    toastListeners.push(addToast);
    return () => {
      toastListeners = toastListeners.filter((l) => l !== addToast);
    };
  }, [addToast]);

  return { toasts, subscribe, toast };
}
