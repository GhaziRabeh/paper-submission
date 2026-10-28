"use client";

import { useActionState, useEffect, useMemo, useRef, useState } from "react";
import { focusFirstError } from "@/components/auth/focus-error";
import { saveProfile, type Org, type ProfileState } from "@/lib/auth/onboarding-actions";
import { AffiliationPicker } from "@/components/auth/affiliation-picker";
import { OrcidIcon, ui } from "@/components/auth/split-layout";
import { useT } from "@/lib/i18n/client";

const SCRIPTS = {
  zh: { label: "中文 Chinese", name: "Chinese", ph: "李明", dir: "ltr", lang: "zh" },
  ar: { label: "العربية Arabic", name: "Arabic", ph: "أمينة رحمن", dir: "rtl", lang: "ar" },
  ru: { label: "Русский Russian", name: "Russian", ph: "Иван Петров", dir: "ltr", lang: "ru" },
  ja: { label: "日本語 Japanese", name: "Japanese", ph: "山田 花子", dir: "ltr", lang: "ja" },
  ko: { label: "한국어 Korean", name: "Korean", ph: "김민준", dir: "ltr", lang: "ko" },
  el: { label: "Ελληνικά Greek", name: "Greek", ph: "Μαρία Παπαδοπούλου", dir: "ltr", lang: "el" },
} as const;
type ScriptKey = keyof typeof SCRIPTS;

export function ProfileForm({
  defaultName, initialScripts, suggested, initialAff, countries, initialCountry, next,
}: {
  defaultName: string;
  initialScripts: { script: string; name: string }[];
  suggested: Org | null;
  initialAff: Org | null;
  countries: { code: string; name: string }[];
  initialCountry: string;
  next?: string;
}) {
  const [state, action, pending] = useActionState(saveProfile, {} as ProfileState);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.fieldErrors || state.message) focusFirstError(formRef.current); }, [state]);
  const [name, setName] = useState(defaultName);
  const [scripts, setScripts] = useState<{ k: ScriptKey; v: string }[]>(
    initialScripts.filter((s) => s.script in SCRIPTS).map((s) => ({ k: s.script as ScriptKey, v: s.name })),
  );
  const [aff, setAff] = useState<Org | null>(initialAff);
  const [dept, setDept] = useState("");
  const [country, setCountry] = useState(initialCountry);
  const [tried, setTried] = useState(false);
  const [orcidSoon, setOrcidSoon] = useState(false);
  const t = useT();

  const fe = state.fieldErrors;
  const affErr = (tried && !aff) || !!fe?.institution;
  const nameErr = (tried && !name.trim()) || !!fe?.paperName;
  const scriptsJson = useMemo(() => JSON.stringify(scripts.map((s) => ({ script: s.k, name: s.v }))), [scripts]);

  function addScript() {
    const used = new Set(scripts.map((s) => s.k));
    const k = (Object.keys(SCRIPTS) as ScriptKey[]).find((x) => !used.has(x));
    if (k) setScripts([...scripts, { k, v: "" }]);
  }

  return (
    <form ref={formRef} action={action} noValidate onSubmit={() => { setTried(true); focusFirstError(formRef.current); }}>
      <input type="hidden" name="next" value={next ?? ""} />
      <input type="hidden" name="scripts" value={scriptsJson} />
      <input type="hidden" name="institution" value={aff?.name ?? ""} />
      <input type="hidden" name="rorId" value={aff?.id ?? ""} />

      {state.message ? <div role="alert" className="mt-4 rounded-[6px] border border-[#F0C2BE] bg-[#FDF0EF] px-3.5 py-3 text-[14px] text-[#7A1C15]">{t(state.message)}</div> : null}

      {/* TODO(auth): ORCID OAuth — fills name + affiliation and links works. */}
      <button type="button" onClick={() => setOrcidSoon(true)} className="mt-5 box-border flex min-h-14 w-full items-center gap-3 rounded-[6px] border border-[#B7BDC9] bg-white px-3.5 py-2.5 text-left text-[#121826]">
        <OrcidIcon size={22} />
        <span className="flex-auto"><span className="block text-[15px] font-semibold">{t("Connect ORCID")}</span><span className={`block text-[13px] ${ui.muted}`}>{t("Fills in your name and affiliation, and links your papers.")}</span></span>
        <span className="text-[13px] font-semibold text-[#2F5FD0]">{t("Connect")} →</span>
      </button>
      {orcidSoon ? <p role="status" className="mt-2 text-[13px] text-[#7A4508]">{t("Connecting ORCID is coming soon. Fill in the fields below for now.")}</p> : null}

      <div className="mt-[18px] flex flex-col gap-1.5">
        <label htmlFor="pr8-name" className={ui.label}>{t("Name as it appears on your papers")} <span className="text-[#B3261E]" aria-hidden>*</span></label>
        <input id="pr8-name" name="paperName" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={nameErr || undefined} className={ui.input} style={nameErr ? { border: "2px solid #B3261E" } : undefined} />
        {nameErr ? <span className={ui.error}>{t(fe?.paperName?.[0] ?? "Enter your name as it appears on your papers.")}</span> : null}
        {scripts.length ? (
          <>
            <div className={`mt-2 text-[13px] font-medium ${ui.muted}`}>{t("Name in other scripts")} <span className="font-normal">({t("optional · shown next to your name in programmes")})</span></div>
            {scripts.map((row, i) => {
              const meta = SCRIPTS[row.k];
              return (
                <div key={i} className="flex items-stretch gap-2">
                  <label htmlFor={`pr8-scr-${i}`} className="sr-only">{t("Script")}</label>
                  <select id={`pr8-scr-${i}`} value={row.k} onChange={(e) => setScripts(scripts.map((s, j) => (j === i ? { ...s, k: e.target.value as ScriptKey } : s)))}
                    className="box-border h-11 flex-[0_0_130px] rounded-[4px] border border-[#B7BDC9] bg-[#F5F6F3] px-2 text-[14px] text-[#121826]">
                    {(Object.keys(SCRIPTS) as ScriptKey[]).map((k) => <option key={k} value={k}>{SCRIPTS[k].label}</option>)}
                  </select>
                  <label htmlFor={`pr8-nat-${i}`} className="sr-only">{t("Name in {script}", { script: t(meta.name) })}</label>
                  <input id={`pr8-nat-${i}`} dir={meta.dir} lang={meta.lang} value={row.v} placeholder={meta.ph}
                    onChange={(e) => setScripts(scripts.map((s, j) => (j === i ? { ...s, v: e.target.value } : s)))}
                    className={`${ui.input} min-w-0 flex-auto text-[17px]`} style={{ textAlign: meta.dir === "rtl" ? "right" : "left" }} />
                  <button type="button" onClick={() => setScripts(scripts.filter((_, j) => j !== i))} aria-label={t("Remove {script} name", { script: t(meta.name) })}
                    className="h-11 flex-[0_0_44px] rounded-[4px] border border-[#DADDE3] bg-white text-[17px] text-[#4A5263]">×</button>
                </div>
              );
            })}
          </>
        ) : null}
        {scripts.length < 6 ? (
          <button type="button" onClick={addScript} className="min-h-6 self-start border-0 bg-transparent p-0 text-[13px] text-[#2F5FD0]">
            {scripts.length ? `+ ${t("Add another script")}` : `+ ${t("Add your name in another script")} (中文, العربية, Русский…)`}
          </button>
        ) : null}
      </div>

      <div className="relative mt-4 flex flex-col gap-1.5">
        <AffiliationPicker id="pr8-aff" label={<>{t("Affiliation")} <span className="text-[#B3261E]" aria-hidden>*</span></>}
          value={aff} onChange={setAff} suggested={suggested} invalid={affErr} />
        {affErr ? <span className={ui.error}>{t("Choose your affiliation, or “Independent researcher”.")}</span> : null}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pr8-dept" className={ui.label}>{t("Department")} <span className={`font-normal ${ui.muted}`}>({t("optional")})</span></label>
          <input id="pr8-dept" name="department" value={dept} onChange={(e) => setDept(e.target.value)} placeholder={t("e.g. Electrical Eng.")} className={ui.input} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="pr8-country" className={ui.label}>{t("Country")}</label>
          <select id="pr8-country" name="country" autoComplete="country" value={country} onChange={(e) => setCountry(e.target.value)} className={`${ui.input} px-2.5`}>
            <option value="">{t("Choose…")}</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </div>
      </div>

      <details className="mt-4 rounded-[6px] border border-[#DADDE3] bg-white px-3.5 py-3 text-[14px]">
        <summary className="cursor-pointer font-semibold">{t("Add more (optional)")}</summary>
        <p className={`mb-1 mt-2 ${ui.muted}`}>{t("These help but aren't needed now. You can add them any time after this step:")}</p>
        <ul className={`m-0 flex flex-col gap-1.5 pl-[18px] ${ui.muted}`}>
          <li>{t("Other emails you publish with — in Settings › Emails, confirmed with a code so invitations to old addresses reach you.")}</li>
          <li>{t("ORCID, research keywords and names in other scripts — in Settings › Profile.")}</li>
        </ul>
      </details>

      <button type="submit" disabled={pending} className={`mt-[22px] h-12 ${ui.primary}`}>{pending ? t("Saving…") : t("Finish and get my PIN")}</button>
      <p className={`mt-3 text-center text-[13px] ${ui.muted}`}>{t("Last step — takes about a minute. You can change it any time.")}</p>
    </form>
  );
}
