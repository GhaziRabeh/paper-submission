"use client";

import Link from "@/components/site/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { startDraft } from "@/lib/submission/actions";
import { useT } from "@/lib/i18n/client";

/**
 * Coming from the event page's "How to submit" table (/submit/<event>?type=…): the type is already chosen, so the
 * "Venue & type" step is skipped — the draft is started with that type and the wizard opens on Details.
 * Started after the page shows (not while it renders), so a prefetch of the link never creates a draft.
 */
export function StartDraft({ venueId, type, label, chooseHref }: { venueId: string; type: string; label: string; chooseHref: string }) {
  const t = useT();
  const router = useRouter();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    startDraft(venueId, type).then((r) => {
      if ("id" in r) router.replace(`/submissions/${r.id}/details`);
      else setError(r.error);
    }).catch(() => setError("We couldn’t start your submission. Please try again."));
  }, [venueId, type, router]);
  if (error) {
    return (
      <div role="alert" className="rounded-[8px] border border-[#F3C3BE] bg-[#FDECEA] px-4 py-3.5 text-[15px] text-[#5C1A15]">
        <p className="m-0">{t(error)}</p>
        <Link href={chooseHref} className="mt-2 inline-block font-semibold text-[#2F5FD0]">{t("Choose the type yourself")}</Link>
      </div>
    );
  }
  return (
    <p role="status" className="m-0 flex items-center gap-3 rounded-[8px] border border-[#DADDE3] bg-white px-4 py-4 text-[15px]">
      <span aria-hidden className="size-4 flex-none animate-spin rounded-full border-2 border-[#DADDE3] border-t-[#0E1B3D]" />
      {t("Starting your {type}…", { type: label })}
    </p>
  );
}
