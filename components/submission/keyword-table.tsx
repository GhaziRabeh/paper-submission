"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { useT } from "@/lib/i18n/client";

export const KEYWORDS_MIN = 1;
export const KEYWORDS_MAX = 3;

/**
 * The venue keywords as a table — Category | Keyword | Priority (0, 1, 2, 3) — on the Details step. 0 = not chosen;
 * 1 to 3 keywords get a priority, each of 1, 2 and 3 once (as on PaperCept): a number already given to one
 * keyword can't be chosen for another until that one goes back to 0. The chosen
 * keywords are posted as `keyword` fields in priority order (1 first; the first is the main keyword, used to find
 * reviewers), and the priorities as `keywordPriority` (JSON), so the table comes back as it was left.
 */
export function KeywordTable({ eventName, eventAcr, groups, initial, initialPriority, error }: { eventName: string; eventAcr: string; groups: { group: string; keywords: string[] }[]; initial: string[]; initialPriority?: Record<string, number>; error?: string }) {
  const t = useT();
  const [prio, setPrio] = useState<Record<string, number>>(() => {
    // Saved before priorities were unique (or before they were stored): renumbered 1, 2, 3 in their order.
    const saved = initialPriority && Object.keys(initialPriority).length ? initialPriority : Object.fromEntries(initial.map((k, i) => [k, i + 1]));
    const ranked = Object.keys(saved).filter((k) => saved[k] > 0).sort((a, b) => saved[a] - saved[b] || initial.indexOf(a) - initial.indexOf(b));
    return Object.fromEntries(ranked.slice(0, KEYWORDS_MAX).map((k, i) => [k, i + 1]));
  });
  const priorityOf = (k: string) => prio[k] ?? 0;
  const order = groups.flatMap((g) => g.keywords);
  const chosen = Object.keys(prio).filter((k) => prio[k] > 0)
    .sort((a, b) => prio[a] - prio[b] || order.indexOf(a) - order.indexOf(b));
  // The keyword holding each priority, so no number is given twice.
  const holder = (n: number) => Object.keys(prio).find((k) => prio[k] === n);
  const setPriority = (k: string, n: number) => setPrio((p) => {
    const next = { ...p };
    if (n > 0) next[k] = n; else delete next[k];
    return next;
  });
  // The search box filters the rows; chosen keywords always stay visible.
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const matches = (g: string, k: string) => !needle || priorityOf(k) > 0 || k.toLowerCase().includes(needle) || t(k).toLowerCase().includes(needle) || g.toLowerCase().includes(needle) || t(g).toLowerCase().includes(needle);
  const shown = groups.map((g) => ({ group: g.group, keywords: g.keywords.filter((k) => matches(g.group, k)) })).filter((g) => g.keywords.length);
  return (
    <>
      {chosen.map((k) => <input key={k} type="hidden" name="keyword" value={k} />)}
      <input type="hidden" name="keywordPriority" value={JSON.stringify(Object.fromEntries(chosen.map((k) => [k, prio[k]])))} />
      <div className="mt-5 flex flex-wrap items-baseline justify-between gap-2">
        <span id="sb2-kw-l" className="font-medium">{t("Keywords")} <span className="text-[#B3261E]">*</span></span>
        <span className="font-mono text-[12px] font-semibold" style={{ color: chosen.length >= KEYWORDS_MIN ? "#14603F" : "#7A4508" }}>{t("{n} chosen · min {min}, max {max}", { n: chosen.length, min: KEYWORDS_MIN, max: KEYWORDS_MAX })}</span>
      </div>
      {error ? <p className="mt-1 text-[14px] text-[#B3261E]">{t(error)}</p> : null}
      {/* Keyword Selection (the instructions from PaperCept's keyword page), before the search box and the table. */}
      <div className="mt-2 text-[14px] leading-[1.55] text-[#121826]">
        <p className="m-0 font-bold">{t("Keyword Selection for {event}", { event: eventName })}</p>
        <p className="m-0 mt-2">{t("Please choose at least one and not more than three keywords by selecting one of the priorities 1 to 3 for each of the chosen keywords. A keyword with priority 1 has precedence over a keyword with priority 2, etc. Keywords with priority 0 are not considered. The keywords are used to assign reviewers to the submission and, if the submission is accepted, to schedule it in a session. The keywords are also added to the keywords lists in the personal profiles of all authors.")}</p>
        <ul className="m-0 mt-2 flex list-disc flex-col gap-1 pl-5 text-[#4A5263]">
          <li>{t("If your submission is a paper then the first keyword should constitute a sensible title for the session in which your paper is to be presented.")}</li>
          <li>{t("For some conferences, the Category to which the first keyword belongs determines the subject area within the conference program to which the paper is assigned.")}</li>
          <li>{t("The total length of the chosen keywords cannot be more than 250 characters.")}</li>
          <li>{t("No two keywords can have the same priority. If you need to de-select a keyword then select priority 0.")}</li>
          <li>{t("You can change the keywords until the submission deadline.")}</li>
          <li>{t("The list below shows the keywords for {event}. Scroll down to see all keywords. Your current selection is shown just above the list. When your selection is ready, click on “Continue to authors” to continue.", { event: eventAcr })}</li>
        </ul>
      </div>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") e.preventDefault(); }} aria-label={t("Search the keywords")} placeholder={t("Search the keywords, e.g. adaptive, marine, optimisation")}
        className="mt-2 h-11 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3.5 text-[15px]" />
      {/* The chosen keywords, in priority order (1 first), between the search box and the table; × sets one back to 0. */}
      {chosen.length ? (
        <ol className="m-0 mt-2 flex list-none flex-wrap gap-1.5 p-0" aria-label={t("Your keywords, by priority")}>
          {chosen.map((k) => (
            <li key={k} className="inline-flex items-center gap-1.5 rounded-full bg-[#E6EDFC] py-1 pl-1 pr-1.5 text-[13px] font-medium text-[#1F47A8]">
              <span className="flex size-5 items-center justify-center rounded-full bg-white font-mono text-[12px] font-bold">{prio[k]}</span>
              {t(k)}
              <button type="button" onClick={() => setPriority(k, 0)} aria-label={t("Remove {x}", { x: t(k) })} className="flex size-5 items-center justify-center rounded-full border-0 bg-transparent p-0 text-current hover:bg-white/70">
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ol>
      ) : null}
      <div className="mt-2 overflow-x-auto rounded-[8px] bg-white" style={{ border: error ? "2px solid #B3261E" : "1px solid #DADDE3" }}>
        <table aria-labelledby="sb2-kw-l" className="w-full min-w-[520px] border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-[#DADDE3] bg-[#F7F8F6] text-left font-mono text-[13px] uppercase tracking-[0.06em] text-[#4A5263]">
              <th className="whitespace-nowrap px-5 py-2.5 font-bold">{t("Category")}</th>
              <th className="px-5 py-2.5 font-bold">{t("Keyword")}</th>
              <th className="px-5 py-2.5 text-right font-bold">{t("Priority")}</th>
            </tr>
          </thead>
          {shown.map((g) => (
            <tbody key={g.group} className="border-t-2 border-t-[#B7BDC9] first-of-type:border-t-0">
              {g.keywords.map((k, i) => {
                const pr = priorityOf(k);
                return (
                  <tr key={k} className="border-b border-[#EEF0EC] last:border-b-0" style={{ background: pr ? "#FFFBF3" : undefined }}>
                    {i === 0 ? <th scope="rowgroup" rowSpan={g.keywords.length} className="whitespace-nowrap border-r border-[#EEF0EC] px-5 py-3 text-left align-middle font-bold">{t(g.group)}</th> : null}
                    <td className={`px-5 py-2.5 ${pr ? "font-semibold" : ""}`}>{t(k)}</td>
                    <td className="px-5 py-2 text-right">
                      <select aria-label={t("Priority for {k}", { k: t(k) })} value={pr} onChange={(e) => setPriority(k, Number(e.target.value))}
                        className="h-9 w-[72px] rounded-[4px] bg-white px-2 font-mono text-[14px]" style={{ border: pr === 1 ? "2px solid #F2A93B" : "1px solid #B7BDC9" }}>
                        {[0, 1, 2, 3].map((n) => { const by = n > 0 ? holder(n) : undefined; return <option key={n} value={n} disabled={!!by && by !== k}>{n}</option>; })}
                      </select>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          ))}
        </table>
        {shown.length ? null : <p className="m-0 px-5 py-4 text-[14px] text-[#4A5263]">{t("No keyword matches “{q}”.", { q: q.trim() })}</p>}
      </div>
    </>
  );
}
