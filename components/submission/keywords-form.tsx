"use client";

import Link from "@/components/site/link";
import { useActionState } from "react";
import { saveKeywords, type ActionState } from "@/lib/submission/actions";
import { card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { useT } from "@/lib/i18n/client";

/** SB04: optional own keywords (the venue keyword priorities are on the Details step). */
export function KeywordsForm({ id, venueName, groups, initial, own }: { id: string; venueName: string; groups: { group: string; keywords: string[] }[]; initial: string[]; own: string[] }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveKeywords, {});
  const err = state.fieldErrors?.keywords;

  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      {/* The keyword priorities are set on the Details step (between title and abstract); kept as they are here. */}
      {initial.map((k) => <input key={k} type="hidden" name="keyword" value={k} />)}
      {err ? <p role="alert" className="mb-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{t(err)} <Link href={`/submissions/${id}/details`} className="font-semibold text-[#2F5FD0]">{t("Go to Details")}</Link></p> : null}
      <section className={card}>
        <h2 className={h2}>{t("Your own keywords")} <span className="font-sans text-[14px] text-[#4A5263]">{t("(optional)")}</span></h2>
        <label htmlFor="sb4-own" className="mt-1 block text-[#4A5263]">{t("Up to 5, separated by commas. Printed on the paper's page; not used for matching.")}</label>
        <input id="sb4-own" name="own" defaultValue={own.join(", ")} placeholder={t("e.g. ocean currents, backstepping, sea trials")} className="mt-3 h-12 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[16px]" />
      </section>

      {state.error ? <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{t(state.error)}</p> : null}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] pt-6">
        <div className="flex gap-2">
          <Link href={`/submissions/${id}/authors`} className={ghostBtn}>{t("← Back")}</Link>
          <button type="submit" name="intent" value="exit" className={`${ghostBtn} hidden sm:inline-flex`}>{t("Save and exit")}</button>
        </div>
        <button type="submit" name="intent" value="next" disabled={pending} className={primaryBtn}>{pending ? t("Saving…") : t("Continue to upload →")}</button>
      </div>
    </form>
  );
}
