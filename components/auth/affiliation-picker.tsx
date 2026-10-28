"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { searchOrganizations, type Org } from "@/lib/auth/onboarding-actions";
import { ui } from "@/components/auth/split-layout";
import { useT } from "@/lib/i18n/client";

export const INDEPENDENT: Org = { id: null, name: "Independent researcher", place: "No institution" };

/**
 * University / institute picker: ROR search as you type, "Independent researcher", or a name added by hand.
 * The chosen organisation is held by the form (value / onChange); the form posts it in its own hidden inputs.
 * Used by sign-up (optional) and the research profile, step 4 (required).
 * `otherOption` (sign-up): the list ends with "Other (type the name)", which turns the field into a plain text field
 * whose text is the value as you type; no "Independent researcher".
 */
export function AffiliationPicker({ id, label, value, onChange, suggested = null, invalid = false, otherOption = false }: {
  id: string; label: ReactNode; value: Org | null; onChange: (o: Org | null) => void; suggested?: Org | null; invalid?: boolean; otherOption?: boolean;
}) {
  const t = useT();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Org[]>([]);
  const [manual, setManual] = useState(false);
  const [searching, startSearch] = useTransition();

  // debounced ROR search
  useEffect(() => {
    const s = q.trim();
    if (s.length < 2) return;
    const timer = setTimeout(() => startSearch(async () => setResults(await searchOrganizations(s))), 250);
    return () => clearTimeout(timer);
  }, [q]);

  const shown = q.trim().length >= 2 ? (otherOption ? results : [...results, INDEPENDENT]) : [];

  if (otherOption && manual) {
    return (
      <>
        <label htmlFor={id} className={ui.label}>{label}</label>
        <input id={id} autoFocus value={q} maxLength={200} autoComplete="organization" placeholder={t("Full name of your university")} className={ui.input}
          onChange={(e) => { const v = e.target.value; setQ(v); onChange(v.trim().length >= 2 ? { id: null, name: v.trim(), place: "Added manually" } : null); }} />
        <button type="button" onClick={() => { setManual(false); setQ(""); onChange(null); }} className="self-start border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0] underline">{t("Back to the list")}</button>
      </>
    );
  }

  return (
    <>
      <label htmlFor={id} className={ui.label}>{label}</label>
      {value ? (
        <div className="box-border flex min-h-12 items-center gap-2.5 rounded-[4px] border-2 border-[#18744F] bg-white px-3 py-2">
          <span className="min-w-0 flex-auto"><span className="block font-semibold">{t(value.name)}</span><span className={`block text-[13px] ${ui.muted}`}>{t(value.place)}</span></span>
          {value.id ? <span className="rounded-[2px] bg-[#E1F3EA] px-2 py-0.5 font-mono text-[11px] font-medium text-[#14603F]">ROR ✓</span> : null}
          <button type="button" onClick={() => { onChange(null); setManual(false); }} className="border-0 bg-transparent p-0 text-[13px] text-[#4A5263] underline">{t("Change")}</button>
        </div>
      ) : manual ? (
        <div className="flex gap-2">
          <input id={id} autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Full name of your institution")} className={`${ui.input} flex-auto`} />
          <button type="button" onClick={() => q.trim().length >= 2 && onChange({ id: null, name: q.trim(), place: "Added manually" })} className={`h-11 px-4 text-[14px] ${ui.secondary}`}>{t("Use")}</button>
        </div>
      ) : (
        <>
          <input id={id} type="text" autoComplete="organization" role="combobox" aria-expanded={shown.length > 0} aria-controls={`${id}-list`}
            placeholder={t("Start typing your university or institute")} value={q} onChange={(e) => setQ(e.target.value)} aria-invalid={invalid || undefined}
            className={ui.input} style={invalid ? { border: "2px solid #B3261E" } : undefined} />
          {suggested && !q.trim() ? (
            <button type="button" onClick={() => onChange(suggested)} className="flex items-center gap-2.5 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3 py-2 text-left text-[13px] text-[#14603F]">
              <span className="flex-auto">{t("Suggested from your email:")} <strong>{suggested.name}</strong></span><span className="font-semibold">{t("Use this")}</span>
            </button>
          ) : null}
          {otherOption && q.trim().length >= 2 ? (
            <ul id={`${id}-list`} role="listbox" className="m-0 list-none rounded-[6px] border border-[#B7BDC9] bg-white p-1 shadow-[0_6px_18px_rgba(18,24,38,.08)]">
              {searching && !results.length ? <li className={`px-2.5 py-2 text-[13px] ${ui.muted}`}>{t("Searching…")}</li> : null}
              {shown.map((r) => (
                <li key={(r.id ?? "") + r.name} role="option" aria-selected={false}>
                  <button type="button" onClick={() => { onChange(r); setQ(""); }} className="flex w-full flex-col rounded-[4px] border-0 bg-transparent px-2.5 py-2 text-left text-[#121826] hover:bg-[#F5F6F3]">
                    <span className="text-[14px] font-semibold">{t(r.name)}</span><span className={`text-[12px] ${ui.muted}`}>{t(r.place)}</span>
                  </button>
                </li>
              ))}
              <li role="option" aria-selected={false} className="border-t border-[#DADDE3]">
                <button type="button" onClick={() => { setManual(true); setQ(""); }} className="w-full rounded-[4px] border-0 bg-transparent px-2.5 py-2 text-left text-[14px] font-semibold text-[#2F5FD0] hover:bg-[#F5F6F3]">{t("Other (type the name)")}</button>
              </li>
            </ul>
          ) : shown.length ? (
            <ul id={`${id}-list`} role="listbox" className="m-0 list-none rounded-[6px] border border-[#B7BDC9] bg-white p-1 shadow-[0_6px_18px_rgba(18,24,38,.08)]">
              {searching && !results.length ? <li className={`px-2.5 py-2 text-[13px] ${ui.muted}`}>{t("Searching…")}</li> : null}
              {shown.map((r) => (
                <li key={(r.id ?? "") + r.name} role="option" aria-selected={false}>
                  <button type="button" onClick={() => { onChange(r); setQ(""); }} className="flex w-full flex-col rounded-[4px] border-0 bg-transparent px-2.5 py-2 text-left text-[#121826] hover:bg-[#F5F6F3]">
                    <span className="text-[14px] font-semibold">{t(r.name)}</span><span className={`text-[12px] ${ui.muted}`}>{t(r.place)}</span>
                  </button>
                </li>
              ))}
              <li className={`border-t border-[#DADDE3] px-2.5 pb-1 pt-1.5 text-[12px] ${ui.muted}`}>{t("Not listed?")} <button type="button" onClick={() => setManual(true)} className="border-0 bg-transparent p-0 text-[12px] text-[#2F5FD0] underline">{t("Add it manually")}</button></li>
            </ul>
          ) : null}
        </>
      )}
    </>
  );
}
