import "server-only";

import React from "react";
import { AttendanceReportPdfTemplate, attendancePdfStyles } from "./AttendanceReportPdfTemplate";
import type { AttendancePdfLocale, AttendanceReport } from "./types";

function footerTemplate(locale: AttendancePdfLocale): string {
  const inner =
    locale === "de"
      ? 'Seite <span class="pageNumber"></span> von <span class="totalPages"></span>'
      : 'Page <span class="pageNumber"></span> of <span class="totalPages"></span>';
  return `<div style="font-size:9px;width:100%;text-align:right;padding-right:12mm;color:#64748b;font-family:Helvetica,Arial,sans-serif">${inner}</div>`;
}

export async function buildAttendancePdfHtml(data: AttendanceReport, locale: AttendancePdfLocale): Promise<string> {
  const { renderToStaticMarkup } = await import("react-dom/server");
  const body = renderToStaticMarkup(
    <AttendanceReportPdfTemplate data={data} locale={locale} />
  );
  return `<!DOCTYPE html>
<html lang="${locale}">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<style>${attendancePdfStyles}</style>
</head>
<body>${body}</body>
</html>`;
}

export async function attendanceReportToPdfBuffer(html: string, locale: AttendancePdfLocale): Promise<Buffer> {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"]
  });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const buf = await page.pdf({
      format: "A4",
      printBackground: true,
      preferCSSPageSize: true,
      displayHeaderFooter: true,
      headerTemplate: "<div></div>",
      footerTemplate: footerTemplate(locale),
      margin: {
        top: "12mm",
        right: "12mm",
        bottom: "18mm",
        left: "12mm"
      }
    });
    return Buffer.from(buf);
  } finally {
    await browser.close();
  }
}
