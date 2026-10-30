"use client";

import { useSyncExternalStore } from "react";

/*
 * The type and track picked on the "What are you submitting?" step (TypeForm), shared with the "Your choice" card
 * beside it (ChoiceCard), so the card follows each click. Kept in the address too (?type=), so a reload keeps it.
 */
type Pick = { type: string | null; track: string | null };
let pick: Pick = { type: null, track: null };
const listeners = new Set<() => void>();

export function setPick(next: Partial<Pick>) {
  pick = { ...pick, ...next };
  listeners.forEach((l) => l());
  if (next.type !== undefined && typeof window !== "undefined") {
    const url = new URL(window.location.href);
    if (next.type) url.searchParams.set("type", next.type);
    else url.searchParams.delete("type");
    window.history.replaceState(window.history.state, "", url);
  }
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** The current pick; before any click, the values the page was opened with. */
export function usePick(initial: Pick): Pick {
  const live = useSyncExternalStore(subscribe, () => pick, () => pick);
  return { type: live.type ?? initial.type, track: live.track ?? initial.track };
}
