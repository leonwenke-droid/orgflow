/**
 * Formatiert einen vollständigen Namen für die Anzeige auf dem Dashboard:
 * nur Vorname(n) + Anfangsbuchstabe des Nachnamens (z. B. "Max M." oder "Anna Maria S.").
 */
export function formatDisplayName(fullName: string | null | undefined): string {
  const s = String(fullName ?? "").trim();
  if (!s) return "–";
  const parts = s.split(/\s+/).filter(Boolean);
  if (parts.length === 1) return parts[0];
  const last = parts[parts.length - 1];
  const initial = last.charAt(0).toUpperCase();
  const firstNames = parts.slice(0, -1).join(" ");
  return `${firstNames} ${initial}.`;
}

/** Nachnamen-Partikel, die nicht angezeigt werden (z. B. "de", "van", "von"). */
const LASTNAME_PARTICLES = new Set(["de", "van", "von", "vom", "der", "die"]);

function isParticle(word: string): boolean {
  const w = word.toLowerCase().trim();
  return w.length <= 2 || LASTNAME_PARTICLES.has(w);
}

/** Entfernt Partikel am Ende des Namens (z. B. "Jan-Renke de " → "Jan-Renke"). */
function normalizeTrailingParticle(fullName: string): string {
  return String(fullName)
    .trim()
    .replace(/\s+(de|van|von|vom|der|die)\s*$/i, "")
    .trim();
}

/**
 * Vorname = erstes Wort (für Gruppierung, damit "Sophia Pham Thi" und "Sophia Beck" beide zu "Sophia" gehören).
 */
function getFirstNames(fullName: string): string {
  const normalized = normalizeTrailingParticle(fullName);
  const parts = normalized.split(/\s+/).filter(Boolean);
  return parts[0] ?? "";
}

/**
 * Nachname = Rest nach dem ersten Wort; leer wenn nur Partikel (z. B. "de").
 * "Sophia Pham Thi" → "Pham Thi" (Initial P.), "Jan-Renke de" → "".
 */
function getLastName(fullName: string): string {
  const normalized = normalizeTrailingParticle(fullName);
  const parts = normalized.split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return "";
  const rest = parts.slice(1).join(" ");
  const restTrim = rest.trim();
  if (!restTrim) return "";
  const singleWord = parts.length === 2;
  if (singleWord && isParticle(parts[1])) return "";
  return restTrim;
}

/**
 * Findet das kürzeste eindeutige Kürzel für einen Nachnamen innerhalb einer Liste.
 * z. B. ["Müller", "Mustermann"] -> "Mül." / "Mu."
 */
function uniqueLastNameAbbrev(lastName: string, allLastNames: string[]): string {
  if (!lastName) return "";
  const firstWord = lastName.split(/\s+/)[0] ?? "";
  const norm = (s: string) => {
    const w = (s.split(/\s+/)[0] ?? "").trim();
    return w.slice(0, 1).toUpperCase() + w.slice(1).toLowerCase();
  };
  const ln = norm(lastName);
  for (let len = 1; len <= ln.length; len++) {
    const prefix = ln.slice(0, len);
    const others = allLastNames.filter((l) => l !== lastName && norm(l).startsWith(prefix));
    if (others.length === 0) return prefix + ".";
  }
  return (firstWord.charAt(0).toUpperCase() || "") + ".";
}

/**
 * Anzeigenamen für das Dashboard: nur Vorname(n).
 * Wenn im Jahrgang mehrere denselben Vornamen haben, wird das Kürzel des Nachnamens
 * angehängt (z. B. "Max M.", "Max Mu." bzw. bei Mehrdeutigkeit "Max Mül.", "Max Mu.").
 */
export function getDashboardDisplayNames(
  profiles: { id: string; full_name: string | null }[]
): Map<string, string> {
  const result = new Map<string, string>();
  const byFirstNames = new Map<string, { id: string; lastName: string }[]>();

  for (const p of profiles) {
    const full = String(p?.full_name ?? "").trim();
    if (!full) {
      result.set(p.id, "–");
      continue;
    }
    const firstNames = getFirstNames(full);
    const lastName = getLastName(full);
    if (!byFirstNames.has(firstNames)) byFirstNames.set(firstNames, []);
    byFirstNames.get(firstNames)!.push({ id: p.id, lastName });
  }

  for (const [firstNames, group] of byFirstNames) {
    if (group.length <= 1) {
      result.set(group[0].id, firstNames || "–");
      continue;
    }
    const lastNames = group.map((g) => g.lastName).filter(Boolean);
    for (const { id, lastName } of group) {
      const abbrev = uniqueLastNameAbbrev(lastName, lastNames);
      result.set(id, lastName ? `${firstNames} ${abbrev}` : firstNames || "–");
    }
  }

  return result;
}
