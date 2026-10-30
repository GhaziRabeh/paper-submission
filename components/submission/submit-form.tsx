"use client";

import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { submitPaper, type ActionState } from "@/lib/submission/actions";
import { card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { useT } from "@/lib/i18n/client";

export function SubmitForm({ id, ready, resubmit, deadline = null }: { id: string; ready: boolean; resubmit: boolean; deadline?: string | null }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(submitPaper, {});
  const [a, setA] = useState(false), [b, setB] = useState(false), [c, setC] = useState(false);
  const [tried, setTried] = useState(false);
  return (
    <form action={action} onSubmit={(e) => { if (!a || !b || !c) { e.preventDefault(); setTried(true); } }}>
      <input type="hidden" name="submissionId" value={id} />
      {/* Before Confirm: what happens after submitting, and until when it can still be changed. */}
      <p role="note" className="m-0 mt-6 rounded-[8px] border border-[#D3DFFA] bg-[#F4F7FE] px-4 py-3 text-[15px] leading-[1.55] text-[#1F3B7A]">
        {deadline
          ? t("Please review the information carefully before you submit the paper. The corresponding author and all other authors will receive an acknowledgement by e-mail after the submission has been completed. To update the submission information or to re-upload the file after completing the submission log in with your PIN and password before the submission deadline {date}.", { date: deadline })
          : t("Please review the information carefully before you submit the paper. The corresponding author and all other authors will receive an acknowledgement by e-mail after the submission has been completed. To update the submission information or to re-upload the file after completing the submission log in with your PIN and password before the submission deadline.")}
      </p>
      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("Confirm")} <span className="text-[#B3261E]">*</span></h2>
        <p className="m-0 mt-1 text-[14px] text-[#4A5263]">{t("All three are required to submit.")}</p>
        <label className="mt-4 flex items-start gap-3"><input type="checkbox" name="agree" checked={a} onChange={(e) => setA(e.target.checked)} className="mt-1 size-[18px] flex-none accent-[#0E1B3D]" /><span>{t("All authors agree to this submission and its author order.")} <span className="text-[#B3261E]">*</span></span></label>
        <label className="mt-3 flex items-start gap-3"><input type="checkbox" name="present" checked={b} onChange={(e) => setB(e.target.checked)} className="mt-1 size-[18px] flex-none accent-[#0E1B3D]" /><span>{t("If accepted, one author will register and present the paper.")} <span className="text-[#B3261E]">*</span></span></label>
        {/* Originality: moved here from the Details step (submit_paper requires it). */}
        <label className="mt-3 flex items-start gap-3"><input type="checkbox" name="original" checked={c} onChange={(e) => setC(e.target.checked)} className="mt-1 size-[18px] flex-none accent-[#0E1B3D]" /><span>{t("This paper is not published or under review elsewhere.")} <Link href={`/submissions/${id}/review#policies`} className="text-[#2F5FD0] underline">{t("Dual submission policy")}</Link> <span className="text-[#B3261E]">*</span></span></label>
        {tried && (!a || !b || !c) ? <p role="alert" className="mt-2 text-[13px] text-[#B3261E]">{t("Tick all three boxes to submit.")}</p> : null}
        <p className="mt-4 text-[14px] text-[#4A5263]">{t("You can still replace the PDF and edit details until the deadline. After that, the paper is locked for review.")}</p>
      </section>
      {state.error ? <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{t(state.error)}</p> : null}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] pt-6">
        <div className="flex gap-2">
          <Link href={`/submissions/${id}/files`} className={ghostBtn}>{t("← Back")}</Link>{/* was /conflicts (step hidden for now) */}
          <Link href="/workspace/submissions" className={`${ghostBtn} hidden sm:inline-flex`}>{t("Save draft and exit")}</Link>
        </div>
        {/* Disabled until the three Confirm boxes are ticked (and every step is done). */}
        <div className="flex flex-col items-end gap-1">
          <button type="submit" disabled={pending || !ready || !(a && b && c)} className={primaryBtn}>{pending ? t("Submitting…") : resubmit ? t("Save changes") : t("Submit paper")}</button>
          {ready && !(a && b && c) ? <span className="text-[13px] text-[#4A5263]">{t("Tick the three Confirm boxes to submit.")}</span> : null}
        </div>
      </div>
    </form>
  );
}
