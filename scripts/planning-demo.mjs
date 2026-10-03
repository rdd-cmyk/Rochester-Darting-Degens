// Creates synthetic local demo accounts and content; never a hosted target.
import { createClient } from "@supabase/supabase-js";
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
process.env.RDD_LOCAL_STACK = "league-planning";
const { localStatus, docker, projectId, root } = await import(
  "./local-environment.mjs"
);
const status = localStatus();
const password = "Local-Planning-Demo-2026!";
const accounts = [];
const unwrap = ({ data, error }) => {
  if (error) throw new Error(`${error.code}: ${error.message}`);
  return data;
};
for (const role of ["organizer", "member"]) {
  const email = `planning-${role}@example.test`;
  const db = createClient(status.API_URL, status.ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  let auth = await db.auth.signInWithPassword({ email, password });
  if (auth.error) auth = await db.auth.signUp({ email, password });
  const session = unwrap(auth);
  if (!session.session) throw new Error("Local demo must return a session.");
  const id = session.user.id;
  unwrap(
    await db
      .from("profiles")
      .upsert({
        id,
        display_name: role === "organizer" ? "Demo Organizer" : "Demo Player",
        include_first_name_in_display: false,
      }),
  );
  if (role === "organizer") {
    if (!/^[0-9a-f-]{36}$/.test(id))
      throw new Error("Invalid synthetic user ID.");
    docker([
      "exec",
      `supabase_db_${projectId}`,
      "psql",
      "-U",
      "postgres",
      "-v",
      "ON_ERROR_STOP=1",
      "-c",
      `INSERT INTO rdd_private.planning_organizers(user_id) VALUES ('${id}') ON CONFLICT DO NOTHING;`,
    ]);
    const feed = unwrap(await db.rpc("rdd_planning_read"));
    const wall = (days) =>
      new Date(Date.now() + days * 86400000).toISOString().slice(0, 10) +
      "T19:00";
    const write = async (action, payload) =>
      unwrap(
        await db.rpc("rdd_planning_write", {
          p_operation_id: crypto.randomUUID(),
          p_action: action,
          p_payload: { ...payload, actor_id: id },
        }),
      );
    if (
      !feed.polls.some((p) => p.title === "Choose our next league night (demo)")
    )
      await write("save_poll", {
        poll_id: crypto.randomUUID(),
        revision: 0,
        title: "Choose our next league night (demo)",
        scope: "both",
        publish: true,
        closes_local: wall(10),
        options: [
          { kind: "date", starts_local: wall(14) },
          { kind: "date", starts_local: wall(15) },
          { kind: "venue", venue: "The Double Bull (demo)" },
          { kind: "venue", venue: "Flight Clubhouse (demo)" },
        ],
      });
    if (!feed.nights.some((n) => n.title === "Darts & good company (demo)"))
      await write("schedule", {
        title: "Darts & good company (demo)",
        starts_local: wall(7),
        venue: "The Double Bull (demo)",
        notes:
          "Synthetic local example. Try Going / Not going, or explore the poll below.",
      });
  }
  accounts.push({ role, email });
}
mkdirSync(path.join(root, ".local"), { recursive: true });
writeFileSync(
  path.join(root, ".local", "planning-demo.md"),
  `# Local planning preview\n\nOpen http://127.0.0.1:3030/league-night/plan\n\nThese accounts exist only in the isolated local planning database.\n\n${accounts.map((a) => `- ${a.role}: ${a.email}`).join("\n")}\n- Password for both: ${password}\n\nThe organizer can create, close, edit and schedule. The member can vote, suggest up to two options, and RSVP.\n\nAll displayed demo venues and accounts are fictional. QA fixtures dated 2090 are also present; they can be ignored.\n`,
);
console.log(
  "Synthetic local demo ready. Login details saved in .local/planning-demo.md (ignored by Git).",
);
