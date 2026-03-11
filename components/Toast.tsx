"use client";

import { useEffect } from "react";
import { useToast } from "../hooks/useToast";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";

export default function ToastContainer() {
  const { toasts, subscribe } = useToast();

  useEffect(() => {
    return subscribe();
  }, [subscribe]);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`flex items-center gap-3 rounded-lg border px-4 py-3 shadow-lg ${
            t.type === "success"
              ? "border-green-200 bg-green-50 text-green-800"
              : t.type === "error"
                ? "border-red-200 bg-red-50 text-red-800"
                : "border-blue-200 bg-blue-50 text-blue-800"
          }`}
        >
          {t.type === "success" && <CheckCircle2 className="h-5 w-5 flex-shrink-0" />}
          {t.type === "error" && <XCircle className="h-5 w-5 flex-shrink-0" />}
          {t.type === "info" && <Info className="h-5 w-5 flex-shrink-0" />}
          <span className="text-sm font-medium">{t.message}</span>
        </div>
      ))}
    </div>
  );
}
