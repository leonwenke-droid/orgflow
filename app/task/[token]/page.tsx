import { cookies } from "next/headers";
import { createSupabaseServiceRoleClient } from "../../../lib/supabaseServer";
import TaskConfirmationForm from "../../../components/TaskConfirmationForm";
import NameVerificationForm from "../../../components/NameVerificationForm";
import { verifyTaskOwner } from "./actions";

const COOKIE_NAME = "abi_task_verified";

async function getTaskByToken(token: string) {
  const supabase = createSupabaseServiceRoleClient();

  const { data: task, error } = await supabase
    .from("tasks")
    .select("id, title, description, due_at, status, proof_required, proof_url, owner_id")
    .eq("access_token", token)
    .maybeSingle();

  if (error || !task) return null;

  const { data: owner } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", task.owner_id)
    .single();

  return {
    ...task,
    owner_name: (owner?.full_name ?? "").trim()
  };
}

export default async function TaskPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  if (!token) {
    return (
      <div className="card max-w-xl">
        <p className="text-sm text-red-300">
          Ungültiger Aufgabenlink.
        </p>
      </div>
    );
  }

  const task = await getTaskByToken(token);

  if (!task) {
    return (
      <div className="card max-w-xl">
        <p className="text-sm text-red-300">
          Dieser Aufgabenlink ist ungültig oder abgelaufen.
        </p>
      </div>
    );
  }

  const cookieStore = await cookies();
  const verifiedToken = cookieStore.get(COOKIE_NAME)?.value;

  if (verifiedToken === token) {
    return (
      <div className="card max-w-xl">
        <h2 className="mb-2 text-sm font-semibold text-cyan-400">
          Persönliche Aufgabe
        </h2>
        <p className="text-xs text-cyan-400/80 mb-4">
          Dieser Link ist nur für dich. Du kannst den Status ändern und bei Bedarf einen Beleg hochladen.
        </p>
        <TaskConfirmationForm
          token={token}
          task={{
            id: task.id,
            title: task.title,
            description: task.description,
            due_at: task.due_at,
            status: task.status,
            proof_required: task.proof_required,
            proof_url: task.proof_url
          }}
        />
      </div>
    );
  }

  return (
    <div className="card max-w-xl">
      <h2 className="mb-2 text-sm font-semibold text-cyan-400">
        Aufgabenlink bestätigen
      </h2>
      <p className="text-xs text-cyan-400/80 mb-4">
        Gib einmalig deinen Namen ein, damit wir prüfen können, ob dieser Link für dich bestimmt ist.
      </p>
      <NameVerificationForm token={token} verifyAction={verifyTaskOwner} />
    </div>
  );
}
