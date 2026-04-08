/**
 * Kanban column keys for admin tasks (4 columns). Display placement may differ from raw DB status
 * when a task is overdue by due date.
 */
export type KanbanColumnKey = "offen" | "in_arbeit" | "erledigt" | "ueberfaellig";

export function getKanbanColumnForTask(task: {
  status: string;
  due_at: string | null;
}): KanbanColumnKey {
  if (task.status === "erledigt") return "erledigt";
  if (task.status === "ueberfaellig") return "ueberfaellig";
  if (task.due_at && new Date(task.due_at).getTime() < Date.now()) {
    return "ueberfaellig";
  }
  if (task.status === "in_arbeit") return "in_arbeit";
  if (task.status === "offen") return "offen";
  return "offen";
}
