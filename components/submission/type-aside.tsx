import { asideCard, noteBlue } from "@/components/submission/shell";
import type { WizardVenue } from "@/lib/submission/data";
import { fmtAoE } from "@/lib/venues/time";
import { getT } from "@/lib/i18n/server";
import { blindLabel, getSubmissionWindow } from "@/lib/venues/window";
import { ChoiceCard, type ChoiceInfo } from "@/components/submission/choice-card";

/**
 * Beside the type step: "Your choice" for every type of the event, from Supabase — pages and review from the
 * submission types (submission_types), open and deadline from the organizers' schedule (venues.details.schedule,
 * shown in the event's time zone) or the type's own deadline. The card follows the type picked in the form.
 */
export async function TypeAside({ venue, type, track }: { venue: WizardVenue; type?: string; track?: string | null }) {
  const [t, info] = await Promise.all([getT(), choiceInfo(venue)]);
  return (
    <>
      {/* "Your choice" card hidden for now. <ChoiceCard info={info} initialType={type && info[type] ? type : null} initialTrack={track ?? null} /> */}
      <section className={asideCard}>
        <h3 className="m-0 text-[17px] font-semibold">{t("Have these ready")}</h3>
        <ul className="mb-0 mt-2.5 flex flex-col gap-1.5 pl-5 text-[15px]">
          <li>{t("Title and abstract (up to 250 words)")}</li>
          <li>{t("Co-authors' emails or PINs")}</li>
          <li>{t("3–5 keywords")}</li>
          <li>{t("PDF in the venue template")}</li>
        </ul>
      </section>
      {venue.doubleBlind ? <div className={noteBlue}><strong>{t("Double-blind review.")}</strong> {t("Reviewers won't see your name. Keep names and acknowledgements out of the PDF.")}</div> : null}
    </>
  );
}

/** Pages, review, open and deadline of every type of the event, for the "Your choice" card (type step and Details). */
export async function choiceInfo(venue: WizardVenue): Promise<Record<string, ChoiceInfo>> {
  const [t, win] = await Promise.all([getT(), getSubmissionWindow(venue.id)]);
  const sched = venue.details.schedule;
  const tz = sched?.time_zone || "UTC";
  const when = (iso: string | undefined, withTime: boolean) => {
    if (!iso) return null;
    try {
      return new Intl.DateTimeFormat(t.intl, withTime
        ? { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: tz, timeZoneName: "short" }
        : { day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(new Date(iso));
    } catch { return iso.slice(0, 10); }
  };
  const seeded = venue.details.types ?? [];
  const names = win?.types.length ? win.types.map((x) => x.name) : seeded.length ? seeded.map((x) => x.name) : ["Regular paper"];
  const info: Record<string, ChoiceInfo> = {};
  for (const name of names) {
    const w = win?.types.find((x) => x.name === name);
    const s = seeded.find((x) => x.name === name);
    const row = sched?.rows.find((r) => r.stage === "first" && r.type === name);
    info[name] = {
      label: row?.label ?? name,
      pages: w?.pages ? `${w.pages}${w.extraPages ? ` + ${w.extraPages}` : ""} ${t("pages")}` : s?.length ?? venue.pageLimit,
      review: blindLabel(w?.blind ?? null) ?? s?.review ?? venue.reviewMode,
      opens: when(row?.opens, false),
      deadline: row?.deadline ? when(row.deadline, true) : w?.deadline ? fmtAoE(w.deadline, t.intl) : venue.deadline ? fmtAoE(venue.deadline, t.intl) : null,
    };
  }
  return info;
}
