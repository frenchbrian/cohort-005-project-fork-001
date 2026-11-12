// PROTOTYPE — runs the four Knock checks end to end, in-process. It calls the
// spike route's real loader and action with a real DevUI session cookie (no dev
// server needed), then calls Knock the way the browser would. Throwaway; never merge.
process.loadEnvFile();
import { loader, action } from "../app/routes/PROTOTYPE.knock-spike";
import { setCurrentUserId } from "../app/lib/session";

const KAPI = "https://api.knock.app/v1";
const PK = process.env.KNOCK_PUBLIC_API_KEY!;
const FEED = process.env.KNOCK_FEED_CHANNEL_ID!;

const STUDENT = 5; // Emma Wilson
const OTHER_STUDENT = 6; // James Park
const INSTRUCTOR = 3; // Marcus Johnson

const results: { check: string; pass: boolean; detail: string }[] = [];
const record = (check: string, pass: boolean, detail: string) => {
  results.push({ check, pass, detail });
  console.log(`${pass ? "PASS" : "FAIL"}  ${check} — ${detail}`);
};
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const BASE = "http://cadence.local/prototype/knock-spike";

// Same cookie the DevUI switcher sets via /api/switch-user.
async function switchUser(userId: number) {
  const setCookie = await setCurrentUserId(new Request(BASE), userId);
  return setCookie.split(";")[0];
}

async function tokenFromPage(cookie: string) {
  const data: any = await loader({ request: new Request(BASE, { headers: { cookie } }) } as any);
  const jwt: string | null = data.token;
  if (!jwt) throw new Error(`loader gave no token: ${data.error ?? JSON.stringify(data.env.missing)}`);
  const [h, p] = jwt.split(".").slice(0, 2).map((s) => JSON.parse(Buffer.from(s, "base64url").toString()));
  return { jwt, header: h, claims: p };
}

async function appAction(cookie: string, intent: string, recipientId: number) {
  const req = new Request(BASE, {
    method: "POST",
    headers: { cookie },
    body: new URLSearchParams({ intent, recipientId: String(recipientId) }),
  });
  const res: any = await action({ request: req } as any);
  if (!res.ok) throw new Error(`action ${intent}: ${JSON.stringify(res.result)}`);
  return 200;
}

const knock = (jwt: string | null, path: string, init: RequestInit = {}) =>
  fetch(`${KAPI}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${PK}`,
      ...(jwt ? { "X-Knock-User-Token": jwt } : {}),
      "Content-Type": "application/json",
    },
  }).then(async (r) => ({ status: r.status, body: await r.json().catch(() => null) }));

const feed = (jwt: string | null, userId: number) =>
  knock(jwt, `/users/${userId}/feeds/${FEED}?page_size=50`);

async function waitForEntry(jwt: string, userId: number, workflow: string, since: string, ms = 20000) {
  const end = Date.now() + ms;
  while (Date.now() < end) {
    const f = await feed(jwt, userId);
    const hit = f.body?.entries?.find(
      (e: any) => e.source?.key === workflow && e.inserted_at > since,
    );
    if (hit) return hit;
    await sleep(1500);
  }
  return null;
}

// ── Check 1: signed user tokens, follow the DevUI user ──
const studentCookie = await switchUser(STUDENT);
const studentTok = await tokenFromPage(studentCookie);
const otherCookie = await switchUser(OTHER_STUDENT);
const otherTok = await tokenFromPage(otherCookie);
record(
  "1a token is RS256 and follows the DevUI user",
  studentTok.header.alg === "RS256" &&
    studentTok.claims.sub === String(STUDENT) &&
    otherTok.claims.sub === String(OTHER_STUDENT),
  `alg=${studentTok.header.alg}, subs=${studentTok.claims.sub}/${otherTok.claims.sub}`,
);
const own = await feed(studentTok.jwt, STUDENT);
record("1b own feed readable with signed token", own.status === 200, `HTTP ${own.status}`);
const none = await feed(null, STUDENT);
record("1c feed rejected with no token", none.status >= 400, `HTTP ${none.status} ${none.body?.code ?? ""}`);
const cross = await feed(studentTok.jwt, OTHER_STUDENT);
record("1d another user's feed rejected with my token", cross.status >= 400, `HTTP ${cross.status} ${cross.body?.code ?? ""}`);

// ── Check 2: trigger Discussion Reply through the app's server action (Node SDK) ──
let since = new Date().toISOString();
const trig = await appAction(otherCookie, "trigger-reply", STUDENT); // James replies to Emma
const reply = await waitForEntry(studentTok.jwt, STUDENT, "discussion-reply", since);
record(
  "2  Discussion Reply triggered via Node SDK lands in recipient's feed",
  trig === 200 && !!reply,
  `action HTTP ${trig}; entry ${reply ? reply.id : "not found in 20s"}; body: ${reply?.blocks?.find((b: any) => b.name === "body")?.rendered?.replace(/<[^>]+>/g, "").trim() ?? "-"}`,
);

// ── Check 3: headless feed API — list, unread count, mark seen/read ──
if (reply) {
  const before = (await feed(studentTok.jwt, STUDENT)).body.meta;
  const seen = await knock(studentTok.jwt, "/messages/batch/seen", { method: "POST", body: JSON.stringify({ message_ids: [reply.id] }) });
  const read = await knock(studentTok.jwt, "/messages/batch/read", { method: "POST", body: JSON.stringify({ message_ids: [reply.id] }) });
  const after = (await feed(studentTok.jwt, STUDENT)).body;
  const entry = after.entries.find((e: any) => e.id === reply.id);
  record(
    "3  list + unread/unseen counts + mark seen/read with the user token",
    seen.status === 200 && read.status === 200 && !!entry?.seen_at && !!entry?.read_at &&
      after.meta.unread_count === before.unread_count - 1 &&
      after.meta.unseen_count === before.unseen_count - 1,
    `seen ${seen.status}, read ${read.status}; unread ${before.unread_count}→${after.meta.unread_count}, unseen ${before.unseen_count}→${after.meta.unseen_count}`,
  );
} else {
  record("3  headless feed API", false, "skipped: no entry from check 2");
}

// ── Check 4: new Enrollment → Instructor, off by default, opt-in ──
const instrCookie = await switchUser(INSTRUCTOR);
await appAction(instrCookie, "clear-prefs", INSTRUCTOR); // brand-new recipient: no prefs at all
const instrTok = await tokenFromPage(instrCookie); // loader identifies → Cadence writes the default
since = new Date().toISOString();
await appAction(studentCookie, "trigger-enrollment", INSTRUCTOR);
const leaked = await waitForEntry(instrTok.jwt, INSTRUCTOR, "new-enrollment", since, 12000);
record(
  "4a off by default (Cadence writes it on first identify)",
  !leaked,
  leaked ? "DELIVERED: the default didn't hold" : "nothing delivered in 12s",
);

const optIn = await knock(instrTok.jwt, `/users/${INSTRUCTOR}/preferences/default`, {
  method: "PUT",
  body: JSON.stringify({
    __persistence_strategy__: "merge",
    categories: { "new-enrollment": { channel_types: { in_app_feed: true } } },
  }),
});
since = new Date().toISOString();
await appAction(studentCookie, "trigger-enrollment", INSTRUCTOR);
const delivered = await waitForEntry(instrTok.jwt, INSTRUCTOR, "new-enrollment", since);
record(
  "4b instructor opts in with own token, then receives it",
  optIn.status === 200 && !!delivered,
  `PUT prefs ${optIn.status}; entry ${delivered ? delivered.id : "not found in 20s"}`,
);

// Re-identify (instructor loads a page again) must not wipe the opt-in.
await tokenFromPage(instrCookie);
since = new Date().toISOString();
await appAction(studentCookie, "trigger-enrollment", INSTRUCTOR);
const again = await waitForEntry(instrTok.jwt, INSTRUCTOR, "new-enrollment", since);
record("4c opt-in survives re-identify", !!again, again ? `entry ${again.id}` : "not found in 20s");

await appAction(instrCookie, "clear-prefs", INSTRUCTOR); // leave the instructor clean

console.log(`
${results.filter((r) => r.pass).length}/${results.length} passed`);
