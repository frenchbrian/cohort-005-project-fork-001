// PROTOTYPE, throwaway. Never merge.
// Headless Knock feed client shared by every variant: list, counts, seen/read/unread/archive.
import { useCallback, useEffect, useState } from "react";
import type { FeedConfig } from "~/lib/PROTOTYPE-notification-feed.server";

const API = "https://api.knock.app/v1";

export type FeedItem = {
  id: string;
  workflow: string;
  html: string;
  url: string | null;
  actorName: string | null;
  insertedAt: string;
  seenAt: string | null;
  readAt: string | null;
};

export type Feed = ReturnType<typeof useFeed>;

export function useFeed(config: FeedConfig | null) {
  const [items, setItems] = useState<FeedItem[]>([]);
  const [unread, setUnread] = useState(0);
  const [unseen, setUnseen] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const call = useCallback(
    async (path: string, init: RequestInit = {}) => {
      if (!config) return null;
      const res = await fetch(`${API}${path}`, {
        ...init,
        headers: {
          Authorization: `Bearer ${config.publicKey}`,
          "X-Knock-User-Token": config.token,
          "Content-Type": "application/json",
        },
      });
      if (!res.ok) {
        setError(`${res.status} ${path}`);
        return null;
      }
      return res.json();
    },
    [config],
  );

  const refresh = useCallback(async () => {
    if (!config) return;
    const body = await call(`/users/${config.userId}/feeds/${config.channelId}?page_size=30`);
    if (!body) return;
    setError(null);
    setUnread(body.meta?.unread_count ?? 0);
    setUnseen(body.meta?.unseen_count ?? 0);
    setItems(
      (body.entries ?? []).map((e: any) => {
        const blocks = e.blocks ?? [];
        return {
          id: e.id,
          workflow: e.source?.key ?? "",
          html: blocks.find((b: any) => b.name === "body")?.rendered ?? "",
          url: blocks.find((b: any) => b.name === "action_url")?.rendered ?? e.data?.url ?? null,
          actorName: e.actors?.[0]?.name ?? null,
          insertedAt: e.inserted_at,
          seenAt: e.seen_at,
          readAt: e.read_at,
        };
      }),
    );
  }, [call, config]);

  useEffect(() => {
    setItems([]);
    refresh();
    const t = setInterval(refresh, 15000); // the real build would use Knock's realtime socket
    return () => clearInterval(t);
  }, [refresh]);

  const batch = useCallback(
    async (status: "seen" | "read" | "unread" | "archived", ids: string[]) => {
      if (!ids.length) return;
      await call(`/messages/batch/${status}`, {
        method: "POST",
        body: JSON.stringify({ message_ids: ids }),
      });
      await refresh();
    },
    [call, refresh],
  );

  return {
    enabled: !!config,
    items,
    unread,
    unseen,
    error,
    refresh,
    markAllSeen: () => batch("seen", items.filter((i) => !i.seenAt).map((i) => i.id)),
    markAllRead: () => batch("read", items.filter((i) => !i.readAt).map((i) => i.id)),
    markRead: (id: string) => batch("read", [id]),
    markUnread: (id: string) => batch("unread", [id]),
    archive: (id: string) => batch("archived", [id]),
  };
}

export const WORKFLOW_LABELS: Record<string, string> = {
  "refund-request-approved": "Refund approved",
  "refund-request-declined": "Refund declined",
  "refund-request-opened": "Refund Request",
  "seat-claimed": "Seat claimed",
  "new-enrollment": "New Enrollment",
  "discussion-question": "Discussion Question",
  "discussion-reply": "Discussion Reply",
};

export function timeAgo(iso: string) {
  const s = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}
