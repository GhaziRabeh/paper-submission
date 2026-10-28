"use client";

import { useState } from "react";
import { ui } from "@/components/auth/split-layout";
import { useT } from "@/lib/i18n/client";

/** Academic grades offered on sign-up (stored in English, shown translated). */
export const GRADES = [
  "Bachelor's student", "Master's student", "PhD student", "PhD", "Postdoctoral researcher",
  "Assistant professor", "Associate professor", "Professor", "Researcher", "Engineer",
] as const;

const OTHER = "__other";

/**
 * Sign-up Grade (optional): a list of academic grades; "Other" turns it into a text field for one that isn't listed.
 * Posts `grade` (the English label, or the typed text).
 */
export function GradeSelect({ id }: { id: string }) {
  const t = useT();
  const [choice, setChoice] = useState("");
  const [typed, setTyped] = useState("");
  const other = choice === OTHER;

  return (
    <>
      <input type="hidden" name="grade" value={other ? typed.trim() : choice} />
      {other ? (
        <>
          <input id={id} autoFocus value={typed} maxLength={80} placeholder={t("Your grade or position")} onChange={(e) => setTyped(e.target.value)} className={ui.input} />
          <button type="button" onClick={() => { setChoice(""); setTyped(""); }} className="self-start border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline">{t("Back to the list")}</button>
        </>
      ) : (
        <select id={id} value={choice} onChange={(e) => setChoice(e.target.value)} className={`${ui.input} px-2.5`}>
          <option value="">{t("Choose…")}</option>
          {GRADES.map((g) => <option key={g} value={g}>{t(g)}</option>)}
          <option value={OTHER}>{t("Other (type it)")}</option>
        </select>
      )}
    </>
  );
}
