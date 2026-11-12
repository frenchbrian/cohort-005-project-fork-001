// PROTOTYPE, throwaway. Never merge.
// "What does the Notification Feed look like in Cadence?": three structurally different Feeds,
// mounted in the real app layout, switchable via ?variant=A|B|C (bottom bar, or ← →).
//   A  Bell popover: bell in the sidebar header, dropdown panel, badge = UNSEEN, opening marks all seen,
//      clicking a row marks it read and navigates.
//   B  Inbox page: "Notifications" sidebar item with an UNREAD pill, full page at /notifications with
//      All/Unread tabs, day groups, per-row read/unread + archive. Visiting the page marks all seen.
//   C  Slide-over drawer: bell in a slim top bar over the content, right-hand sheet with New / Earlier,
//      badge = UNREAD, clicking a row expands it; an explicit "Open" button navigates.
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router";
import {
  Archive,
  Bell,
  BellDot,
  Check,
  CircleDollarSign,
  MailOpen,
  MessageCircleQuestion,
  MessagesSquare,
  Settings,
  Ticket,
  UserPlus,
  X,
} from "lucide-react";
import { cn } from "~/lib/utils";
import { UserAvatar } from "~/components/user-avatar";
import { WORKFLOW_LABELS, timeAgo, type Feed, type FeedItem } from "./use-feed";

export const FeedContext = createContext<Feed | null>(null);
export const useFeedContext = () => useContext(FeedContext);

export const VARIANTS = [
  { key: "A", name: "Bell popover" },
  { key: "B", name: "Inbox page" },
  { key: "C", name: "Slide-over drawer" },
];

const ICONS: Record<string, React.ReactNode> = {
  "refund-request-approved": <CircleDollarSign className="size-4 text-emerald-600" />,
  "refund-request-declined": <CircleDollarSign className="size-4 text-rose-600" />,
  "refund-request-opened": <CircleDollarSign className="size-4 text-amber-600" />,
  "seat-claimed": <Ticket className="size-4 text-sky-600" />,
  "new-enrollment": <UserPlus className="size-4 text-violet-600" />,
  "discussion-question": <MessageCircleQuestion className="size-4 text-indigo-600" />,
  "discussion-reply": <MessagesSquare className="size-4 text-indigo-600" />,
};

function Body({ item, className }: { item: FeedItem; className?: string }) {
  return (
    <div
      className={cn("text-sm leading-snug [&_p]:inline [&_strong]:font-semibold", className)}
      dangerouslySetInnerHTML={{ __html: item.html }}
    />
  );
}

function Empty() {
  return (
    <div className="px-6 py-12 text-center text-sm text-muted-foreground">
      <Bell className="mx-auto mb-2 size-6 opacity-40" />
      You're all caught up.
    </div>
  );
}

function Badge({ n, className }: { n: number; className?: string }) {
  if (!n) return null;
  return (
    <span
      className={cn(
        "min-w-4 rounded-full bg-rose-600 px-1 text-center text-[10px] font-bold leading-4 text-white",
        className,
      )}
    >
      {n > 9 ? "9+" : n}
    </span>
  );
}

// ───────────────────────────── Variant A: Bell popover ─────────────────────────────

export function VariantABell() {
  const feed = useFeedContext();
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    feed?.markAllSeen();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!feed?.enabled) return null;

  return (
    <div ref={ref} className="relative ml-auto">
      <button
        onClick={() => setOpen((o) => !o)}
        title="Notifications"
        className="relative rounded-md p-1.5 text-sidebar-foreground/70 hover:bg-sidebar-accent"
      >
        <Bell className="size-4" />
        <Badge n={feed.unseen} className="absolute -right-1 -top-1" />
      </button>
      {open && (
        <div className="absolute left-0 top-9 z-50 w-96 overflow-hidden rounded-lg border bg-popover text-popover-foreground shadow-xl">
          <div className="flex items-center justify-between border-b px-4 py-2.5">
            <span className="text-sm font-semibold">Notifications</span>
            <button
              onClick={() => feed.markAllRead()}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Mark all as read
            </button>
          </div>
          <div className="max-h-[28rem] overflow-y-auto">
            {feed.items.length === 0 && <Empty />}
            {feed.items.map((item) => (
              <button
                key={item.id}
                onClick={async () => {
                  setOpen(false);
                  await feed.markRead(item.id);
                  if (item.url) navigate(item.url);
                }}
                className={cn(
                  "flex w-full gap-3 border-b px-4 py-3 text-left last:border-0 hover:bg-muted/60",
                  !item.readAt && "bg-primary/5",
                )}
              >
                <UserAvatar name={item.actorName ?? "Cadence"} avatarUrl={null} className="shrink-0" />
                <div className="min-w-0 flex-1">
                  <Body item={item} />
                  <div className="mt-1 text-xs text-muted-foreground">{timeAgo(item.insertedAt)}</div>
                </div>
                {!item.readAt && <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
          <Link
            to="/settings#notifications"
            onClick={() => setOpen(false)}
            className="flex items-center justify-center gap-1.5 border-t px-4 py-2 text-xs text-muted-foreground hover:text-foreground"
          >
            <Settings className="size-3" /> Notification settings
          </Link>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Variant B: Inbox page ─────────────────────────────

export function VariantBNavItem() {
  const feed = useFeedContext();
  if (!feed?.enabled) return null;
  return (
    <NavLink
      to="/notifications"
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
        )
      }
    >
      <Bell className="size-4" />
      Notifications
      {feed.unread > 0 && (
        <span className="ml-auto rounded-full bg-primary px-2 text-xs font-semibold text-primary-foreground">
          {feed.unread}
        </span>
      )}
    </NavLink>
  );
}

function dayGroup(iso: string) {
  const d = new Date(iso);
  const today = new Date();
  const y = new Date();
  y.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return "Today";
  if (d.toDateString() === y.toDateString()) return "Yesterday";
  return d.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" });
}

export function VariantBPage() {
  const feed = useFeedContext();
  const [tab, setTab] = useState<"all" | "unread">("all");
  const [type, setType] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (feed?.unseen) feed.markAllSeen();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [feed?.unseen]);

  if (!feed?.enabled) return <div className="p-8">Select a user in the DevUI panel.</div>;

  const types = [...new Set(feed.items.map((i) => i.workflow))];
  const shown = feed.items
    .filter((i) => tab === "all" || !i.readAt)
    .filter((i) => !type || i.workflow === type);
  const groups = shown.reduce<Record<string, FeedItem[]>>((acc, i) => {
    (acc[dayGroup(i.insertedAt)] ??= []).push(i);
    return acc;
  }, {});

  return (
    <div className="mx-auto max-w-3xl p-8">
      <div className="mb-6 flex items-end justify-between">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-muted-foreground">{feed.unread} unread</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => feed.markAllRead()} className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            Mark all as read
          </button>
          <Link to="/settings#notifications" className="rounded-md border px-3 py-1.5 text-sm hover:bg-muted">
            Settings
          </Link>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 border-b pb-3">
        {(["all", "unread"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "rounded-md px-3 py-1 text-sm capitalize",
              tab === t ? "bg-foreground text-background" : "text-muted-foreground hover:bg-muted",
            )}
          >
            {t}
          </button>
        ))}
        <span className="mx-2 h-5 w-px bg-border" />
        {types.map((t) => (
          <button
            key={t}
            onClick={() => setType(type === t ? null : t)}
            className={cn(
              "flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs",
              type === t ? "border-foreground" : "text-muted-foreground",
            )}
          >
            {ICONS[t]} {WORKFLOW_LABELS[t] ?? t}
          </button>
        ))}
      </div>

      {shown.length === 0 && <Empty />}
      {Object.entries(groups).map(([day, items]) => (
        <section key={day} className="mb-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">{day}</h2>
          <ul className="divide-y rounded-lg border">
            {items.map((item) => (
              <li key={item.id} className="group flex items-start gap-4 px-4 py-3 hover:bg-muted/40">
                <span
                  className={cn("mt-2 size-2 shrink-0 rounded-full", item.readAt ? "bg-transparent" : "bg-primary")}
                />
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={async () => {
                    await feed.markRead(item.id);
                    if (item.url) navigate(item.url);
                  }}
                >
                  <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {ICONS[item.workflow]} {WORKFLOW_LABELS[item.workflow]} · {timeAgo(item.insertedAt)}
                  </div>
                  <Body item={item} className={cn(item.readAt && "text-muted-foreground")} />
                </button>
                <div className="flex shrink-0 gap-1 opacity-0 group-hover:opacity-100">
                  <button
                    title={item.readAt ? "Mark as unread" : "Mark as read"}
                    onClick={() => (item.readAt ? feed.markUnread(item.id) : feed.markRead(item.id))}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    {item.readAt ? <BellDot className="size-4" /> : <MailOpen className="size-4" />}
                  </button>
                  <button
                    title="Archive"
                    onClick={() => feed.archive(item.id)}
                    className="rounded p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Archive className="size-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

// ───────────────────────────── Variant C: Slide-over drawer ─────────────────────────────

export function VariantCTopBar() {
  const feed = useFeedContext();
  const [open, setOpen] = useState(false);
  if (!feed?.enabled) return null;
  return (
    <>
      <div className="sticky top-0 z-30 flex h-12 items-center justify-end border-b bg-background/90 px-4 backdrop-blur">
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-2 rounded-full border px-3 py-1 text-sm hover:bg-muted"
        >
          <Bell className="size-4" />
          {feed.unread > 0 ? `${feed.unread} new` : "Notifications"}
        </button>
      </div>
      {open && <Drawer onClose={() => setOpen(false)} />}
    </>
  );
}

function Drawer({ onClose }: { onClose: () => void }) {
  const feed = useFeedContext()!;
  const [expanded, setExpanded] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    feed.markAllSeen();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fresh = feed.items.filter((i) => !i.readAt);
  const earlier = feed.items.filter((i) => i.readAt);

  const Row = ({ item }: { item: FeedItem }) => {
    const isOpen = expanded === item.id;
    return (
      <li className={cn("rounded-md border-l-2", item.readAt ? "border-transparent" : "border-primary")}>
        <button
          onClick={() => {
            setExpanded(isOpen ? null : item.id);
            if (!item.readAt) feed.markRead(item.id);
          }}
          className="flex w-full items-start gap-3 px-3 py-2 text-left hover:bg-muted/50"
        >
          <span className="mt-0.5">{ICONS[item.workflow]}</span>
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                {WORKFLOW_LABELS[item.workflow]}
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">{timeAgo(item.insertedAt)}</span>
            </div>
            <Body item={item} className={cn(!isOpen && "line-clamp-1")} />
          </div>
        </button>
        {isOpen && (
          <div className="flex gap-2 px-3 pb-3 pl-10">
            {item.url && (
              <button
                onClick={() => {
                  onClose();
                  navigate(item.url!);
                }}
                className="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground"
              >
                Open
              </button>
            )}
            <button onClick={() => feed.markUnread(item.id)} className="rounded-md border px-3 py-1 text-xs">
              Mark unread
            </button>
            <button onClick={() => feed.archive(item.id)} className="rounded-md border px-3 py-1 text-xs">
              Dismiss
            </button>
          </div>
        )}
      </li>
    );
  };

  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <aside className="absolute inset-y-0 right-0 flex w-[26rem] flex-col bg-background shadow-2xl">
        <div className="flex h-12 items-center justify-between border-b px-4">
          <span className="font-semibold">Notifications</span>
          <div className="flex items-center gap-1">
            <button
              title="Mark all as read"
              onClick={() => feed.markAllRead()}
              className="rounded p-1.5 text-muted-foreground hover:bg-muted"
            >
              <Check className="size-4" />
            </button>
            <Link
              to="/settings#notifications"
              onClick={onClose}
              title="Notification settings"
              className="rounded p-1.5 text-muted-foreground hover:bg-muted"
            >
              <Settings className="size-4" />
            </Link>
            <button onClick={onClose} className="rounded p-1.5 text-muted-foreground hover:bg-muted">
              <X className="size-4" />
            </button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-3">
          {feed.items.length === 0 && <Empty />}
          {fresh.length > 0 && (
            <>
              <h3 className="mb-1 px-3 text-xs font-semibold text-muted-foreground">New</h3>
              <ul className="mb-4 space-y-1">{fresh.map((i) => <Row key={i.id} item={i} />)}</ul>
            </>
          )}
          {earlier.length > 0 && (
            <>
              <h3 className="mb-1 px-3 text-xs font-semibold text-muted-foreground">Earlier</h3>
              <ul className="space-y-1">{earlier.map((i) => <Row key={i.id} item={i} />)}</ul>
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
