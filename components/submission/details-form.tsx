"use client";

import Link from "@/components/site/link";
import { useActionState, useState } from "react";
import { saveDetails, type ActionState } from "@/lib/submission/actions";
import { card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { useT } from "@/lib/i18n/client";
import { RichTextEditor } from "@/components/rich-text/editor";
import { mdToPlain, wordCount } from "@/lib/rich-text/plain";
import { setPick as sharePick } from "@/components/submission/type-pick";
import { KeywordTable } from "@/components/submission/keyword-table";


/** SB02: title, abstract, short title, declarations. */
export function DetailsForm({ id, eventName, eventAcr, typeLine, tracks = [], initialTrack = "", backHref, byline = "", keywordGroups, keywords = [], keywordPriority, initial }: { id: string; eventName: string; eventAcr: string; typeLine: string; tracks?: string[]; initialTrack?: string; backHref?: string; byline?: string; keywordGroups?: { group: string; keywords: string[] }[]; keywords?: string[]; keywordPriority?: Record<string, number>; initial: { title: string; abstract: string; shortTitle: string; original: boolean; preprint: boolean; studentAward: boolean } }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveDetails, {});
  const [title, setTitle] = useState(initial.title === "Untitled paper" ? "" : initial.title);
  const [abstract, setAbstract] = useState(initial.abstract);
  const [track, setTrack] = useState(initialTrack);
  const fe = state.fieldErrors ?? {};
  const words = wordCount(abstract);
  const input = "w-full rounded-[4px] bg-white px-3.5 py-3 text-[17px] text-[#121826] outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#2F5FD0]";
  const border = (bad: boolean) => ({ border: bad ? "2px solid #B3261E" : "1px solid #B7BDC9" });

  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      {/* Submission Information (as on PaperCept's submission form), first on the page. */}
      <section className={card} aria-labelledby="sb2-info">
        <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("Section")}</p>
        <h2 id="sb2-info" className={`${h2} mt-1`}>{t("Submission Information")}</h2>
        <ul className="m-0 mt-3 flex list-none flex-col gap-1.5 p-0 text-[15px] text-[#121826]">
          <li>{t("Use this page to submit a {type}.", { type: typeLine.toLowerCase() })}</li>
          <li>{t("Complete the fields in this section and click on the “Continue to authors” button.")}</li>
          <li>{t("All fields marked with an asterisk * are required, including the keywords.")}</li>
        </ul>
        <p role="note" className="m-0 mt-3 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3 py-2 text-[14px] text-[#3B2A07]">
          <strong>{t("Warning:")}</strong> {t("Don't use the browser Back button during the submission — use “← Back” at the bottom of the page instead.")}
        </p>
      </section>

      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("Paper details")}</h2>
        <p className="mt-1 text-[#4A5263]">{typeLine}</p>

        {/* Track hidden for now (the "Venue & type" step is skipped when the type comes from the event's table). */}
        {false && tracks.length ? (
          <>
            <label htmlFor="sb2-track" className="mt-5 block font-medium">{t("Track")} <span className="text-[#B3261E]">*</span></label>
            <select id="sb2-track" name="track" value={track} onChange={(e) => { setTrack(e.target.value); sharePick({ track: e.target.value || null }); }} aria-invalid={!!fe.track || undefined}
              className="mt-1.5 h-12 w-full rounded-[4px] bg-white px-3 text-[16px]" style={border(!!fe.track)}>
              <option value="">{t("Choose a track…")}</option>
              {tracks.map((tr) => <option key={tr} value={tr}>{t(tr)}</option>)}
            </select>
            <p className={`mt-1 text-[14px] ${fe.track ? "text-[#B3261E]" : "text-[#4A5263]"}`}>{fe.track ? t(fe.track) : t("Pick the track closest to your paper. The program chair may move it.")}</p>
          </>
        ) : null}

        <div className="mt-5 flex items-baseline justify-between"><label id="sb2-title-l" htmlFor="sb2-title" className="font-medium">{t("Title")} <span className="text-[#B3261E]">*</span></label><span className="font-mono text-[12px] text-[#4A5263]">{mdToPlain(title).length} / 200</span></div>
        <div className="mt-1.5"><RichTextEditor mode="inline" id="sb2-title" name="title" value={title} onChange={setTitle} maxLength={200} placeholder={t("Your title appears here")} labelledBy="sb2-title-l" describedBy="sb2-title-h" invalid={!!fe.title} /></div>
        <p id="sb2-title-h" className={`mt-1 text-[14px] ${fe.title ? "text-[#B3261E]" : "text-[#4A5263]"}`}>{fe.title ? t(fe.title) : t("Exactly as on the PDF. Sentence case. Italic and maths ($H_\\infty$) are kept.")}</p>

        <div className="mt-5 flex items-baseline justify-between"><label id="sb2-abs-l" htmlFor="sb2-abs" className="font-medium">{t("Abstract")} <span className="text-[#B3261E]">*</span></label><span className="font-mono text-[12px]" style={{ color: words > 250 ? "#B3261E" : "#4A5263" }}>{t("{n} / 250 words", { n: words })}</span></div>
        <div className="mt-1.5"><RichTextEditor mode="abstract" id="sb2-abs" name="abstract" value={abstract} onChange={setAbstract} minRows={9} placeholder={t("Write your abstract here: the problem, your method and the main result (250 words at most).")} labelledBy="sb2-abs-l" describedBy="sb2-abs-h" invalid={!!fe.abstract || words > 250} /></div>
        <div aria-hidden className="mt-1 h-1 w-full overflow-hidden rounded-sm bg-[#EEF0EC]"><div className="h-1" style={{ width: `${Math.min(100, (words / 250) * 100)}%`, background: words > 250 ? "#B3261E" : "#0E1B3D" }} /></div>
        <p id="sb2-abs-h" className={`mt-1 text-[14px] ${fe.abstract ? "text-[#B3261E]" : "text-[#4A5263]"}`}>{fe.abstract ? t(fe.abstract) : t("Italic, lists and maths ($x^2$) are allowed. In the published abstract lists become plain sentences. 250 words at most.")}</p>

        {/* Keyword priorities (with a search box), after the abstract and the title. */}
        {keywordGroups?.length ? (
          <>
            <input type="hidden" name="keywordsShown" value="1" />
            <KeywordTable eventName={eventName} eventAcr={eventAcr} groups={keywordGroups} initial={keywords} initialPriority={keywordPriority} error={fe.keywords} />
          </>
        ) : null}

        {/* Short title for the program hidden for now (the saved one is kept).
        <label htmlFor="sb2-short" className="mt-5 block font-medium">{t("Short title for the program")} <span className="font-normal text-[#4A5263]">{t("(optional)")}</span></label>
        <input id="sb2-short" name="shortTitle" maxLength={120} defaultValue={initial.shortTitle} placeholder={t("Shown in session listings if your title is long")} className={`${input} mt-1.5 h-12 py-0 text-[16px]`} style={border(false)} /> */}
      </section>

      {/* Declarations hidden for now: the saved ones are kept, and originality is confirmed on the Submit step.
      To show them again, also add <input type="hidden" name="declarationsShown" value="1" /> inside this section.
      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("Declarations")}</h2>
        <label className="mt-4 flex items-start gap-3">
          <input type="checkbox" name="original" defaultChecked={initial.original} aria-invalid={!!fe.original || undefined} className="mt-1 size-[18px] flex-none accent-[#0E1B3D]" />
          <span>{t("This paper is not published or under review elsewhere.")} <Link href={`/submissions/${id}/review#policies`} className="text-[#2F5FD0] underline">{t("Dual submission policy")}</Link> <span className="text-[#B3261E]">*</span></span>
        </label>
        {fe.original ? <p className="ml-7 mt-1 text-[13px] text-[#B3261E]">{t(fe.original)}</p> : null}
        <label className="mt-3 flex items-start gap-3">
          <input type="checkbox" name="preprint" defaultChecked={initial.preprint} className="mt-1 size-[18px] flex-none accent-[#0E1B3D]" />
          <span>{t("An earlier version is on a preprint server (e.g. arXiv).")} <span className="text-[#4A5263]">{t("Allowed — don't link it in the PDF.")}</span></span>
        </label>
        <label className="mt-3 flex items-start gap-3">
          <input type="checkbox" name="studentAward" defaultChecked={initial.studentAward} className="mt-1 size-[18px] flex-none accent-[#0E1B3D]" />
          <span>{t("I'd like to be considered for the Best Student Paper award.")} <span className="text-[#4A5263]">{t("The first author must be a student.")}</span></span>
        </label>
      </section> */}

      {state.error ? <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{t(state.error)}</p> : null}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] pt-6">
        <div className="flex gap-2">
          <Link href={backHref ?? `/submissions/${id}/type`} className={ghostBtn}>{t("← Back")}</Link>
          <button type="submit" name="intent" value="exit" className={`${ghostBtn} hidden sm:inline-flex`}>{t("Save and exit")}</button>
        </div>
        <button type="submit" name="intent" value="next" disabled={pending} className={primaryBtn}>{pending ? t("Saving…") : t("Continue to authors →")}</button>
      </div>
    </form>
  );
}
