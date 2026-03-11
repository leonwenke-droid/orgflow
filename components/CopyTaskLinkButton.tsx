"use client";

import { useState } from "react";

type Props = { token: string };

export default function CopyTaskLinkButton({ token }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      const fullUrl = typeof window !== "undefined" ? `${window.location.origin}/task/${token}` : "";
      await navigator.clipboard.writeText(fullUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="rounded bg-cyan-500/20 px-2 py-0.5 text-cyan-300 hover:bg-cyan-500/30"
      title="Link kopieren"
    >
      {copied ? "Kopiert!" : "Link kopieren"}
    </button>
  );
}
