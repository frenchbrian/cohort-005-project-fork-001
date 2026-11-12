// PROTOTYPE, throwaway. Never merge.
// For "What does the Notification Feed look like in Cadence?".
// 1. Upserts an in-app-only workflow per v1 Notification in Knock Development (Management API,
//    needs KNOCK_SERVICE_TOKEN). 2. Identifies a few DevUI users and triggers sample Notifications
//    so the Feed variants have real data. Run: npx tsx scripts/PROTOTYPE-feed-seed.ts
import Knock from "@knocklabs/node";

process.loadEnvFile();

const MAPI = "https://control.knock.app/v1";
const h = {
  Authorization: `Bearer ${process.env.KNOCK_SERVICE_TOKEN}`,
  "Content-Type": "application/json",
};

const workflows = [
  {
    key: "refund-request-approved",
    name: "Refund Request approved",
    body: "Your Refund Request for **{{ data.course_title }}** was approved.{% if data.note != blank %} \"{{ data.note }}\"{% endif %}",
  },
  {
    key: "refund-request-declined",
    name: "Refund Request declined",
    body: "Your Refund Request for **{{ data.course_title }}** was declined.{% if data.note != blank %} \"{{ data.note }}\"{% endif %} You can ask again.",
  },
  {
    key: "refund-request-opened",
    name: "New Open Refund Request",
    body: "**{{ actor.name }}** asked for a refund of {{ data.amount }} for **{{ data.course_title }}**: {{ data.reason }}",
  },
  {
    key: "seat-claimed",
    name: "Seat claimed",
    body: "**{{ actor.name }}** claimed a Seat for **{{ data.course_title }}**. {{ data.seats_left }} Seats left.",
  },
  {
    key: "new-enrollment",
    name: "New Enrollment",
    body: "**{{ actor.name }}** enrolled in **{{ data.course_title }}**.",
  },
  {
    key: "discussion-question",
    name: "New Discussion Question",
    body: "**{{ actor.name }}** asked a question on **{{ data.lesson_title }}**: {{ data.snippet }}",
  },
  {
    key: "discussion-reply",
    name: "Discussion Reply",
    body: "**{{ actor.name }}** replied to your question on **{{ data.lesson_title }}**: {{ data.snippet }}",
  },
];

async function upsertWorkflows() {
  for (const w of workflows) {
    const cat = await fetch(`${MAPI}/preference_categories/${w.key}`, { method: "PUT", headers: h });
    const res = await fetch(
      `${MAPI}/workflows/${w.key}?environment=development&commit=true&commit_message=${encodeURIComponent("PROTOTYPE notification feed")}`,
      {
        method: "PUT",
        headers: h,
        body: JSON.stringify({
          workflow: {
            name: w.name,
            categories: [w.key],
            steps: [
              {
                type: "channel",
                ref: "in_app_feed_1",
                channel_key: "in-app",
                template: { markdown_body: w.body, action_url: "{{ data.url }}" },
              },
            ],
          },
        }),
      },
    );
    console.log(w.key, "category", cat.status, "workflow", res.status, res.ok ? "" : (await res.text()).slice(0, 300));
  }
}

const knock = new Knock({ apiKey: process.env.KNOCK_SECRET_API_KEY });
const u = (id: number, name: string, email: string) => ({ id: String(id), name, email });
const alex = u(1, "Alex Rivera", "alex.rivera@ralph.dev");
const sarah = u(2, "Sarah Chen", "sarah.chen@ralph.dev");
const emma = u(5, "Emma Wilson", "emma.wilson@student.dev");
const james = u(6, "James Park", "james.park@student.dev");
const olivia = u(7, "Olivia Martinez", "olivia.martinez@student.dev");
const liam = u(8, "Liam Thompson", "liam.thompson@student.dev");
const bossy = u(10, "Bossy McBossface", "bossy.mcbossface@student.dev");
const ava = u(11, "Ava Nakamura", "ava.nakamura@student.dev");
const marta = u(44, "Marta Novak", "marta.novak@student.dev");

const TS = "Introduction to TypeScript";
const TW = "Design Systems with Tailwind";
const lessonUrl = "/courses/introduction-to-typescript/lessons/2";

type T = [key: string, recipient: ReturnType<typeof u>, actor: ReturnType<typeof u> | null, data: Record<string, unknown>];

const triggers: T[] = [
  // Emma (Student): buyer + question author
  ["refund-request-declined", emma, alex, { course_title: TW, note: "Past the 30-day window.", url: "/settings#refund-requests" }],
  ["discussion-reply", emma, sarah, { lesson_title: "Installing and Configuring TypeScript", snippet: "Run npx tsc --init and set strict to true. That's the bit that trips most people up.", url: lessonUrl }],
  ["discussion-reply", emma, james, { lesson_title: "Installing and Configuring TypeScript", snippet: "Same problem here, the fix above worked for me.", url: lessonUrl }],
  ["refund-request-approved", emma, alex, { course_title: TS, note: "", url: "/settings#refund-requests" }],
  // Sarah (Instructor)
  ["new-enrollment", sarah, olivia, { course_title: TS, url: "/instructor/1/students" }],
  ["discussion-question", sarah, emma, { lesson_title: "Installing and Configuring TypeScript", snippet: "tsc says it can't find my tsconfig even though it's in the root. What am I missing?", url: lessonUrl }],
  ["discussion-question", sarah, liam, { lesson_title: "Your First TypeScript Program", snippet: "Why does the compiled JS still have the comments?", url: "/courses/introduction-to-typescript/lessons/3" }],
  ["new-enrollment", sarah, james, { course_title: TW, url: "/instructor/3/students" }],
  // Alex (Platform Admin)
  ["refund-request-opened", alex, emma, { course_title: TW, amount: "$49.00", reason: "The course wasn't what I expected.", url: "/admin/refunds" }],
  ["refund-request-opened", alex, bossy, { course_title: TS, amount: "$450.00", reason: "Team was restructured, we no longer need the Seats.", url: "/admin/refunds" }],
  // Bossy (Team Admin)
  ["seat-claimed", bossy, ava, { course_title: TS, seats_left: 4, url: "/team" }],
  ["seat-claimed", bossy, marta, { course_title: TS, seats_left: 3, url: "/team" }],
];

async function seed() {
  for (const p of [alex, sarah, emma, james, olivia, liam, bossy, ava, marta]) {
    await knock.users.update(p.id, { name: p.name, email: p.email });
  }
  // Sarah has opted into New Enrollment (Feed) so the prototype shows those rows.
  await knock.users.setPreferences(sarah.id, "default", {
    __persistence_strategy__: "merge",
    categories: { "new-enrollment": { channel_types: { in_app_feed: true } } },
  } as any);
  for (const [key, recipient, actor, data] of triggers) {
    const res = await knock.workflows.trigger(key, { recipients: [recipient], actor: actor ?? undefined, data });
    console.log("trigger", key, "→", recipient.name, res.workflow_run_id);
    await new Promise((r) => setTimeout(r, 400)); // keep feed order stable
  }
}

if (!process.argv.includes("--no-workflows")) await upsertWorkflows();
await seed();
