// PROTOTYPE — throwaway Knock spike page at /prototype/knock-spike.
// Answers "Does Knock hold up against Cadence?" (4 checks). Never merge.
import { useCallback, useEffect, useState } from "react";
import { Form, useActionData, useNavigation } from "react-router";
import type { Route } from "./+types/PROTOTYPE.knock-spike";
import { db } from "~/db";
import { users } from "~/db/schema";
import { eq } from "drizzle-orm";
import { getCurrentUserId } from "~/lib/session";
import {
  NEW_ENROLLMENT_CATEGORY,
  WORKFLOWS,
  identify,
  knock,
  knockEnv,
  knockUserId,
  tokenFor,
} from "~/lib/PROTOTYPE-knock-spike.server";

export async function loader({ request }: Route.LoaderArgs) {
  const env = knockEnv();
  const allUsers = db
    .select({ id: users.id, name: users.name, email: users.email, role: users.role })
    .from(users)
    .all();
  const userId = await getCurrentUserId(request);
  const me = allUsers.find((u) => u.id === userId) ?? null;
  if (!me || env.missing.length) {
    return { me, allUsers, env, token: null, error: null };
  }
  try {
    await identify(me);
    const token = await tokenFor(me.id);
    return { me, allUsers, env, token, error: null };
  } catch (e) {
    return { me, allUsers, env, token: null, error: String(e) };
  }
}

export async function action({ request }: Route.ActionArgs) {
  const form = await request.formData();
  const intent = String(form.get("intent"));
  const userId = await getCurrentUserId(request);
  const actor = userId
    ? db.select().from(users).where(eq(users.id, userId)).get()
    : undefined;
  const recipientId = Number(form.get("recipientId"));
  const recipient = db.select().from(users).where(eq(users.id, recipientId)).get();
  if (!recipient) return { ok: false, intent, result: "pick a recipient" };

  const inline = (u: typeof recipient) => ({
    id: knockUserId(u.id),
    name: u.name,
    email: u.email,
  });

  try {
    if (intent === "trigger-reply" || intent === "trigger-enrollment") {
      const key =
        intent === "trigger-reply" ? WORKFLOWS.discussionReply : WORKFLOWS.newEnrollment;
      const res = await knock().workflows.trigger(key, {
        recipients: [inline(recipient)],
        actor: actor ? inline(actor) : undefined,
        data:
          intent === "trigger-reply"
            ? {
                question_title: "How do I deploy the app?",
                reply_excerpt: "Run npm run build, then npm start.",
                url: "/instructor/questions",
              }
            : { course_title: "Spike Course 101", url: "/instructor" },
      });
      return { ok: true, intent, result: res };
    }
    if (intent === "server-prefs") {
      // What Knock will evaluate for this recipient (user set; env default applies underneath).
      const res = await knock().users.getPreferences(knockUserId(recipient.id), "default");
      return { ok: true, intent, result: res };
    }
    if (intent === "clear-prefs") {
      // Wipe the user's own set so only the environment default applies.
      await knock()
        .users.unsetPreferences(knockUserId(recipient.id), "default")
        .catch((e: any) => {
          if (e?.status !== 404) throw e; // nothing to clear yet
        });
      return { ok: true, intent, result: "unset" };
    }
    return { ok: false, intent, result: "unknown intent" };
  } catch (e) {
    return { ok: false, intent, result: String(e) };
  }
}

const API = "https://api.knock.app/v1";

type FeedState = {
  status: number;
  unread: number | null;
  unseen: number | null;
  entries: { id: string; read_at: string | null; seen_at: string | null; html: string; inserted_at: string; workflow: string }[];
  raw?: unknown;
};

export default function KnockSpike({ loaderData }: Route.ComponentProps) {
  const { me, allUsers, env, token, error } = loaderData;
  const actionData = useActionData<typeof action>();
  const nav = useNavigation();
  const [feed, setFeed] = useState<FeedState | null>(null);
  const [prefs, setPrefs] = useState<unknown>(null);
  const [log, setLog] = useState<string[]>([]);
  const [otherUserId, setOtherUserId] = useState<string>("");

  const say = (s: string) =>
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${s}`, ...l].slice(0, 30));

  const call = useCallback(
    async (path: string, init: RequestInit = {}) => {
      const res = await fetch(`${API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${env.publicKey}`,
          "X-Knock-User-Token": token ?? "",
          "Content-Type": "application/json",
          ...(init.headers ?? {}),
        },
      });
      const body = await res.json().catch(() => null);
      return { status: res.status, body };
    },
    [env.publicKey, token],
  );

  const loadFeed = useCallback(async () => {
    if (!me || !token) return;
    const { status, body } = await call(
      `/users/${knockUserId(me.id)}/feeds/${env.feedChannelId}?page_size=20`,
    );
    setFeed({
      status,
      unread: body?.meta?.unread_count ?? null,
      unseen: body?.meta?.unseen_count ?? null,
      entries: (body?.entries ?? []).map((e: any) => ({
        id: e.id,
        read_at: e.read_at,
        seen_at: e.seen_at,
        inserted_at: e.inserted_at,
        workflow: e.source?.key,
        html: e.blocks?.find((b: any) => b.name === "body")?.rendered ?? JSON.stringify(e.data),
      })),
      raw: status >= 400 ? body : undefined,
    });
  }, [call, me, token, env.feedChannelId]);

  const loadPrefs = useCallback(async () => {
    if (!me || !token) return;
    const { status, body } = await call(`/users/${knockUserId(me.id)}/preferences/default`);
    setPrefs({ status, body });
  }, [call, me, token]);

  useEffect(() => {
    setFeed(null);
    setPrefs(null);
    loadFeed();
    loadPrefs();
    const t = setInterval(loadFeed, 4000);
    return () => clearInterval(t);
  }, [loadFeed, loadPrefs]);

  const mark = async (status: "read" | "seen" | "unread", ids: string[]) => {
    if (!ids.length) return;
    const r = await call(`/messages/batch/${status}`, {
      method: "POST",
      body: JSON.stringify({ message_ids: ids }),
    });
    say(`batch/${status} ${ids.length} msg → ${r.status}`);
    loadFeed();
  };

  const setEnrollmentPref = async (on: boolean) => {
    if (!me) return;
    const r = await call(`/users/${knockUserId(me.id)}/preferences/default`, {
      method: "PUT",
      body: JSON.stringify({
        __persistence_strategy__: "merge",
        categories: { [NEW_ENROLLMENT_CATEGORY]: { channel_types: { in_app_feed: on } } },
      }),
    });
    say(`client PUT prefs new-enrollment.in_app_feed=${on} → ${r.status}`);
    loadPrefs();
  };

  const tryOtherFeed = async () => {
    if (!otherUserId) return;
    const r = await call(`/users/${otherUserId}/feeds/${env.feedChannelId}`);
    say(`read user ${otherUserId}'s feed with MY token → ${r.status} ${JSON.stringify(r.body)?.slice(0, 120)}`);
  };

  const tryNoToken = async () => {
    if (!me) return;
    const r = await fetch(`${API}/users/${knockUserId(me.id)}/feeds/${env.feedChannelId}`, {
      headers: { Authorization: `Bearer ${env.publicKey}` },
    });
    say(`feed with NO user token → ${r.status}`);
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-6 font-mono text-sm">
      <div className="rounded border-2 border-dashed border-amber-500 bg-amber-50 p-3 text-amber-900">
        PROTOTYPE — Knock spike. Throwaway; lives on <b>prototype/knock-spike</b> only.
      </div>

      <section>
        <h2 className="text-lg font-bold">State</h2>
        <pre className="overflow-auto rounded bg-muted p-2">
          {JSON.stringify(
            {
              currentUser: me,
              knockUserId: me ? knockUserId(me.id) : null,
              envMissing: env.missing,
              tokenHeader: token ? JSON.parse(atob(token.split(".")[0])) : null,
              tokenClaims: token ? JSON.parse(atob(token.split(".")[1])) : null,
              loaderError: error,
            },
            null,
            2,
          )}
        </pre>
        {!me && <p className="text-red-600">Select a user in the DevUI panel.</p>}
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">
          Check 1 + 3 — my feed (headless API, public key + signed token)
        </h2>
        <div className="flex flex-wrap gap-2">
          <button className="rounded border px-2" onClick={loadFeed}>refresh feed</button>
          <button className="rounded border px-2" onClick={() => mark("seen", feed?.entries.filter((e) => !e.seen_at).map((e) => e.id) ?? [])}>mark all seen</button>
          <button className="rounded border px-2" onClick={() => mark("read", feed?.entries.filter((e) => !e.read_at).map((e) => e.id) ?? [])}>mark all read</button>
          <button className="rounded border px-2" onClick={tryNoToken}>negative: no token</button>
          <select className="border" value={otherUserId} onChange={(e) => setOtherUserId(e.target.value)}>
            <option value="">another user…</option>
            {allUsers.filter((u) => u.id !== me?.id).map((u) => (
              <option key={u.id} value={knockUserId(u.id)}>{u.name} ({u.role})</option>
            ))}
          </select>
          <button className="rounded border px-2" onClick={tryOtherFeed}>negative: read their feed with my token</button>
        </div>
        <p>
          HTTP {feed?.status ?? "…"} · unread_count <b>{feed?.unread ?? "?"}</b> · unseen_count{" "}
          <b>{feed?.unseen ?? "?"}</b> · entries {feed?.entries.length ?? "?"}
        </p>
        {feed?.raw ? <pre className="text-red-600">{JSON.stringify(feed.raw)}</pre> : null}
        <ul className="space-y-1">
          {feed?.entries.map((e) => (
            <li key={e.id} className={`rounded border p-2 ${e.read_at ? "opacity-60" : "border-blue-500"}`}>
              <div className="flex justify-between">
                <span>[{e.workflow}] {e.inserted_at}</span>
                <span>
                  seen:{e.seen_at ? "✓" : "✗"} read:{e.read_at ? "✓" : "✗"}{" "}
                  <button className="underline" onClick={() => mark(e.read_at ? "unread" : "read", [e.id])}>
                    {e.read_at ? "mark unread" : "mark read"}
                  </button>
                </span>
              </div>
              <div dangerouslySetInnerHTML={{ __html: e.html }} />
            </li>
          ))}
        </ul>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Check 2 + 4 — trigger (server, Node SDK + secret key)</h2>
        <Form method="post" className="flex flex-wrap items-center gap-2">
          <select name="recipientId" className="border" defaultValue={me?.id}>
            {allUsers.map((u) => (
              <option key={u.id} value={u.id}>{u.name} ({u.role})</option>
            ))}
          </select>
          <button className="rounded border px-2" name="intent" value="trigger-reply">Discussion Reply → recipient</button>
          <button className="rounded border px-2" name="intent" value="trigger-enrollment">new Enrollment → recipient</button>
          <button className="rounded border px-2" name="intent" value="server-prefs">show recipient prefs (server)</button>
          <button className="rounded border px-2" name="intent" value="clear-prefs">clear recipient's own prefs</button>
        </Form>
        <pre className="max-h-64 overflow-auto rounded bg-muted p-2">
          {nav.state !== "idle" ? "…" : JSON.stringify(actionData ?? null, null, 2)}
        </pre>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-bold">Check 4 — my preferences (client, signed token)</h2>
        <div className="flex gap-2">
          <button className="rounded border px-2" onClick={() => setEnrollmentPref(true)}>opt IN to new Enrollment (feed)</button>
          <button className="rounded border px-2" onClick={() => setEnrollmentPref(false)}>opt OUT</button>
          <button className="rounded border px-2" onClick={loadPrefs}>refresh</button>
        </div>
        <pre className="max-h-64 overflow-auto rounded bg-muted p-2">{JSON.stringify(prefs, null, 2)}</pre>
      </section>

      <section>
        <h2 className="text-lg font-bold">Log</h2>
        <pre className="rounded bg-muted p-2">{log.join("\n") || "—"}</pre>
      </section>
    </div>
  );
}
