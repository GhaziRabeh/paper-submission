"use client";

import Link from "@/components/site/link";
import { useRouter } from "next/navigation";
import { useActionState, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/browser";
import { continueFromFiles, fileUrl, finishUpload, removeFile, type ActionState } from "@/lib/submission/actions";
import { card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import type { SubFile } from "@/lib/submission/data";
import { useT } from "@/lib/i18n/client";
import { OpenViewer } from "@/components/submission/followup/open-viewer";

type I18n = { key: string; vars?: Record<string, string | number> };

type Role = "paper" | "appendix" | "source" | "data" | "video";
const EXTRA: { role: Role; label: string; accept: string; mime: string }[] = [
  { role: "appendix", label: "Appendix PDF", accept: "application/pdf,.pdf", mime: "application/pdf" },
  { role: "source", label: "LaTeX source (ZIP)", accept: ".zip,application/zip", mime: "application/zip" },
  { role: "data", label: "Dataset (ZIP)", accept: ".zip,application/zip", mime: "application/zip" },
  { role: "video", label: "Video (MP4)", accept: "video/mp4,.mp4", mime: "video/mp4" },
];
const MAX = { paper: 20, other: 50 };
const mb = (n: number) => `${(n / 1048576).toFixed(1)} MB`;
const ext = (n: string) => (n.split(".").pop() ?? "").toUpperCase().slice(0, 4);
const ICON = { ok: ["✓", "#E1F3EA", "#14603F"], warn: ["!", "#FBEFDD", "#7A4508"], fail: ["×", "#FDECEA", "#B3261E"] } as const;

export function FilesStep({ id, files, typeLine, canContinue, guide }: { id: string; files: SubFile[]; typeLine: string; canContinue: boolean; guide?: ReactNode }) {
  const router = useRouter();
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(continueFromFiles, {});
  const [busy, setBusy] = useState<null | "uploading" | "checking">(null);
  const [error, setError] = useState<string | null>(null);
  const [extraRole, setExtraRole] = useState<Role>("appendix");
  const paperInput = useRef<HTMLInputElement>(null);
  const extraInput = useRef<HTMLInputElement>(null);

  const paper = files.find((f) => f.role === "paper" && f.current);
  const older = files.filter((f) => f.role === "paper" && !f.current);
  const current = files.filter((f) => f.current || f.role !== "paper");
  const items = (paper?.check.items ?? []) as (NonNullable<SubFile["check"]["items"]>[number] & { i18n?: I18n; valueI18n?: I18n })[];
  const fails = items.filter((i) => i.level === "fail").length, warns = items.filter((i) => i.level === "warn").length;

  async function upload(file: File, role: Role) {
    setError(null);
    const isPaper = role === "paper";
    const spec = EXTRA.find((e) => e.role === role);
    const mime = isPaper ? "application/pdf" : spec!.mime;
    if (isPaper && !/\.pdf$/i.test(file.name)) { setError(t("The paper must be a PDF.")); return; }
    if (file.size > (isPaper ? MAX.paper : MAX.other) * 1048576) { setError(t("That file is {size} — the limit is {max} MB.", { size: mb(file.size), max: isPaper ? MAX.paper : MAX.other })); return; }
    setBusy("uploading");
    const path = `${id}/${role}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext(file.name).toLowerCase() || "bin"}`;
    const { error: upErr } = await createClient().storage.from("papers").upload(path, file, { contentType: mime, upsert: false });
    if (upErr) { setBusy(null); setError(/row-level|policy|403/i.test(upErr.message) ? t("You can't upload to this paper any more.") : t("Upload failed: {msg}", { msg: upErr.message })); return; }
    setBusy("checking");
    const r = await finishUpload({ submissionId: id, role, path, name: file.name, size: file.size, mime });
    setBusy(null);
    if (r.error) { setError(t(r.error)); return; }
    router.refresh();
  }

  async function open(path: string) {
    const r = await fileUrl(path);
    if (r.url) window.open(r.url, "_blank", "noopener"); else setError(t(r.error ?? "Couldn't open the file."));
  }

  return (
    <>
      {/* File Upload Section (after PaperCept's), first on the page; worded for what this site does: a PDF, checked on upload. */}
      <section className={card} aria-labelledby="sb5-info">
        <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("Section")}</p>
        <h2 id="sb5-info" className={`${h2} mt-1`}>{t("File Upload Section")}</h2>
        <div className="mt-3 flex flex-col gap-2.5 text-[15px] leading-[1.55] text-[#121826]">
          <p className="m-0"><strong>{t("Compliant pdf.")}</strong> {t("Upload your conference paper as a PDF. It is checked as soon as you upload it — paper size, embedded fonts, margins and page count — and any problem is shown with its page number, so you can fix it before you submit. Word and LaTeX files aren't converted here: export your paper to PDF first.")}</p>
          <p className="m-0"><strong>{t("Manuscript compliance.")}</strong> {t("Besides pdf compliance the conference and publisher impose additional requirements on the manuscript, such as the number of pages, paper size, text margins and file size. Be sure to use the Word or LaTeX template provided by the conference and check out the submission requirements on the conference website.")}</p>
          <p className="m-0"><strong>{t("Important:")}</strong> {t("Please make sure that the name of any file that you upload only contains standard ASCII characters (letters A–Z, digits, hyphens and underscores).")}</p>
        </div>
        <p role="note" className="m-0 mt-3 rounded-[6px] border border-[#F1D29A] bg-[#FFF6E6] px-3 py-2 text-[14px] text-[#3B2A07]">
          <strong>{t("Warning:")}</strong> {t("Don't use the browser Back button during the submission — use “← Back” at the bottom of the page instead.")}
        </p>
      </section>

      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("Paper PDF")}</h2>
        <p className="mt-1 text-[#4A5263]">{typeLine} · {t("A4 or US Letter · fonts embedded · max {max} MB.", { max: MAX.paper })}</p>
        <input ref={paperInput} type="file" accept="application/pdf,.pdf" className="sr-only" aria-label={t("Choose paper PDF")} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f, "paper"); }} />

        {busy ? (
          <div role="status" className="mt-5 flex items-center gap-3 rounded-[8px] border border-[#DADDE3] bg-[#FBFBF9] px-4 py-5">
            <span aria-hidden className="size-5 animate-spin rounded-full border-2 border-[#B7BDC9] border-t-[#0E1B3D]" />
            <span>{busy === "uploading" ? t("Uploading…") : t("Checking page size, length, fonts, margins and anonymity…")}</span>
          </div>
        ) : !paper ? (
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files?.[0]; if (f) upload(f, "paper"); }}
            className="mt-5 flex flex-col items-center rounded-[8px] border-2 border-dashed border-[#B7BDC9] bg-[#FBFBF9] px-6 py-10 text-center">
            <div className="text-[17px] font-semibold">{t("Drop your PDF here")}</div>
            <p className="mt-1 text-[14px] text-[#4A5263]">{t("It's checked as soon as it uploads — you'll see the page of any problem.")}</p>
            <button type="button" onClick={() => paperInput.current?.click()} className="mt-4 h-11 rounded-[4px] bg-[#0E1B3D] px-5 text-[15px] font-semibold text-white">{t("Choose PDF…")}</button>
          </div>
        ) : (
          <>
            <div className="mt-5 flex gap-4">
              <div aria-hidden className="hidden h-[124px] w-24 flex-none flex-col gap-1.5 rounded-[4px] border border-[#DADDE3] bg-white p-2.5 shadow-sm sm:flex">
                <span className="h-1.5 w-3/4 bg-[#121826]" /><span className="h-1 w-full bg-[#DADDE3]" /><span className="h-1 w-full bg-[#DADDE3]" /><span className="h-1 w-5/6 bg-[#DADDE3]" /><span className="mt-1 h-6 w-full bg-[#EEF0EC]" /><span className="h-1 w-full bg-[#DADDE3]" /><span className="h-1 w-2/3 bg-[#DADDE3]" />
              </div>
              <div className="min-w-0 flex-auto">
                <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="truncate font-semibold">{paper.name}</span><span className="font-mono text-[13px] text-[#4A5263]">{mb(paper.size)}{paper.pages != null ? ` · ${t("{n} pages", { n: paper.pages })}` : ""}</span></div>
                <div className="mt-2 inline-block rounded-[4px] px-2.5 py-1.5 text-[15px] font-semibold" style={{ background: fails ? "#FDECEA" : warns ? "#FBEFDD" : "#E1F3EA", color: fails ? "#B3261E" : warns ? "#7A4508" : "#14603F" }}>
                  {fails ? t(fails === 1 ? "{n} problem to fix" : "{n} problems to fix", { n: fails }) : t("Passed")}{warns ? ` · ${t(warns === 1 ? "{n} warning" : "{n} warnings", { n: warns })}` : ""}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => paperInput.current?.click()} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px]">{t("Replace file")}</button>
                  <OpenViewer id={id} files={[paper, ...current.filter((f) => f.id !== paper.id)]} label={t("Open in viewer")} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px]" />
                  <button type="button" onClick={() => open(paper.path)} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px]">{t("Download")}</button>
                </div>
              </div>
            </div>
            {/* Full check list (page size, length, fonts, margins, file) hidden for now:
            <ul className="m-0 mt-5 list-none border-t border-[#EEF0EC] p-0">
              {items.map((it) => {
                const [g, bg, ink] = ICON[it.level];
                return (
                  <li key={it.key} className="flex gap-3 border-b border-[#EEF0EC] py-3">
                    <span aria-hidden className="flex size-[22px] flex-none items-center justify-center rounded-full text-[12px] font-bold" style={{ background: bg, color: ink }}>{g}</span>
                    <span><span className="font-semibold">{t(it.label)}</span> · {it.valueI18n ? t(it.valueI18n.key, it.valueI18n.vars) : t(it.value)}<span className="block text-[14px]" style={{ color: it.level === "ok" ? "#4A5263" : ink }}>{it.i18n ? t(it.i18n.key, it.i18n.vars) : t(it.detail)}</span></span>
                  </li>
                );
              })}
            </ul> */}
            {/* Page size and Length always; any other check only when it fails or warns (so the author sees what to fix). */}
            {items.length ? (
              <ul className="m-0 mt-5 list-none border-t border-[#EEF0EC] p-0">
                {items.filter((it) => it.key === "size" || it.key === "length" || it.level !== "ok").map((it) => {
                  const [g, bg, ink] = ICON[it.level];
                  return (
                    <li key={it.key} className="flex gap-3 border-b border-[#EEF0EC] py-3">
                      <span aria-hidden className="flex size-[22px] flex-none items-center justify-center rounded-full text-[12px] font-bold" style={{ background: bg, color: ink }}>{g}</span>
                      <span><span className="font-semibold">{t(it.label)}</span> · {it.valueI18n ? t(it.valueI18n.key, it.valueI18n.vars) : t(it.value)}<span className="block text-[14px]" style={{ color: it.level === "ok" ? "#4A5263" : ink }}>{it.i18n ? t(it.i18n.key, it.i18n.vars) : t(it.detail)}</span></span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </>
        )}
        {error ? <p role="alert" className="mt-3 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{error}</p> : null}
        {/* Guide from the page: page budget and fixing common problems. */}
        {guide}
      </section>

      <section className={`${card} mt-6`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2"><h2 className={h2}>{t("Files in this submission")}</h2><span className="text-[14px] text-[#4A5263]">{t(current.length === 1 ? "{n} file · reviewers see all of them" : "{n} files · reviewers see all of them", { n: current.length })}</span></div>
        <ul className="m-0 mt-3 list-none p-0">
          {current.map((f) => (
            <li key={f.id} className="border-b border-[#EEF0EC] py-3">
              <div className="flex flex-wrap items-center gap-3">
                <span aria-hidden className="flex h-8 w-11 flex-none items-center justify-center rounded-[4px] bg-[#EEF0EC] font-mono text-[11px] font-semibold text-[#4A5263]">{ext(f.name)}</span>
                <span className="min-w-0 flex-auto">
                  <span className="block truncate font-semibold">{f.name}</span>
                  <span className="block text-[13px] text-[#4A5263]">{t(f.role === "paper" ? "Paper" : EXTRA.find((e) => e.role === f.role)?.label ?? "")} · {mb(f.size)} · v{f.version}</span>
                </span>
                <button type="button" onClick={() => open(f.path)} className="h-8 rounded-[4px] border border-[#B7BDC9] bg-white px-2.5 text-[13px]">{t("Open")}</button>
                {f.role !== "paper" ? <button type="button" onClick={async () => { const r = await removeFile(f.id, id); if (r.error) setError(t(r.error)); else router.refresh(); }} aria-label={t("Remove {name}", { name: f.name })} className="h-8 rounded-[4px] border border-[#F3C3BE] bg-white px-2.5 text-[13px] text-[#B3261E]">{t("Remove")}</button> : null}
              </div>
              {f.role === "paper" && older.length ? (
                <details className="ml-14 mt-2 text-[13px]">
                  <summary className="cursor-pointer text-[#2F5FD0]">{t("Version history ({n})", { n: older.length + 1 })}</summary>
                  <ol className="m-0 mt-2 list-none p-0 text-[#4A5263]">
                    <li><strong className="text-[#121826]">v{f.version}</strong> · {new Date(f.createdAt).toLocaleString(t.intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} · {t("current")}</li>
                    {older.map((o) => <li key={o.id} className="mt-1"><strong>v{o.version}</strong> · {new Date(o.createdAt).toLocaleString(t.intl, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}{o.check.status === "failed" ? ` · ${t("had problems")}` : ""} · <button type="button" onClick={() => open(o.path)} className="border-0 bg-transparent p-0 text-[#2F5FD0] underline">{t("View")}</button></li>)}
                  </ol>
                </details>
              ) : null}
            </li>
          ))}
          {current.length === 0 ? <li className="py-3 text-[14px] text-[#4A5263]">{t("No files yet.")}</li> : null}
        </ul>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <label htmlFor="sb5-add" className="text-[14px] font-medium">{t("Add")}</label>
          <select id="sb5-add" value={extraRole} onChange={(e) => setExtraRole(e.target.value as Role)} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-2 text-[14px]">
            {EXTRA.map((e) => <option key={e.role} value={e.role}>{t(e.label)}</option>)}
          </select>
          <input ref={extraInput} type="file" accept={EXTRA.find((e) => e.role === extraRole)?.accept} className="sr-only" aria-label={t("Choose supplementary file")} onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ""; if (f) upload(f, extraRole); }} />
          <button type="button" onClick={() => extraInput.current?.click()} disabled={!!busy} className="h-9 rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[14px]">{t("Choose file…")}</button>
          <span className="text-[13px] text-[#4A5263]">{t("Every file must be anonymous too.")}</span>
        </div>
      </section>

      <form action={action}>
        <input type="hidden" name="submissionId" value={id} />
        {state.error ? <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{t(state.error)}</p> : null}
        <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] pt-6">
          <div className="flex gap-2">
            <Link href={`/submissions/${id}/authors`} className={ghostBtn}>{t("← Back")}</Link>
            <button type="submit" name="intent" value="exit" className={`${ghostBtn} hidden sm:inline-flex`}>{t("Save and exit")}</button>
          </div>
          <button type="submit" name="intent" value="next" disabled={pending || !canContinue || !!busy} className={primaryBtn}>{pending ? t("Saving…") : canContinue ? t("Continue to review →") : t("Fix the PDF to continue")}</button>
        </div>
      </form>
    </>
  );
}
