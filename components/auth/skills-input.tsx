"use client";

import { useId, useMemo, useState } from "react";
import { X } from "lucide-react";
import { ui } from "@/components/auth/split-layout";
import { useT } from "@/lib/i18n/client";
import { MAX_SKILLS, SKILLS } from "@/lib/skills/keywords";

/** Keywords matching what was typed: a word starting with it first, then anywhere in the keyword. */
function suggest(q: string, taken: string[]) {
  const s = q.trim().toLowerCase();
  if (!s) return [];
  const free = SKILLS.filter((k) => !taken.includes(k));
  const starts = free.filter((k) => k.toLowerCase().split(/[\s-]+/).some((w) => w.startsWith(s)));
  const inside = free.filter((k) => !starts.includes(k) && k.toLowerCase().includes(s));
  return [...starts, ...inside].slice(0, 8);
}

/** The keyword with the typed letters in bold. */
function Marked({ text, q }: { text: string; q: string }) {
  const i = text.toLowerCase().indexOf(q.trim().toLowerCase());
  if (i < 0 || !q.trim()) return <>{text}</>;
  const n = q.trim().length;
  return <>{text.slice(0, i)}<strong>{text.slice(i, i + n)}</strong>{text.slice(i + n)}</>;
}

/**
 * Sign-up Skills: one text box. Typing shows the matching keywords (lib/skills/keywords.ts) as you type; picking one
 * adds it as a tag. Posts `skills` (the chosen keywords joined with "; ") and reports them through `onChange`.
 */
export function SkillsInput({ id, onChange, invalid = false }: { id: string; onChange?: (skills: string[]) => void; invalid?: boolean }) {
  const t = useT();
  const listId = useId();
  const [skills, setSkills] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const [open, setOpen] = useState(false);
  const options = useMemo(() => suggest(q, skills), [q, skills]);
  const full = skills.length >= MAX_SKILLS;

  const update = (next: string[]) => { setSkills(next); onChange?.(next); };
  const add = (k: string) => { if (!skills.includes(k) && !full) update([...skills, k]); setQ(""); setActive(0); };
  const shown = open && options.length > 0;

  return (
    <div className="relative flex flex-col gap-1.5">
      <input type="hidden" name="skills" value={skills.join("; ")} />
      {skills.length ? (
        <ul className="m-0 flex list-none flex-wrap gap-1.5 p-0" aria-label={t("Your skills")}>
          {skills.map((k) => (
            <li key={k} className="inline-flex items-center gap-1 rounded-full bg-[#E6EDFC] py-1 pl-3 pr-1.5 text-[13px] font-medium text-[#1F47A8]">
              {t(k)}
              <button type="button" onClick={() => update(skills.filter((x) => x !== k))} aria-label={t("Remove {x}", { x: t(k) })} className="flex size-5 items-center justify-center rounded-full border-0 bg-transparent p-0 text-[#1F47A8] hover:bg-[#D3DFFA]">
                <X size={13} aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
      <input id={id} value={q} disabled={full} autoComplete="off" role="combobox" aria-expanded={shown} aria-controls={listId} aria-autocomplete="list"
        aria-activedescendant={shown ? `${listId}-${active}` : undefined} aria-required="true" aria-invalid={invalid || undefined}
        placeholder={full ? t("You can choose up to {n} skills.", { n: MAX_SKILLS }) : t("Start typing, e.g. control, robotics, optimization")}
        onChange={(e) => { setQ(e.target.value); setActive(0); setOpen(true); }}
        onFocus={() => setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => {
          if (!shown) return;
          if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (a + 1) % options.length); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (a - 1 + options.length) % options.length); }
          else if (e.key === "Enter") { e.preventDefault(); add(options[active]); }
          else if (e.key === "Escape") setOpen(false);
        }}
        className={ui.input} style={{ border: invalid ? "2px solid #B3261E" : "1px solid #B7BDC9" }} />
      {shown ? (
        <ul id={listId} role="listbox" className="absolute left-0 right-0 top-full z-20 m-0 mt-1 max-h-64 list-none overflow-auto rounded-[6px] border border-[#B7BDC9] bg-white p-1 shadow-[0_8px_24px_rgba(18,24,38,.14)]">
          {options.map((k, i) => (
            <li key={k} id={`${listId}-${i}`} role="option" aria-selected={i === active}
              onMouseDown={(e) => { e.preventDefault(); add(k); }} onMouseEnter={() => setActive(i)}
              className={`cursor-pointer rounded-[4px] px-3 py-2 text-[14px] text-[#121826] ${i === active ? "bg-[#EEF2FC]" : ""}`}>
              <Marked text={k} q={q} />
            </li>
          ))}
        </ul>
      ) : open && q.trim() && !full ? (
        <p className="m-0 text-[13px] text-[#4A5263]">{t("No skill matches “{q}”.", { q: q.trim() })}</p>
      ) : null}
    </div>
  );
}
