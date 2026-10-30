"use client";

import Link from "@/components/site/link";
import { useActionState, useState, useTransition } from "react";
import { addCoauthor, lookupPerson, saveAuthors, type ActionState } from "@/lib/submission/actions";
import { card, ghostBtn, h2, primaryBtn } from "@/components/submission/shell";
import { useT } from "@/lib/i18n/client";

export type Row = { key: string; personId?: string; email?: string; givenName?: string; familyName?: string; name: string; institution: string | null; sub: string; corresponding: boolean; isYou: boolean; invite: boolean };

const toPayload = (rows: Row[]) => JSON.stringify(rows.map((r) => (r.personId ? { personId: r.personId, corresponding: r.corresponding } : { email: r.email, givenName: r.givenName ?? "", familyName: r.familyName ?? "", institution: r.institution ?? undefined, corresponding: r.corresponding })));

const initials = (n: string) => n.replace(/[^\p{L}\s]/gu, "").split(/\s+/).filter(Boolean).map((p) => p[0]).slice(0, 2).join("").toUpperCase() || "?";

/** SB03: ordered author list + add a co-author. */
export function AuthorsForm({ id, initial, event, agreed = false }: { id: string; initial: Row[]; event: string; agreed?: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<ActionState, FormData>(saveAuthors, {});
  const [rows, setRows] = useState<Row[]>(initial);
  const [q, setQ] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const [newPerson, setNewPerson] = useState<{ email: string; givenName: string; familyName: string; institution: string } | null>(null);
  const [looking, startLook] = useTransition();
  const [ok, setOk] = useState<string | null>(null);
  const [commit, setCommit] = useState(agreed);
  const [triedNext, setTriedNext] = useState(false);

  /** Saves the list with the new co-author at once and emails them (account + "Set your password", or an invitation). */
  function addAndInvite(next: Row[], added: Parameters<typeof addCoauthor>[2], who: string) {
    const before = rows;
    setRows(next); setMsg(null); setOk(null);
    startLook(async () => {
      const r = await addCoauthor(id, toPayload(next), added);
      if (r.error) { setRows(before); setMsg(t(r.error)); return; }
      setOk(r.result === "account_created" ? t("Added. We created an account for {who} and emailed them a link to set their password.", { who })
        : r.result === "invited" ? t("Added. We emailed {who} an invitation.", { who })
        : r.result === "added" ? t("Added {who} to the authors.", { who })
        : t("Added to the list, but the email to {who} couldn't be sent.", { who }));
    });
  }

  const move = (i: number, d: -1 | 1) => setRows((r) => { const n = r.slice(); [n[i], n[i + d]] = [n[i + d], n[i]]; return n; });
  const remove = (i: number) => setRows((r) => { const n = r.filter((_, k) => k !== i); if (!n.some((x) => x.corresponding) && n[0]) n[0] = { ...n[0], corresponding: true }; return n; });
  const setCorr = (i: number) => setRows((r) => r.map((x, k) => ({ ...x, corresponding: k === i })));

  function find() {
    const query = q.trim();
    setMsg(null);
    if (!query) return;
    startLook(async () => {
      const r = await lookupPerson(query);
      if (r.error) { setMsg(t(r.error)); return; }
      if (r.found) {
        if (rows.some((x) => x.personId === r.found!.personId)) { setMsg(t("{name} is already on the list.", { name: r.found.name })); return; }
        const f = r.found;
        const who = /^\d+$/.test(f.name) ? `PIN ${f.name}` : f.name;
        addAndInvite([...rows, { key: f.personId, personId: f.personId, name: who, institution: f.institution, sub: [f.institution, f.plenaryId].filter(Boolean).join(" · "), corresponding: false, isYou: false, invite: false }], { personId: f.personId, name: who }, who);
        setQ("");
        return;
      }
      // An account that hasn't finished signing up: added as is (its sign-up name is used on save).
      if (r.pending) {
        const p = r.pending;
        if (rows.some((x) => x.email === p.email)) { setMsg(t("That email is already on the list.")); return; }
        setRows((rs) => [...rs, { key: p.email, email: p.email, givenName: "", familyName: "", name: p.name, institution: null, sub: p.email, corresponding: false, isYou: false, invite: true }]);
        setQ("");
        return;
      }
      if (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(query)) setNewPerson({ email: query.toLowerCase(), givenName: "", familyName: "", institution: "" });
      else setMsg(t("No one with that PIN. Check it, or add them by email."));
    });
  }

  function addNew() {
    if (!newPerson) return;
    if (!newPerson.familyName.trim() && !newPerson.givenName.trim()) { setMsg(t("Enter their name.")); return; }
    if (rows.some((x) => x.email === newPerson.email)) { setMsg(t("That email is already on the list.")); return; }
    const name = `${newPerson.givenName} ${newPerson.familyName}`.trim();
    const p = { email: newPerson.email, givenName: newPerson.givenName.trim(), familyName: newPerson.familyName.trim(), institution: newPerson.institution.trim() };
    addAndInvite([...rows, { key: p.email, email: p.email, givenName: p.givenName, familyName: p.familyName, name, institution: p.institution || null, sub: [p.institution, p.email].filter(Boolean).join(" · "), corresponding: false, isYou: false, invite: true }], p, name || p.email);
    setNewPerson(null); setQ("");
  }

  const payload = toPayload(rows);
  // Institutions in byline order, numbered 1, 2, 3… (each once) — for the byline, hidden for now.
  // const insts = [...new Set(rows.map((r) => r.institution).filter(Boolean))] as string[];
  const iconBtn = "flex size-8 items-center justify-center rounded-[4px] border border-[#B7BDC9] bg-white text-[14px] disabled:opacity-35";
  const field = "h-11 w-full rounded-[4px] border border-[#B7BDC9] bg-white px-3 text-[15px]";

  return (
    <form action={action}>
      <input type="hidden" name="submissionId" value={id} />
      <input type="hidden" name="authors" value={payload} />
      <section className={card}>
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className={h2}>{t("Authors")}</h2>
          <span className="text-[14px] text-[#4A5263]">{t(rows.length === 1 ? "{n} author · in the order they appear on the paper" : "{n} authors · in the order they appear on the paper", { n: rows.length })}</span>
        </div>
        <ol className="m-0 mt-4 flex list-none flex-col gap-2.5 p-0">
          {rows.map((r, i) => (
            <li key={r.key} className="flex flex-wrap items-center gap-3 rounded-[8px] sm:flex-nowrap border border-[#DADDE3] px-3.5 py-3" style={{ background: r.isYou ? "#F7F9FE" : "#FFFFFF" }}>
              <span className="w-4 font-mono text-[14px] text-[#4A5263]">{i + 1}</span>
              <span aria-hidden className="flex size-9 flex-none items-center justify-center rounded-full text-[13px] font-semibold" style={{ background: r.isYou ? "#E6EDFC" : "#FBEFDD", color: r.isYou ? "#1F47A8" : "#7A4508" }}>{initials(r.name)}</span>
              <span className="min-w-0 flex-auto">
                <span className="flex flex-wrap items-center gap-2 font-semibold">{r.name}
                  {r.isYou ? <span className="rounded-[2px] bg-[#E6EDFC] px-1.5 font-mono text-[11px] font-medium text-[#1F47A8]">{t("YOU")}</span> : null}
                  {r.invite ? <span className="rounded-[2px] bg-[#FBEFDD] px-1.5 font-mono text-[11px] font-medium text-[#7A4508]">{t("ACCOUNT + INVITATION")}</span> : null}
                </span>
                <span className="block truncate text-[14px] text-[#4A5263]">{r.sub || "—"}</span>
              </span>
              <label className="flex flex-none items-center gap-2 whitespace-nowrap text-[14px]">
                <input type="radio" name="corr" checked={r.corresponding} onChange={() => setCorr(i)} className="size-[18px] accent-[#0E1B3D]" />{t("Corresponding")}
              </label>
              <span className="flex flex-none gap-1.5">
                <button type="button" onClick={() => move(i, -1)} disabled={i === 0} aria-label={t("Move {name} up", { name: r.name })} className={iconBtn}>↑</button>
                <button type="button" onClick={() => move(i, 1)} disabled={i === rows.length - 1} aria-label={t("Move {name} down", { name: r.name })} className={iconBtn}>↓</button>
                <button type="button" onClick={() => remove(i)} disabled={r.isYou} aria-label={t("Remove {name}", { name: r.name })} className={`${iconBtn} text-[#B3261E]`}>×</button>
              </span>
            </li>
          ))}
        </ol>

      </section>

      <section className={`${card} mt-6`}>
        <h2 className={h2}>{t("Add a co-author")}</h2>
        <label htmlFor="sb3-q" className="mt-4 block font-medium">{t("PIN or Email")}</label>
        <div className="mt-1.5 flex gap-2">
          <input id="sb3-q" value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); find(); } }} placeholder="PIN 10024 · colleague@uni.edu" className={`${field} h-12 flex-auto text-[16px]`} />
          <button type="button" onClick={find} disabled={looking} className="h-12 rounded-[4px] bg-[#0E1B3D] px-4 text-[15px] font-semibold text-white disabled:opacity-60">{looking ? t("Finding…") : t("Add")}</button>
        </div>
        {msg ? <p role="status" className="mt-2 text-[14px] text-[#7A4508]">{msg}</p>
          : ok ? <p role="status" className="mt-2 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3 py-2 text-[14px] text-[#14603F]">✓ {ok}</p>
          : <p className="mt-2 text-[14px] text-[#4A5263]">{t("People with a Plenary account are found by email or PIN and get an invitation. Anyone else gets an account and an email to set their password — as soon as you add them.")}</p>}
        {newPerson ? (
          <div className="mt-3 rounded-[8px] border border-[#F1D29A] bg-[#FFF6E6] p-4">
            <p className="m-0 text-[14px] text-[#3B2A07]"><strong>{newPerson.email}</strong> {t("isn't on Plenary yet. Add their name and institution — we'll create their account and email them a link to set their password.")}</p>
            <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
              <label className="text-[14px] font-medium">{t("Given name")}<input value={newPerson.givenName} onChange={(e) => setNewPerson({ ...newPerson, givenName: e.target.value })} className={`${field} mt-1`} /></label>
              <label className="text-[14px] font-medium">{t("Family name")}<input value={newPerson.familyName} onChange={(e) => setNewPerson({ ...newPerson, familyName: e.target.value })} className={`${field} mt-1`} /></label>
              <label className="text-[14px] font-medium sm:col-span-2">{t("Institution")} <span className="font-normal text-[#4A5263]">{t("(used for conflicts)")}</span><input value={newPerson.institution} onChange={(e) => setNewPerson({ ...newPerson, institution: e.target.value })} className={`${field} mt-1`} /></label>
            </div>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={addNew} disabled={looking} className="h-10 rounded-[4px] bg-[#0E1B3D] px-4 text-[14px] font-semibold text-white disabled:opacity-60">{looking ? t("Adding…") : t("Add co-author and send invitation")}</button>
              <button type="button" onClick={() => setNewPerson(null)} className="h-10 rounded-[4px] border border-[#B7BDC9] bg-white px-4 text-[14px]">{t("Cancel")}</button>
            </div>
          </div>
        ) : null}

        {/* Help: how co-authors are handled, and where conflicts come from (the byline is hidden for now). */}
        <div className="mt-5 grid gap-4 rounded-[8px] border border-[#EEF0EC] bg-[#FBFBF9] p-4">
          {/* Byline in the program hidden for now.
          <div>
            <p className="m-0 font-mono text-[11px] font-medium uppercase tracking-[0.06em] text-[#4A5263]">{t("Byline in the program")}</p>
            <p className="m-0 mt-2 font-serif text-[17px] leading-[1.4]">
              {rows.map((r, i) => (
                <span key={r.key}>{i ? ", " : ""}{r.name}{r.institution ? <sup className="ml-px font-sans text-[11px] text-[#1F47A8]">{insts.indexOf(r.institution) + 1}</sup> : null}</span>
              ))}
            </p>
            {insts.length ? (
              <ol className="m-0 mt-2 flex list-none flex-col gap-1 p-0 text-[13px] text-[#4A5263]">
                {insts.map((x, k) => <li key={x} className="flex gap-1.5"><sup className="mt-1.5 font-sans text-[11px] text-[#1F47A8]">{k + 1}</sup><span>{x}</span></li>)}
              </ol>
            ) : null}
          </div> */}
          <div>
            <p className="m-0 text-[14px] font-semibold">{t("How co-authors are handled")}</p>
            <ul className="m-0 mt-2 flex list-none flex-col gap-1.5 p-0 text-[14px] leading-[1.45]">
              {[
                t("New co-authors get an account and an email to set their password; those with an account get an invitation."),
                t("Everyone can see the paper and its status once they sign in."),
                t("You can submit before they confirm."),
                t("The author list is locked at the deadline — changes after that go to the program chair."),
              ].map((line) => (
                <li key={line} className="flex gap-2"><span aria-hidden className="mt-px flex size-[18px] flex-none items-center justify-center rounded-full bg-[#E1F3EA] text-[11px] font-bold text-[#14603F]">✓</span><span>{line}</span></li>
              ))}
            </ul>
          </div>
          <p className="m-0 rounded-[6px] border border-[#D3DFFA] bg-[#F4F7FE] px-3 py-2 text-[13px] leading-[1.45] text-[#1F3B7A] ">
            <strong>{t("Conflicts come from this list.")}</strong> {t("Your co-authors' institutions are excluded from reviewing automatically.")}
          </p>
        </div>
      </section>

      {/* Commitment: the terms PaperCept shows on its submission form, with this event's name. Required to continue. */}
      <section className={`${card} mt-6`} aria-labelledby="sb3-commit">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 id="sb3-commit" className={h2}>{t("Commitment")} <span className="text-[#B3261E]">*</span></h2>
          <span className="text-[14px] font-semibold text-[#4A5263]">{t("Paper Submitted to {event}", { event })}</span>
        </div>
        <div className="mt-3 text-[14px] leading-[1.55] text-[#121826]">
          <p className="m-0">By uploading this paper I agree to comply with the registration policy established by {event}, and to attend the conference to present the paper if my submission is accepted. By uploading this manuscript, I certify that:</p>
          <ol className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            <li>(1) The manuscript is submitted with the full knowledge and consent of all co-authors (if any), and that I will keep my co-authors informed of all correspondence about the manuscript.</li>
            <li>(2) This submission represents original work that neither has appeared or has been accepted to appear elsewhere for publication, nor is simultaneously under review for another publication, in its current form. I certify that if this submission contains any of the coauthors&apos; previously published work(s) as a basis for this new submission, I have cited the previous work(s) and have indicated how the new submission offers substantive novel contributions beyond those of the previously published work(s).</li>
            <li>(3) None of the authors are on the IEEE Restricted Author List.</li>
            <li>(4) Following the conference registration policy, if my manuscript is accepted by the conference, I or one of my co-authors or colleagues will register and attend the conference to present the paper. In the event I am unable to attend the conference for any reason, it is my responsibility to ensure that the paper is presented at the conference, either by one of my co-authors or by a qualified colleague.</li>
          </ol>
          <p className="m-0 mt-3">I also understand that</p>
          <ol className="m-0 mt-2 flex list-none flex-col gap-2 p-0">
            <li>(5) After submission, my manuscript will be tested for similarity and overlap with prior published material using the iThenticate tool (or equivalent software). Results of such overlap will be made available to the Program Committee for evaluation.</li>
            <li>(6) The decision regarding the acceptance of my manuscript and the possible scheduling in the conference program is at the discretion of the conference&apos;s Technical Program Committee.</li>
          </ol>
        </div>
        <label className="mt-3 flex items-center gap-3 text-[15px] font-semibold">
          <input type="checkbox" name="commitment" checked={commit} onChange={(e) => setCommit(e.target.checked)} aria-invalid={(triedNext && !commit) || undefined} className="size-[18px] flex-none accent-[#0E1B3D]" />
          {t("I agree")} <span className="text-[#B3261E]">*</span>
        </label>
        {triedNext && !commit ? <p role="alert" className="m-0 mt-1.5 text-[13px] text-[#B3261E]">{t("Tick “I agree” under Commitment to continue.")}</p> : null}
      </section>

      {state.error ? <p role="alert" className="mt-4 rounded-[6px] border border-[#F3C3BE] bg-[#FDECEA] px-3 py-2 text-[14px] text-[#5C1A15]">{t(state.error)}</p> : null}
      <div className="mt-7 flex flex-wrap items-center justify-between gap-3 border-t border-[#DADDE3] pt-6">
        <div className="flex gap-2">
          <Link href={`/submissions/${id}/details`} className={ghostBtn}>{t("← Back")}</Link>
          <button type="submit" name="intent" value="exit" className={`${ghostBtn} hidden sm:inline-flex`}>{t("Save and exit")}</button>
        </div>
        <button type="submit" name="intent" value="next" disabled={pending || !rows.length} onClick={(e) => { if (!commit) { e.preventDefault(); setTriedNext(true); } }} className={primaryBtn}>{pending ? t("Saving…") : t("Continue to upload →")}</button>
      </div>
    </form>
  );
}
