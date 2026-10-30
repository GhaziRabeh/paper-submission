"use client";

import { useState } from "react";
import { ui } from "@/components/auth/split-layout";
import { useT } from "@/lib/i18n/client";

/** Grades (titles) offered on sign-up (stored in English, shown translated). */
export const GRADES = ["Mr.", "Ms.", "Dr.", "Prof."] as const;

const OTHER = "__other";

/**
 * Sign-up Grade (required): a list of academic grades; "Other" turns it into a text field for one that isn't listed.
 * Posts `grade` (the English label, or the typed text) and reports it through `onChange`.
 */
export function GradeSelect({ id, onChange, invalid = false }: { id: string; onChange?: (grade: string) => void; invalid?: boolean }) {
  const t = useT();
  const [choice, setChoice] = useState("");
  const [typed, setTyped] = useState("");
  const other = choice === OTHER;
  const pick = (c: string, ty: string) => { setChoice(c); setTyped(ty); onChange?.(c === OTHER ? ty.trim() : c); };
  const border = { border: invalid ? "2px solid #B3261E" : "1px solid #B7BDC9" };

  return (
    <>
      <input type="hidden" name="grade" value={other ? typed.trim() : choice} />
      {other ? (
        <>
          <input id={id} autoFocus value={typed} maxLength={80} placeholder={t("Your grade or position")} onChange={(e) => pick(OTHER, e.target.value)} aria-required="true" aria-invalid={invalid || undefined} className={ui.input} style={border} />
          <button type="button" onClick={() => pick("", "")} className="self-start border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline">{t("Back to the list")}</button>
        </>
      ) : (
        <select id={id} value={choice} onChange={(e) => pick(e.target.value, typed)} aria-required="true" aria-invalid={invalid || undefined} className={`${ui.input} px-2.5`} style={border}>
          <option value="">{t("Choose…")}</option>
          {GRADES.map((g) => <option key={g} value={g}>{t(g)}</option>)}
          <option value={OTHER}>{t("Other (type it)")}</option>
        </select>
      )}
    </>
  );
}
