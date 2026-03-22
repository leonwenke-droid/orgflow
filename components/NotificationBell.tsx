"use client";

import { useCallback, useEffect, useState } from "react";
import { Bell } from "lucide-react";

type NotifItem = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read_at: string | null;
  created_at: string;
};

export default function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<NotifItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) {
        setItems([]);
        setUnread(0);
        return;
      }
      const data = await res.json();
      setItems(data.items ?? []);
      setUnread(Number(data.unreadCount ?? 0));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    const t = setInterval(load, 60_000);
    return () => clearInterval(t);
  }, [load]);

  const markRead = async (ids: string[]) => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids })
    });
    load();
  };

  const markAllRead = async () => {
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ markAllRead: true })
    });
    load();
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((o) => !o);
          if (!open) load();
        }}
        className="relative rounded-lg p-2 text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
        aria-label="Notifications"
        aria-expanded={open}
      >
        <Bell className="h-4 w-4" />
        {unread > 0 && (
          <span className="absolute right-1 top-1 flex h-3.5 min-w-[14px] items-center justify-center rounded-full bg-red-500 px-0.5 text-[9px] font-bold text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>
      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default bg-black/20 dark:bg-black/40"
            aria-label="Close"
            onClick={() => setOpen(false)}
          />
          <div className="absolute right-0 top-full z-50 mt-1 w-[min(100vw-2rem,22rem)] rounded-xl border border-gray-200 bg-white shadow-xl dark:border-gray-700 dark:bg-gray-900">
            <div className="flex items-center justify-between border-b border-gray-200 px-3 py-2 dark:border-gray-700">
              <span className="text-xs font-semibold text-gray-900 dark:text-gray-100">Benachrichtigungen</span>
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => markAllRead()}
                  className="text-[10px] font-medium text-blue-600 hover:underline dark:text-blue-400"
                >
                  Alle gelesen
                </button>
              )}
            </div>
            <ul className="max-h-72 overflow-y-auto py-1">
              {loading && items.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-gray-500">…</li>
              ) : items.length === 0 ? (
                <li className="px-3 py-4 text-center text-xs text-gray-500 dark:text-gray-400">Keine Einträge</li>
              ) : (
                items.map((n) => (
                  <li key={n.id} className="border-b border-gray-100 last:border-0 dark:border-gray-800">
                    {n.link ? (
                      <a
                        href={n.link}
                        className={`block px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 ${!n.read_at ? "bg-blue-50/50 dark:bg-blue-900/20" : ""}`}
                        onClick={() => {
                          if (!n.read_at) markRead([n.id]);
                          setOpen(false);
                        }}
                      >
                        <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">{n.body}</p>}
                        <p className="mt-1 text-[10px] text-gray-400">
                          {new Date(n.created_at).toLocaleString()}
                        </p>
                      </a>
                    ) : (
                      <button
                        type="button"
                        className={`w-full px-3 py-2 text-left hover:bg-gray-50 dark:hover:bg-gray-800 ${!n.read_at ? "bg-blue-50/50 dark:bg-blue-900/20" : ""}`}
                        onClick={() => {
                          if (!n.read_at) markRead([n.id]);
                        }}
                      >
                        <p className="text-xs font-medium text-gray-900 dark:text-gray-100">{n.title}</p>
                        {n.body && <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">{n.body}</p>}
                      </button>
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
}
