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
          Invalid task link.
        </p>
      </div>
    );
  }

  const task = await getTaskByToken(token);

  if (!task) {
    return (
      <div className="card max-w-xl">
        <p className="text-sm text-red-300">
          This task link is invalid or expired.
        </p>
      </div>
    );
  }

  const cookieStore = await cookies();
  const verifiedToken = cookieStore.get(COOKIE_NAME)?.value;

  if (verifiedToken === token) {
    return (
      <div className="card max-w-xl">
        <h2 className="mb-2 text-sm font-semibold text-blue-400">
          Personal task
        </h2>
        <p className="text-xs text-blue-400/80 mb-4">
          This link is for you only. You can change the status and upload proof if required.
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
      <h2 className="mb-2 text-sm font-semibold text-blue-400">
        Confirm task link
      </h2>
      <p className="text-xs text-blue-400/80 mb-4">
        Enter your name once so we can verify this link is intended for you.
      </p>
      <NameVerificationForm token={token} verifyAction={verifyTaskOwner} />
    </div>
  );
}
