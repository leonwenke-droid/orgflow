"use client";

import { useRef, useCallback } from "react";
import { QRCodeCanvas } from "qrcode.react";

type Props = {
  /** Payload encoded in the QR (e.g. check-in URL). */
  value: string;
  /** Suggested download filename (with or without `.png`). */
  filename: string;
  /** Visible button label. */
  label: string;
  className?: string;
  /** Canvas size in px (higher = sharper print). */
  renderSize?: number;
};

/**
 * Renders the QR off-screen and offers a PNG download — no visible QR preview.
 */
export default function DownloadQrPngButton({
  value,
  filename,
  label,
  className,
  renderSize = 512
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const download = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const name = filename.endsWith(".png") ? filename : `${filename}.png`;
    const url = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }, [filename]);

  return (
    <>
      <div className="pointer-events-none fixed left-[-9999px] top-0 opacity-0" aria-hidden>
        <QRCodeCanvas ref={canvasRef} value={value} size={renderSize} includeMargin />
      </div>
      <button type="button" onClick={download} className={className}>
        {label}
      </button>
    </>
  );
}
