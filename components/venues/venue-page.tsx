import { EventMoreMenu, WebsiteButton } from "@/components/venues/event-actions";
import { CalendarPlus, ExternalLink, Mail, Ticket } from "lucide-react";
import Link from "@/components/site/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { DatesList, FollowButton, LiveHeader, StatusCard } from "@/components/venues/venue-live";
import { getVenue, getVenuePublic } from "@/lib/venues/data";
import { AttendingSection, GallerySection, TravelSection } from "@/components/venues/venue-sections";
import { ContactOrganizers } from "@/components/venues/venue-client";
import { FIELD_LABEL, FORMAT_LABEL } from "@/lib/venues/types";
import { fmtRange } from "@/lib/venues/time";
import { VenueCoverImage, hasRealCover } from "@/components/venues/cover";
import { getT } from "@/lib/i18n/server";
import { getMyEvents } from "@/lib/workspace/events";
import type { MyEvents } from "@/lib/workspace/event-action";
import { WorkspaceEventHeader, YourParticipation } from "@/components/venues/workspace-event";
import { fmtDay, getSubmissionWindow, typeWindow, type SubmissionWindow } from "@/lib/venues/window";

/*
 * One event page, two forms. Public (/venues/[slug]): the navy cover header and the public status card. Workspace
 * (/workspace/events/[slug], signed in): a compact header with the buttons that match what you have there (Continue
 * draft, Submit, Open my paper), a "Your participation" panel, and links that stay inside the workspace. The call,
 * dates, types, policies, publication, attending, program and organizers sections are the same in both.
 */

const h2 = "m-0 font-serif text-[30px] font-normal leading-[1.15]";
const section = "scroll-mt-20 border-t border-[#DADDE3] py-8 first:border-t-0 first:pt-2";
/** Plain organizer text with its web addresses as links (opened in a new tab). */
const linkify = (text: string) => text.split(/(https?:\/\/[^\s]+)/g).map((part, i) => i % 2
  ? <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="break-all text-[#2F5FD0] underline">{part}</a>
  : part);

export async function VenuePage({ slug, mode = "public" }: { slug: string; mode?: "public" | "workspace" }) {
  const ws = mode === "workspace";
  await connection(); // countdowns and the open/closed state use the current time: render per request, never prerendered
  const [data, pub, myEvents] = await Promise.all([getVenue(slug), getVenuePublic(slug), ws ? getMyEvents() : Promise.resolve({} as MyEvents)]);
  if (!data) notFound();
  const win = await getSubmissionWindow(data.venue.id);
  return <VenueView data={data} pub={pub} myEvents={myEvents} mode={mode} win={win} />;
}

type VenueData = NonNullable<Awaited<ReturnType<typeof getVenue>>>;
type VenuePub = Awaited<ReturnType<typeof getVenuePublic>>;

/** Sections switched off for now (page and "On this page" bar). Remove an id to show it again. */
const HIDDEN_SECTIONS = new Set(["cfp", "dates", "policies", "publication", "attending", "travel", "program", "organizers"]);

/** The page itself, from loaded data (the dev preview passes sample data). */
export async function VenueView({ data, pub, myEvents, mode = "public", win = null }: { data: VenueData; pub: VenuePub; myEvents: MyEvents; mode?: "public" | "workspace"; win?: SubmissionWindow | null }) {
  const ws = mode === "workspace";
  const t = await getT();
  const { venue: v, details, website, basics, dbTypes } = data;
  const online = v.kind === "journal" || v.format === "online";
  const generatedAt = new Date().toISOString();
  // const [fbg, fink] = v.field ? FIELD_COLOR[v.field] : ["#E6EDFC", "#1F47A8"]; (society logo box hidden)
  // Field (Control…) and review mode (Single-blind…) badges hidden for now:
  // v.field ? (v.field === "ocean" ? t("Ocean") : v.field) : null, v.reviewMode ? t(v.reviewMode) : null
  const tags = [v.format ? t(FORMAT_LABEL[v.format]) : null, v.indexedIn.length ? v.indexedIn.join(" · ") : null].filter(Boolean) as string[];
  const where = v.kind === "journal" ? t("Online journal") : [v.location ?? [v.city, v.country].filter(Boolean).join(", ")].filter(Boolean).join("");
  const topics = details.topics ?? [];
  const types = dbTypes.length ? dbTypes : details.types ?? [];
  const policies = details.policies ?? [];
  const organizers = details.organizers ?? [];
  const nav: [string, string][] = [
    ["cfp", "Call for Submissions"], ["types", "Submit a contribution"], ["dates", "Important dates"], ["policies", "Policies"], ["publication", "Publication"],
    ...(pub && !online ? ([["attending", "Attending"], ["travel", "Venue & travel"]] as [string, string][]) : []),
    ...(pub?.info.gallery?.length ? ([["gallery", "Gallery"]] as [string, string][]) : []),
    ["program", "Program"], ["organizers", "Organizers"],
  ];
  const shown = nav.filter(([id]) => !HIDDEN_SECTIONS.has(id));
  const mine = myEvents[v.slug];
  // Same rule as the database (lib/venues/window.ts); the date check is only for the dev preview, which has no window.
  const open = win ? win.open : v.kind === "journal" || v.dates.some((d) => (d.kind === "submission" || d.kind === "proposal") && Date.parse(d.startsAt) > Date.parse(generatedAt));
  const closedOn = win && !win.open ? fmtDay(win.closedAt, t.intl) : null;
  const programHref = ws ? `/workspace/events/${v.slug}/program` : `/program/${v.slug}`;
  // "How to submit" rows, grouped by "Submission stage": the stage set for each type in Supabase
  // (submission_types.stage), or, when it isn't set, the Action (open = First Submission, closed = Final Submission).
  // One bold cell spans each stage; the First Submission rows come first.
  const typeRows = types.map((ty) => {
    const w = win ? typeWindow(win, ty.name) : { open: true, deadline: null, closedAt: null };
    return { ty, w, stage: ty.stage ?? (w.open ? "first" : "final") };
  });
  typeRows.sort((a, b) => Number(a.stage === "final") - Number(b.stage === "final"));
  // The table's rows: the organizers' schedule when the event has one (details.schedule), else its submission types.
  type HowRow = { key: string; stage: string; name: string; note?: string; opens: string | null; due: string | null; open: boolean; href: string | null; action: string };
  const sched = details.schedule;
  const dayIn = (iso: string | undefined, tz: string) => {
    if (!iso) return null;
    try { return new Intl.DateTimeFormat(t.intl, { day: "numeric", month: "short", year: "numeric", timeZone: tz }).format(new Date(iso)); } catch { return fmtDay(iso, t.intl); }
  };
  const nowMs = Date.parse(generatedAt);
  const howRows: HowRow[] = sched?.rows?.length
    ? [...sched.rows].sort((a, b) => Number(a.stage === "final") - Number(b.stage === "final")).map((r, i) => {
        const tz = sched.time_zone || "UTC";
        const open = (!r.opens || Date.parse(r.opens) <= nowMs) && (!r.deadline || Date.parse(r.deadline) > nowMs);
        // A first-stage row with no matching submission type in the app still opens the submission page (pick a type there).
        const href = r.stage === "final" ? "/workspace/submissions" : r.type ? `/submit/${v.slug}?type=${encodeURIComponent(r.type)}` : `/submit/${v.slug}`;
        return { key: `${r.stage}-${i}`, stage: r.stage, name: r.label, opens: dayIn(r.opens, tz), due: dayIn(r.deadline, tz), open, href, action: t("Submit") };
      })
    : typeRows.map(({ ty, w, stage }) => ({
        key: ty.name, stage, name: ty.name, note: ty.note,
        opens: ty.opensAt ? fmtDay(ty.opensAt, t.intl) : null,
        // Open / Deadline / Action read the same window as the database (lib/venues/window.ts).
        due: fmtDay(w.open ? w.deadline : (w.closedAt ?? w.deadline), t.intl),
        open: w.open, href: `/submit/${v.slug}?type=${encodeURIComponent(ty.name)}`,
        action: /workshop|proposal/i.test(ty.name) ? t("Propose") : t("Submit"),
      }));
  const openCount = howRows.filter((r) => r.stage === "first").length;
  // "Open" column: the date the submission site opens, one for every type. Organizers name it in different ways
  // ("Submissions open", "Submission site opens", "PaperCept opens"…); "Registration opens" is not one of them.
  const opensOn = fmtDay(v.dates.find((d) => /\bopens?\b/i.test(d.label) && /submission|paper|portal|site/i.test(d.label) && !/registration/i.test(d.label))?.startsAt ?? null, t.intl);

  return (
    <div className="flex min-h-dvh flex-col bg-[#F5F6F3] text-[15px] leading-[1.5] text-[#121826]">
      <LiveHeader />
      {ws ? (
        <WorkspaceEventHeader v={v} tags={tags} where={where} tagline={basics.tagline ?? null} mine={mine} open={open} closedOn={win && !win.open ? (closedOn ?? "") : null} generatedAt={generatedAt} nav={shown} />
      ) : (
      <section className="bg-white">
        {/* PV02 cover header: the organizers' cover image (or the field artwork) behind the title. */}
        <div className="relative overflow-hidden bg-[#0E1B3D] text-[#F5F6F3]">
          <VenueCoverImage cover={v.cover?.hero ? { url: v.cover.hero, fit: "cover", focus: "center" } : v.cover} field={v.field} alt={t("Cover image of {venue}", { venue: v.acr })} priority />
          <div aria-hidden className="absolute inset-0 bg-[linear-gradient(90deg,rgba(14,27,61,0.92)_0%,rgba(14,27,61,0.74)_50%,rgba(14,27,61,0.3)_100%)]" />
        <div className="relative mx-auto max-w-[1280px] px-5 pb-10 pt-7 sm:px-8 lg:min-h-[380px]">
          <nav aria-label={t("Breadcrumb")} className="text-[13px] text-[#D6DCEA]">
            <Link href="/events" className="text-[#F5F6F3] underline">{t("Events")}</Link>
            {v.field ? <> / <Link href="/events" className="text-[#F5F6F3] underline">{t(FIELD_LABEL[v.field])}</Link></> : null} / {v.acr}
          </nav>
          <div className="mt-4 flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 gap-5">
              {/* Society logo box hidden for now. <span aria-hidden className="hidden size-[76px] flex-none items-center justify-center rounded-[8px] px-1 text-center font-mono text-[13px] font-semibold leading-[1.15] sm:flex" style={{ background: fbg, color: fink }}>{v.society ?? v.acr.split(" ")[0].slice(0, 8)}</span> */}
              <div className="min-w-0">
                {/* Badges (format, indexed in) hidden for now.
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((tag) => <span key={tag} className="rounded-[2px] px-2 py-0.5 font-mono text-[11px] font-medium uppercase tracking-[0.04em]" style={{ background: "#EEF0EC", color: "#4A5263" }}>{tag}</span>)}
                </div> */}
                <h1 className="mt-2.5 font-serif text-[42px] font-normal leading-[1.03] tracking-[-0.01em] text-white sm:text-[56px]">{v.acr}</h1>
                <p className="mt-1.5 text-[20px] text-[#F5F6F3]">{v.name}</p>
                {basics.tagline ? <p className="mt-1 text-[16px] italic text-[#D6DCEA]">{basics.tagline}</p> : null}
                <p className="mt-1.5 text-[15px] text-[#D6DCEA]">{[fmtRange(v.startsOn, v.endsOn, t.intl, t, v.kind === "journal"), where, v.society ? t("Sponsored by {society}", { society: v.society }) : null].filter(Boolean).join(" · ")}</p>
              </div>
            </div>
            {/* Countdown card hidden for now.
            <div className="rounded-[8px] shadow-[0_12px_32px_rgba(0,0,0,0.28)] ring-1 ring-white/15"><CountdownCard dates={v.dates} generatedAt={generatedAt} startsOn={v.startsOn} /></div> */}
          </div>
          {/* Buttons under the title and countdown, across the whole header, so they stay on one line in every language. */}
          <div className="mt-6 flex flex-wrap gap-2.5 lg:flex-nowrap">
            {/* Submit a contribution hidden for now.
            {open && v.submitUrl ? <a href={v.submitUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-[4px] bg-white px-4 py-1.5 text-center text-[15px] font-semibold leading-tight text-[#0E1B3D] no-underline hover:bg-[#EEF0EC]">{t("Submit a contribution")}<ExternalLink size={15} aria-hidden /><span className="sr-only">{t("(opens in a new tab)")}</span></a>
              : open ? <Link href={`/submit/${v.slug}`} className="inline-flex min-h-11 w-full items-center justify-center rounded-[4px] bg-white px-4 py-1.5 text-center text-[15px] font-semibold leading-tight text-[#0E1B3D] no-underline hover:bg-[#EEF0EC]">{t("Submit a contribution")}</Link>
              : <span aria-disabled="true" className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-[4px] bg-white/15 px-4 py-1.5 text-center leading-tight text-[15px] font-semibold text-white/80 ring-1 ring-white/30">{closedOn ? t("Submissions closed on {date}", { date: closedOn }) : t("Submissions closed")}</span>} */}
            {/* Register to attend (/venues/[slug]/register): first, in saffron. */}
            <Link href={`/venues/${v.slug}/register`} className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] bg-[#F2A93B] px-4 text-[15px] font-semibold text-[#0E1B3D] no-underline hover:bg-[#E89B26]">
              <Ticket size={15} aria-hidden />{t("Registration")}
            </Link>
            {website ? <WebsiteButton url={website} tone="dark" size="lg" className="justify-center whitespace-nowrap" /> : null}
            {/* Follow hidden for now. <FollowButton venueId={v.id} slug={v.slug} /> */}
            {/* Contact organizers: the same page as on the event cards. */}
            <Link href="/contact" className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border border-white/60 bg-white/70 px-4 text-[15px] font-medium text-[#0E1B3D] no-underline hover:bg-white/80">
              <Mail size={15} aria-hidden />{t("Contact organizers")}
            </Link>
            {/* The deadlines as a calendar file (.ics), last. */}
            <a href={`/venues/${v.slug}/calendar.ics`} className="inline-flex h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-[4px] border border-white/60 bg-white/70 px-4 text-[15px] font-medium text-[#0E1B3D] no-underline hover:bg-white/80">
              <CalendarPlus size={15} aria-hidden />{t("Add to calendar")}
            </a>
            {/* More hidden for now. <EventMoreMenu slug={v.slug} kind={v.kind} tone="dark" size="lg" align="start" onPage up /> */}
          </div>
          {/* Cover photo credit hidden for now.
          {hasRealCover(v.cover) && v.cover?.credit ? (
            <p className="absolute bottom-2.5 right-5 m-0 max-w-[60%] truncate text-right text-[12px] text-white/80 sm:right-8">
              {t("Cover:")} {v.cover.creditUrl ? <a href={v.cover.creditUrl} className="text-white/90 underline" rel="noopener noreferrer" target="_blank">{v.cover.credit}</a> : v.cover.credit}
            </p>
          ) : null} */}
        </div>
        </div>
        {/* Section bar ("On this page") hidden for now: with Call for Submissions hidden, only one section is left.
        <nav aria-label={t("On this page")} className="sticky top-[60px] z-10 border-y border-[#DADDE3] bg-white">
          <div className="mx-auto flex max-w-[1280px] gap-6 overflow-x-auto px-5 text-[15px] sm:px-8">
            {shown.map(([id, label]) => <a key={id} href={`#${id}`} className="flex-none py-3.5 text-[#4A5263] no-underline hover:text-[#121826]">{t(label)}</a>)}
          </div>
        </nav> */}
      </section>
      )}

      <div className="mx-auto box-border flex w-full max-w-[1280px] flex-col gap-10 px-5 pb-16 pt-2 sm:px-8 lg:flex-row lg:items-start">
        <main className="min-w-0 flex-auto">
          {/* Call for Submissions hidden for now.
          <section id="cfp" aria-labelledby="cfp-h" className={section}>
            <h2 id="cfp-h" className={h2}>{t("Call for Submissions")}</h2>
            <p className="mt-3 whitespace-pre-line text-[17px]">{basics.publicText ?? details.cfp ?? t("{acr} — the organizers haven't published the call text yet.", { acr: v.acr })}</p>
            (Topic chips and the "Accepting:" line hidden for now.
            {topics.length ? <div className="mt-4 flex flex-wrap gap-2">{topics.map((tp) => <span key={tp} className="rounded-full border border-[#DADDE3] bg-white px-3 py-1.5 text-[14px]">{tp}</span>)}</div> : null}
            {v.accepting ? <p className="mt-4 text-[14px] text-[#4A5263]">{t("Accepting:")} {t(v.accepting)}</p> : null}
            )
          </section> */}

          <section id="types" aria-labelledby="types-h" className={section}>
            <h2 id="types-h" className={h2}>{t("Submit a Contribution to {venue}", { venue: v.acr })}</h2>
            {/* The organizers' "Information about <event>" box (details.schedule.info), only for events that have one. */}
            {sched?.info?.blocks.length ? (
              <div className="mt-3 rounded-[8px] border border-[#2F5FD0]/40 bg-[#F4F7FE] px-4 py-3 text-[14px] text-[#121826]">
                <p className="m-0"><strong className="text-[#1F47A8]">{sched.info.title}</strong>{sched.info.updated ? <span className="ms-2 text-[13px] text-[#4A5263]">{t("Last updated: {date}", { date: sched.info.updated })}</span> : null}</p>
                {sched.info.blocks.map((b, i) => "list" in b
                  ? <ul key={i} className="mt-2 list-[square] space-y-0.5 ps-5">{b.list.map((li) => <li key={li}>{linkify(li)}</li>)}</ul>
                  : <p key={i} className="m-0 mt-2">{linkify(b.text)}</p>)}
              </div>
            ) : null}
            {/* The organizers' own text above the table (details.schedule: intro, notes, footnote), when there is one. */}
            {sched?.intro?.length ? <ul className="mt-2 list-disc space-y-0.5 ps-5 text-[14px] text-[#121826]">{sched.intro.map((l) => <li key={l}>{l}</li>)}</ul> : null}
            {sched?.notes?.map((n) => (
              <div key={n.title} className="mt-3 rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3 text-[14px] text-[#121826]">
                <strong>{n.title}:</strong> {n.text}
              </div>
            ))}
            {sched?.footnote ? <p className="mt-3 text-[13px] font-semibold text-[#4A5263]">{sched.footnote}</p> : null}
            {howRows.length ? (
              <div className="relative mt-4 overflow-x-auto rounded-[8px] border border-[#DADDE3] bg-white">
                <table className="w-full min-w-[720px] border-collapse text-[14px]">
                  <thead><tr className="border-b border-[#DADDE3] text-left font-mono text-[13px] uppercase tracking-[0.06em] text-[#4A5263]"><th className="whitespace-nowrap px-6 py-2.5 font-bold">{t("Submission stage")}</th><th className="px-4 py-2.5 font-bold">{t("Type of submission")}</th><th className="px-6 py-2.5 font-bold">{t("Open")}</th><th className="px-6 py-2.5 font-bold">{t("Deadline")}</th><th className="px-4 py-2.5 text-right font-bold">{t("Action")}</th></tr></thead>
                  <tbody>
                    {howRows.map((row, i) => {
                      const span = i === 0 && openCount ? openCount : i === openCount ? howRows.length - openCount : 0;
                      // A bold line where the "Final Submission" rows start, under the "First Submission" ones.
                      const split = i === openCount && openCount > 0;
                      return (
                      <tr key={row.key} className={`border-b border-[#EEF0EC] last:border-b-0 ${split ? "border-t-2 border-t-[#B7BDC9]" : ""}`}>
                        {span ? <td rowSpan={span} className="whitespace-nowrap border-r border-[#EEF0EC] px-6 py-3 align-middle font-bold">{row.stage === "first" ? t("First Submission") : t("Final Submission")}</td> : null}
                        <td className="px-4 py-3"><strong>{row.name}</strong>{row.note ? <div className="text-[13px] text-[#4A5263]">{row.note}</div> : null}</td>
                        <td className="whitespace-nowrap px-6 py-4 font-mono text-[14px] font-medium tabular-nums text-[#121826]">{(row.opens ?? opensOn) ?? "—"}</td>
                        <td className="whitespace-nowrap px-6 py-4 font-mono text-[14px] font-medium tabular-nums text-[#121826]">{row.due ?? "—"}</td>
                        <td className="px-4 py-3 text-right">{row.open && row.href
                          ? <Link href={row.href} className="font-semibold text-[#2F5FD0]">{row.action}</Link>
                          : <span className="font-semibold text-[#4A5263]">{t("Closed")}</span>}</td>
                      </tr>
                      );
                    })}
                  </tbody>
                  {/* The PDF check note as the table footer, centred. */}
                  <tfoot><tr className="border-t border-[#DADDE3] bg-[#F7F8F6]"><td colSpan={5} className="px-4 py-3 text-center text-[14px] text-[#121826]"><strong>{t("No separate PDF test:")}</strong> {t("Your PDF is checked for fonts, page size, margins and names when you upload it, with the page number of any problem.")}</td></tr></tfoot>
                </table>
              </div>
            ) : <p className="mt-4 text-[14px] text-[#4A5263]">{t("Submission types will be listed here when the call opens.")}</p>}
          </section>

          {/* Important dates hidden for now.
          <section id="dates" aria-labelledby="dates-h" className={section}>
            <h2 id="dates-h" className={h2}>{t("Important dates")}</h2>
            <DatesList dates={v.dates} generatedAt={generatedAt} />
          </section> */}

{!HIDDEN_SECTIONS.has("policies") ? (<>
          <section id="policies" aria-labelledby="policies-h" className={section}>
            <h2 id="policies-h" className={h2}>{t("Policies")}</h2>
            <p className="mt-1 text-[14px] text-[#4A5263]">{t("Read these before you submit. Each one is shown again at the step where it applies.")}</p>
            {policies.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {policies.map((p) => (
                  <div key={p.title} className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5">
                    <div className="flex items-center gap-2 font-semibold">{p.title}{p.tag ? <span className="rounded-[2px] bg-[#FBEFDD] px-1.5 py-px font-mono text-[11px] text-[#7A4508]">{p.tag}</span> : null}</div>
                    <div className="mt-1 text-[14px] text-[#4A5263]">{p.text}</div>
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 text-[14px] text-[#4A5263]">{t("Policies will be published with the call.")}</p>}
          </section>
          </>) : null}

{!HIDDEN_SECTIONS.has("publication") ? (<>
          <section id="publication" aria-labelledby="publication-h" className={section}>
            <h2 id="publication-h" className={h2}>{t("Publication")}</h2>
            <dl className="m-0 mt-4 grid grid-cols-1 gap-x-6 gap-y-2 rounded-[8px] border border-[#DADDE3] bg-white px-4 py-4 text-[14px] sm:grid-cols-[160px_1fr]">
              <dt className="text-[#4A5263]">{t("Proceedings")}</dt><dd className="m-0">{details.publication?.proceedings ?? t("To be announced")}</dd>
              <dt className="text-[#4A5263]">{t("Indexed in")}</dt><dd className="m-0">{v.indexedIn.length ? v.indexedIn.join(", ") : "—"}</dd>
              <dt className="text-[#4A5263]">{t("Copyright")}</dt><dd className="m-0">{details.publication?.copyright ?? t("Signed from your paper page after acceptance.")}</dd>
              {details.publication?.journal ? <><dt className="text-[#4A5263]">{t("Journal option")}</dt><dd className="m-0">{details.publication.journal}</dd></> : null}
            </dl>
          </section>
          </>) : null}

          {pub && !online && !HIDDEN_SECTIONS.has("attending") ? <AttendingSection pub={pub} acr={v.acr} /> : null}
          {pub && !online && !HIDDEN_SECTIONS.has("travel") ? <TravelSection pub={pub} name={v.acr} fallbackPlace={basics.venueAddress ?? v.location ?? ([v.city, v.country].filter(Boolean).join(", ") || null)} hotelsNote={basics.hotels} /> : null}
          {pub ? <GallerySection pub={pub} /> : null}

{!HIDDEN_SECTIONS.has("program") ? (<>
          <section id="program" aria-labelledby="program-h" className={section}>
            <h2 id="program-h" className={h2}>{t("Program")}</h2>
            <div className="mt-4 flex flex-wrap items-center justify-between gap-4 rounded-[8px] border border-[#DADDE3] bg-white px-4 py-4">
              {(v.endsOn ?? v.startsOn) && (v.endsOn ?? v.startsOn)! < generatedAt.slice(0, 10) ? (
                <div><div className="font-semibold">{t("This edition is over.")}</div><div className="text-[14px] text-[#4A5263]"><Link href={ws ? `/workspace/events/${v.slug}/archive` : `/venues/${v.slug}/archive`} className="text-[#2F5FD0] underline">{t("Program, proceedings, awards and figures →")}</Link></div></div>
              ) : (
                <div><div className="font-semibold">{t("The program is published after acceptance.")}</div><div className="text-[14px] text-[#4A5263]">{t("Then you can browse sessions and build My agenda.")}</div></div>
              )}
              <FollowButton venueId={v.id} slug={v.slug} />
            </div>
          </section>
          </>) : null}

{!HIDDEN_SECTIONS.has("organizers") ? (<>
          <section id="organizers" aria-labelledby="organizers-h" className={section}>
            <h2 id="organizers-h" className={h2}>{t("Organizers")}</h2>
            {organizers.length ? (
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {organizers.map((o) => (
                  <div key={o.role + o.name} className="rounded-[8px] border border-[#DADDE3] bg-white px-4 py-3.5">
                    <div className="font-mono text-[11px] uppercase tracking-[0.06em] text-[#4A5263]">{o.role}</div>
                    <div className="mt-1 font-semibold">{o.name}</div>
                    {o.org ? <div className="text-[13px] text-[#4A5263]">{o.org}</div> : null}
                    {o.topic ? <div className="mt-1.5 text-[13px] text-[#4A5263]">{o.topic}</div> : null}
                  </div>
                ))}
              </div>
            ) : <p className="mt-4 text-[14px] text-[#4A5263]">{t("Organizers will be listed here.")}</p>}
          </section>
          </>) : null}
          <p className="mt-2 text-[12px] text-[#4A5263]">{t("Venue content is provided by its organizers.")}</p>
        </main>

        {/* "Your status here", "At a glance" and "Questions?" hidden for now (display: none); signed in, the participation card stays. */}
        <aside className={`${ws ? "flex" : "hidden"} w-full flex-col gap-4 pt-8 lg:w-[320px] lg:flex-none`}>
          {ws ? <YourParticipation slug={v.slug} acr={v.acr} mine={mine} open={open} programHref={programHref} /> : <StatusCard venueId={v.id} acr={v.acr} slug={v.slug} />}
          <section aria-labelledby="ag-h" className="hidden rounded-[8px] border border-[#DADDE3] bg-white p-[18px]">
            <h2 id="ag-h" className="m-0 text-[17px] font-semibold">{t("At a glance")}</h2>
            <dl className="m-0 mt-3 grid grid-cols-[130px_1fr] gap-x-3 gap-y-2 text-[14px]">
              <dt className="text-[#4A5263]">{t("Review")}</dt><dd className="m-0">{v.reviewMode ? t(v.reviewMode) : "—"}</dd>
              {v.acceptanceRate != null ? <><dt className="text-[#4A5263]">{t("Accepted")}</dt><dd className="m-0">{Math.round(v.acceptanceRate)}%{v.papersCount ? ` ${t("of {n}", { n: v.papersCount.toLocaleString(t.intl) })}` : ""}</dd></> : null}
              <dt className="text-[#4A5263]">{t("Proceedings")}</dt><dd className="m-0">{v.indexedIn.length ? v.indexedIn.join(", ") : "—"}</dd>
              <dt className="text-[#4A5263]">{t("Format")}</dt><dd className="m-0">{v.format ? t(FORMAT_LABEL[v.format]) : "—"}</dd>
              <dt className="text-[#4A5263]">{t("Pages")}</dt><dd className="m-0">{v.pageLimit ?? "—"}</dd>
              {website ? <><dt className="text-[#4A5263]">{t("Website")}</dt><dd className="m-0 truncate"><a href={website} rel="noopener noreferrer" target="_blank" className="text-[#2F5FD0] underline">{website.replace(/^https:\/\//, "")}</a></dd></> : null}
            </dl>
          </section>
          <section id="contact" aria-labelledby="q-h" className="hidden scroll-mt-20 rounded-[8px] border border-[#DADDE3] bg-white p-[18px]">
            <h2 id="q-h" className="m-0 text-[17px] font-semibold">{t("Questions?")}</h2>
            <p className="mt-1.5 text-[14px] text-[#4A5263]">{t("Message the right chair. Replies arrive in your Plenary inbox and by email.")}</p>
            <ContactOrganizers venueId={v.id} slug={v.slug} acr={v.acr} />
            <p className="mt-2.5 text-[13px]"><Link href={ws ? "/workspace/support" : "/contact"} className="text-[#2F5FD0] underline">{t("Technical problem? Plenary support")}</Link></p>
          </section>
        </aside>
      </div>
    </div>
  );
}

