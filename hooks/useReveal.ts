"use client";

import { useEffect } from "react";

export function useReveal() {
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const el = entry.target as HTMLElement;
            const siblings = el.parentElement?.querySelectorAll(".reveal") ?? [];
            siblings.forEach((s, idx) => {
              if (s === el) {
                (s as HTMLElement).style.transitionDelay = `${idx * 75}ms`;
              }
            });
            el.classList.add("visible");
          }
        });
      },
      { threshold: 0.08 }
    );

    document.querySelectorAll(".reveal").forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

