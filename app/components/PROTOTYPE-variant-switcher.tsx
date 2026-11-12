// PROTOTYPE, throwaway. Never merge. Floating bottom bar that cycles ?variant= (also ← / →).
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STORAGE_KEY = "PROTOTYPE-variant";

// URL param wins; otherwise the last pick, so the variant survives clicking through the app.
export function useVariant(keys: string[]) {
  const [params] = useSearchParams();
  const fromUrl = params.get("variant");
  const [stored, setStored] = useState<string | null>(null);
  useEffect(() => {
    if (fromUrl) sessionStorage.setItem(STORAGE_KEY, fromUrl);
    setStored(sessionStorage.getItem(STORAGE_KEY));
  }, [fromUrl]);
  const v = fromUrl ?? stored;
  return v && keys.includes(v) ? v : keys[0];
}

export function PrototypeSwitcher({
  variants,
  current,
}: {
  variants: { key: string; name: string }[];
  current: string;
}) {
  const [params, setParams] = useSearchParams();
  const idx = Math.max(0, variants.findIndex((v) => v.key === current));
  const go = (d: number) => {
    const next = variants[(idx + d + variants.length) % variants.length].key;
    sessionStorage.setItem(STORAGE_KEY, next);
    const p = new URLSearchParams(params);
    p.set("variant", next);
    setParams(p, { replace: true, preventScrollReset: true });
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select, [contenteditable]")) return;
      if (e.key === "ArrowLeft") go(-1);
      if (e.key === "ArrowRight") go(1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  if (import.meta.env.PROD) return null;

  return (
    <div className="fixed bottom-4 left-1/2 z-[60] flex -translate-x-1/2 items-center gap-1 rounded-full bg-black px-2 py-1.5 text-sm text-white shadow-2xl ring-2 ring-fuchsia-500">
      <button onClick={() => go(-1)} className="rounded-full p-1 hover:bg-white/20">
        <ChevronLeft className="size-4" />
      </button>
      <span className="min-w-44 text-center font-mono">
        PROTOTYPE {variants[idx].key} ({variants[idx].name})
      </span>
      <button onClick={() => go(1)} className="rounded-full p-1 hover:bg-white/20">
        <ChevronRight className="size-4" />
      </button>
    </div>
  );
}
