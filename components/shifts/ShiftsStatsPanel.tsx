import Link from "next/link";
import type { Locale } from "../../lib/i18n";
import { t } from "../../lib/i18n";
import type { MemberAttendanceRow } from "../../lib/shiftStats";

export default function ShiftsStatsPanel({
  locale,
  orgSlug,
  ratePercent,
  completedShiftsCount,
  unexcusedMissedCount,
  memberRows
}: {
  locale: Locale;
  orgSlug: string | null;
  ratePercent: number | null;
  completedShiftsCount: number;
  unexcusedMissedCount: number;
  memberRows: MemberAttendanceRow[];
}) {
  const csvHref =
    orgSlug && orgSlug.length > 0
      ? `/api/admin/shifts/stats-csv?org=${encodeURIComponent(orgSlug)}`
      : null;

  const rateBadge = (pct: number) => {
    if (pct >= 90) return "sc-rate sc-rate--ok";
    if (pct >= 70) return "sc-rate sc-rate--mid";
    return "sc-rate sc-rate--bad";
  };

  return (
    <div className="space-y-4">
      <div className="g3">
        <div className="stat">
          <div className="sl">{t("shifts.console_stats_rate", locale)}</div>
          <div className="sv">{ratePercent != null ? `${ratePercent}%` : "—"}</div>
          <div className="ss">{t("shifts.console_stats_last_month", locale)}</div>
        </div>
        <div className="stat">
          <div className="sl">{t("shifts.console_stats_completed", locale)}</div>
          <div className="sv">{completedShiftsCount}</div>
          <div className="ss">&nbsp;</div>
        </div>
        <div className="stat">
          <div className="sl">{t("shifts.console_stats_missed", locale)}</div>
          <div className="sv" style={{ color: "var(--sp-danger)" }}>
            {unexcusedMissedCount}
          </div>
          <div className="ss">{t("shifts.console_stats_cases", locale)}</div>
        </div>
      </div>

      <div className="sc-card overflow-hidden">
        <div className="sc-card-hd flex flex-wrap items-center gap-2">
          <span className="min-w-0 flex-1">{t("shifts.console_stats_per_member", locale)}</span>
          {csvHref ? (
            <a
              href={csvHref}
              className="sc-btn sc-btn-primary no-underline"
              download
            >
              {t("shifts.console_stats_csv", locale)}
            </a>
          ) : null}
        </div>
        <div
          className="grid gap-2 px-4 py-2 text-[10px] font-bold uppercase tracking-wide"
          style={{
            color: "var(--sc-text3)",
            gridTemplateColumns: "36px 1fr 64px 64px 72px",
            borderBottom: "1px solid var(--sc-border)"
          }}
        >
          <span />
          <span>{t("shifts.stats_col_name", locale)}</span>
          <span className="text-right">{t("shifts.console_stats_shifts", locale)}</span>
          <span className="text-right">{t("shifts.console_stats_present", locale)}</span>
          <span className="text-right">{t("shifts.console_stats_rate_col", locale)}</span>
        </div>
        {memberRows.map((r) => (
          <div
            key={r.userId}
            className="grid items-center gap-2 px-4 py-2.5 text-sm"
            style={{
              gridTemplateColumns: "36px 1fr 64px 64px 72px",
              borderBottom: "1px solid var(--sc-border)"
            }}
          >
            <div
              className="flex h-9 w-9 items-center justify-center rounded-full text-[10px] font-bold"
              style={{
                background: "var(--sc-accent-dim)",
                color: "var(--sc-accent)",
                border: "1px solid rgba(109,158,255,0.25)"
              }}
            >
              {r.name
                .split(/\s+/)
                .map((p) => p[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <span className="min-w-0 truncate font-semibold">{r.name}</span>
            <span className="text-right tabular-nums">{r.shiftCount}</span>
            <span className="text-right tabular-nums" style={{ color: "var(--sc-success)" }}>
              {r.presentCount}
            </span>
            <span className={`text-right text-xs font-semibold ${rateBadge(r.ratePercent)}`}>{r.ratePercent}%</span>
          </div>
        ))}
      </div>

      <div className="sc-card">
        <div className="sc-card-hd">{t("shifts.console_types_title", locale)}</div>
        <div className="space-y-2.5 p-4">
          <TypeRow
            locale={locale}
            dot="#5b9fff"
            titleKey="shifts.assignment_kind_label_self_signup"
            descKey="shifts.type_desc_self_signup"
            badgeKey="shifts.assignment_kind_short_self_signup"
            badgeClass="sc-type-badge sc-type-badge--blue"
          />
          <TypeRow
            locale={locale}
            dot="var(--sc-warn)"
            titleKey="shifts.assignment_kind_label_auto_assign"
            descKey="shifts.type_desc_auto_assign"
            badgeKey="shifts.assignment_kind_short_auto_assign"
            badgeClass="sc-type-badge sc-type-badge--warn"
          />
          <TypeRow
            locale={locale}
            dot="var(--sc-success)"
            titleKey="shifts.assignment_kind_label_rotation"
            descKey="shifts.type_desc_rotation"
            badgeKey="shifts.assignment_kind_short_rotation"
            badgeClass="sc-type-badge sc-type-badge--ok"
          />
          <TypeRow
            locale={locale}
            dot="var(--sc-violet)"
            titleKey="shifts.assignment_kind_label_fixed"
            descKey="shifts.type_desc_fixed"
            badgeKey="shifts.assignment_kind_short_fixed"
            badgeClass="sc-type-badge sc-type-badge--muted"
          />
        </div>
      </div>

      <p className="text-xs" style={{ color: "var(--sc-text3)" }}>
        <Link href="/docs/shift-checkin" className="underline">
          {t("shifts.qrflow_docs_link", locale)}
        </Link>
      </p>
    </div>
  );
}

function TypeRow({
  locale,
  dot,
  titleKey,
  descKey,
  badgeKey,
  badgeClass
}: {
  locale: Locale;
  dot: string;
  titleKey:
    | "shifts.assignment_kind_label_self_signup"
    | "shifts.assignment_kind_label_auto_assign"
    | "shifts.assignment_kind_label_rotation"
    | "shifts.assignment_kind_label_fixed";
  descKey:
    | "shifts.type_desc_self_signup"
    | "shifts.type_desc_auto_assign"
    | "shifts.type_desc_rotation"
    | "shifts.type_desc_fixed";
  badgeKey:
    | "shifts.assignment_kind_short_self_signup"
    | "shifts.assignment_kind_short_auto_assign"
    | "shifts.assignment_kind_short_rotation"
    | "shifts.assignment_kind_short_fixed";
  badgeClass: string;
}) {
  return (
    <div
      className="type-row"
    >
      <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: dot }} />
      <div className="min-w-0 flex-1">
        <div className="text-sm font-semibold">{t(titleKey, locale)}</div>
        <div className="text-xs" style={{ color: "var(--sc-text2)" }}>
          {t(descKey, locale)}
        </div>
      </div>
      <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ${badgeClass}`}>
        {t(badgeKey, locale)}
      </span>
    </div>
  );
}
