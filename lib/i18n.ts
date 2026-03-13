export type Locale = "en" | "de";

export const defaultLocale: Locale = "en";

export const translations: Record<Locale, Record<string, string>> = {
  en: {
    "dashboard.title": "Dashboard",
    "dashboard.tasks": "Tasks",
    "dashboard.shifts": "Shifts",
    "dashboard.finance": "Finance",
    "dashboard.resources": "Resources",
    "dashboard.engagement": "Engagement",
    "dashboard.members": "Members",
    "dashboard.teams": "Teams",
    "dashboard.settings": "Settings",
    "dashboard.admin": "Admin Overview",
    "empty.tasks": "You don't have tasks yet. Create your first task to organise your team.",
    "empty.shifts": "No shifts planned yet. Create shifts to schedule your team.",
    "empty.members": "No members yet. Invite people to join your organisation.",
    "empty.teams": "No teams yet. Create teams to organise your members.",
    "empty.finance": "No treasury entries yet. Record your first transaction.",
    "empty.resources": "No materials recorded yet. Track procurement and resources.",
    "common.create": "Create",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.back": "Back",
    "common.next": "Next",
    "common.loading": "Loading…",
  },
  de: {
    "dashboard.title": "Dashboard",
    "dashboard.tasks": "Aufgaben",
    "dashboard.shifts": "Schichten",
    "dashboard.finance": "Finanzen",
    "dashboard.resources": "Ressourcen",
    "dashboard.engagement": "Engagement",
    "dashboard.members": "Mitglieder",
    "dashboard.teams": "Teams",
    "dashboard.settings": "Einstellungen",
    "dashboard.admin": "Admin-Übersicht",
    "empty.tasks": "Noch keine Aufgaben. Erstelle deine erste Aufgabe, um dein Team zu organisieren.",
    "empty.shifts": "Noch keine Schichten geplant. Erstelle Schichten, um dein Team einzuteilen.",
    "empty.members": "Noch keine Mitglieder. Lade Personen ein, deiner Organisation beizutreten.",
    "empty.teams": "Noch keine Teams. Erstelle Teams, um deine Mitglieder zu organisieren.",
    "empty.finance": "Noch keine Kassenbuchungen. Erfasse deine erste Transaktion.",
    "empty.resources": "Noch keine Materialien erfasst. Verfolge Beschaffungen und Ressourcen.",
    "common.create": "Erstellen",
    "common.edit": "Bearbeiten",
    "common.delete": "Löschen",
    "common.save": "Speichern",
    "common.cancel": "Abbrechen",
    "common.back": "Zurück",
    "common.next": "Weiter",
    "common.loading": "Laden…",
  },
};

export function t(key: string, locale: Locale = defaultLocale): string {
  const dict = translations[locale] ?? translations.en;
  return dict[key] ?? translations.en[key] ?? key;
}
