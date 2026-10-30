"use client";

import { asideCard, kicker } from "@/components/submission/shell";
import { usePick } from "@/components/submission/type-pick";
import { useT } from "@/lib/i18n/client";

/** What the "Your choice" card shows for one submission type (prepared on the server from Supabase). */
export type ChoiceInfo = { label: string; pages: string | null; review: string | null; opens: string | null; deadline: string | null };

/** "Your choice": the type and track picked in the form beside it, with that type's own pages, review and dates. */
export function ChoiceCard({ info, initialType, initialTrack }: { info: Record<string, ChoiceInfo>; initialType: string | null; initialTrack: string | null }) {
  const t = useT();
  const { type, track } = usePick({ type: initialType, track: initialTrack });
  const names = Object.keys(info);
  const name = type && info[type] ? type : names[0];
  const ty = name ? info[name] : null;
  return (
    <section className={asideCard}>
      <p className={kicker}>{t("Your choice")}</p>
      <div className="mt-2 text-[17px] font-semibold">{ty?.label ?? t("Regular paper")}</div>
      <dl className="m-0 mt-2.5 grid grid-cols-[80px_1fr] gap-y-1.5 text-[14px]">
        <dt className="text-[#4A5263]">{t("Pages")}</dt><dd className="m-0">{ty?.pages ?? "—"}</dd>
        <dt className="text-[#4A5263]">{t("Review")}</dt><dd className="m-0">{ty?.review ? t(ty.review) : "—"}</dd>
        {ty?.opens ? <><dt className="text-[#4A5263]">{t("Open")}</dt><dd className="m-0">{ty.opens}</dd></> : null}
        <dt className="text-[#4A5263]">{t("Deadline")}</dt><dd className="m-0">{ty?.deadline ?? t("Rolling")}</dd>
        <dt className="text-[#4A5263]">{t("Track")}</dt><dd className="m-0">{track ? t(track) : t("Not chosen yet")}</dd>
      </dl>
    </section>
  );
}
