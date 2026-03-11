import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServiceRoleClient } from "../../../../lib/supabaseServer";

export const runtime = "nodejs";

const COHORT_NAMES = [
  "Alina Folmer",
  "Amelie Hilbrands",
  "Anja Gröger Valdez",
  "Ate Veenstra",
  "Celina Jütting",
  "Charlotte Weber",
  "Claas Frerichs",
  "Danilo Schuster",
  "Donata Linde",
  "Elias Kohn",
  "Ellen Cammenga",
  "Elsa Bunjes",
  "Enie Wichert",
  "Enno Leemhuis",
  "Eric Schön",
  "Erik Slacki",
  "Fabia Runde",
  "Femke Lüning",
  "Finja Heisig",
  "Gesa Wenninga",
  "Hanna Gelten",
  "Hanno Rademacher",
  "Hanno Steffen",
  "Henry Ulferts",
  "Imke Meints",
  "Jan Eden",
  "Jan-Renke de Vries",
  "Janko Wulf",
  "Jannes Lehmann",
  "Jannik Peters",
  "Jara Lünemann",
  "Jenola Felth",
  "Jerrick Hinrichs",
  "Joris Theile",
  "Jule Schilling",
  "Jule Vogt",
  "Julia van der Zijl",
  "Julian Redetzky",
  "Kea Wilshusen",
  "Kristin Metz",
  "Lammert Tergast",
  "Lana Wilken",
  "Lara Malchus",
  "Leni Hickmann",
  "Lennart Lauts",
  "Leon Wenke",
  "Louisa Cristal",
  "Marie Spekker",
  "Marit Wolters",
  "Mattis Bunger",
  "Max Willers",
  "Maximilian Buse",
  "Mette Hajen",
  "Nike Janisch",
  "Noah Baumann",
  "Patricia Ruberg",
  "Rieka Bünting",
  "Rieke Goemann",
  "Ritika Singh",
  "Ruben Doosje",
  "Sarah Schlitt",
  "Sophia Beck",
  "Sophia Pham Thi",
  "Surena Mousavi",
  "Theo Halm",
  "Thies Groenewold",
  "Thore Daalmeyer",
  "Tino Brinker",
  "Tomke Eden",
  "Viktor Scholz",
  "Wiebke Straat",
  "Zino Ley",
  "Zoe Kunanz"
];

function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/ä/g, "ae")
    .replace(/ö/g, "oe")
    .replace(/ü/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export async function GET(req: NextRequest) {
  const secret = process.env.ADMIN_SEED_SECRET;
  const urlSecret = req.nextUrl.searchParams.get("secret");

  if (!secret || !urlSecret || urlSecret !== secret) {
    return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
  }

  const supabase = createSupabaseServiceRoleClient();
  const created: string[] = [];
  const skipped: string[] = [];
  const errors: string[] = [];

  const { data: listData } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 1000
  });
  const existingEmails = new Set((listData?.users ?? []).map((u) => u.email?.toLowerCase()));

  for (const fullName of COHORT_NAMES) {
    const email = `${slugify(fullName)}@abi-orga.local`;
    const password = `Abi2026-${slugify(fullName).slice(0, 8)}!`;

    try {
      if (existingEmails.has(email)) {
        const user = listData?.users?.find((u) => u.email?.toLowerCase() === email);
        if (user) {
          await supabase.from("profiles").upsert(
            { id: user.id, full_name: fullName, role: "member" },
            { onConflict: "id" }
          );
        }
        skipped.push(fullName);
        continue;
      }

      const { data: newUser, error } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (error) {
        errors.push(`${fullName}: ${error.message}`);
        continue;
      }
      if (!newUser?.user) {
        errors.push(`${fullName}: Kein User zurückgegeben`);
        continue;
      }

      existingEmails.add(email);

      const { error: profileError } = await supabase.from("profiles").insert({
        id: newUser.user.id,
        full_name: fullName,
        role: "member"
      });

      if (profileError) {
        errors.push(`${fullName}: Profil ${profileError.message}`);
      } else {
        created.push(fullName);
      }
    } catch (e) {
      errors.push(`${fullName}: ${String(e)}`);
    }
  }

  return NextResponse.json({
    message: "Cohort-Seed abgeschlossen.",
    created: created.length,
    skipped: skipped.length,
    createdNames: created,
    skippedNames: skipped,
    errors: errors.length ? errors : undefined
  });
}
