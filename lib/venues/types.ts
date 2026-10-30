export type Field = "control" | "robotics" | "ocean" | "systems";
export type DateKind = "submission" | "proposal" | "notification" | "conference" | "final" | "registration" | "other";

export type VenueDate = {
  id: string;
  kind: DateKind;
  label: string;
  startsAt: string;       // ISO instant
  endsAt: string | null;
  isHard: boolean;
  isExtended: boolean;
  extendedFrom: string | null;
};

export type DirectoryVenue = {
  id: string;
  slug: string;
  acr: string;            // short_name or name
  name: string;
  kind: "conference" | "workshop" | "journal" | "award";
  society: string | null;
  field: Field | null;
  format: "in_person" | "hybrid" | "online" | null;
  reviewMode: string | null;
  pageLimit: string | null;
  indexedIn: string[];
  accepting: string | null;
  city: string | null;
  country: string | null;
  location: string | null;
  region: string | null;
  lat: number | null;
  lng: number | null;
  placeHint: string | null;
  startsOn: string | null;
  endsOn: string | null;
  papersCount: number | null;
  acceptanceRate: number | null;
  bestPaper: string | null;
  importedFrom: string | null;
  dates: VenueDate[];
  cover: VenueCover | null;
  /** The event's own website, and an outside submission site when papers are submitted elsewhere (details.external_submit_url). */
  website?: string | null;
  submitUrl?: string | null;
};

/** Focus point of a cover image (which part stays visible in every crop). */
export type CoverFocus = "top-left" | "top" | "top-right" | "left" | "center" | "right" | "bottom-left" | "bottom" | "bottom-right";
/** Cover image, stored in venues.details.cover: an uploaded file (path in 'venue-media') or a licensed external URL. */
export type VenueCover = { path?: string | null; url?: string | null; alt?: string | null; credit?: string | null; creditUrl?: string | null; focus?: CoverFocus | null; /** "contain": a low-resolution banner (PaperCept thumbnail), shown whole and stretched taller; "banner": a sharp banner from the event's own site, shown whole at its own shape. */ fit?: "cover" | "contain" | "banner" | null; /** A photo for the event page header when the cover itself is a banner (shown on the cards). */ hero?: string | null };

export type VenueDetails = {
  cfp?: string;
  topics?: string[];
  /** stage / opensAt: from submission_types.stage and opens_at (the event page's "How to submit" table). */
  types?: { name: string; note?: string; length?: string; review?: string; stage?: "first" | "final"; opensAt?: string }[];
  /**
   * The "How to submit" table as the organizers publish it (venues.details.schedule): rows by stage, first =
   * First submissions (new papers, proposals), final = Final submissions (final versions). `type` = the submission
   * type a first-stage row starts. Dates are ISO instants, shown as the calendar day in `time_zone`.
   */
  schedule?: {
    time_zone?: string; rows: { stage: "first" | "final"; label: string; type?: string; opens?: string; deadline?: string }[];
    /** The organizers' text above the table (PaperCept "Submit a contribution"): intro lines, titled notes, a footnote. */
    intro?: string[]; notes?: { title: string; text: string }[]; footnote?: string;
    /** The organizers' "Information about <event>" box, when they wrote one: paragraphs and bulleted lists. */
    info?: { title: string; updated?: string; blocks: ({ text: string } | { list: string[] })[] };
  };
  policies?: { title: string; text: string; tag?: string }[];
  publication?: { proceedings?: string; copyright?: string; journal?: string };
  organizers?: { role: string; name: string; org?: string; topic?: string }[];
  website?: string | null;
};

export const FIELD_LABEL: Record<Field, string> = { control: "Control", robotics: "Robotics", ocean: "Ocean engineering", systems: "Systems & decision" };
export const FIELD_COLOR: Record<Field, [string, string]> = { control: ["#E6EDFC", "#1F47A8"], robotics: ["#FBEFDD", "#7A4508"], ocean: ["#E1F3EA", "#14603F"], systems: ["#EEF0EC", "#4A5263"] };
export const FORMAT_LABEL = { in_person: "In person", hybrid: "Hybrid", online: "Online" } as const;
export const KIND_LABEL = { conference: "Conference", workshop: "Workshop", journal: "Journal", award: "Award" } as const;
