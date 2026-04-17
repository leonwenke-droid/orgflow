"use client";

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";

/** Rendert Kinder direkt unter `document.body`, damit `position:fixed` nicht an Tabellen/Transform hängen bleibt und über Mobile-Nav/Sidebar liegt. */
export default function ModalPortal({ children }: { children: React.ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  return createPortal(children, document.body);
}
