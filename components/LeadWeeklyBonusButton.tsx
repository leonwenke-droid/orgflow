"use client";

import { useFormState, useFormStatus } from "react-dom";

type Action = (
  prev: { message?: string } | null,
  formData?: FormData
) => Promise<{ message: string }>;

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="btn-secondary text-xs inline-flex items-center gap-2 disabled:opacity-70"
    >
      {pending ? (
        <>
          <span className="inline-block h-3 w-3 rounded-full border-2 border-cyan-300 border-t-transparent animate-spin" />
          Wird ausgeführt …
        </>
      ) : (
        "Wöchentlichen Lead-Bonus jetzt ausführen"
      )}
    </button>
  );
}

export default function LeadWeeklyBonusButton({ action }: { action: Action }) {
  const [state, formAction] = useFormState(action, null);

  return (
    <form action={formAction} className="space-y-2">
      <SubmitButton />
      {state?.message && (
        <p className="text-xs text-cyan-400/80">{state.message}</p>
      )}
    </form>
  );
}
