"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { checkPdf } from "@/lib/submission/pdf-check";
import { loadSubmission } from "@/lib/submission/data";
import { mdToPlain, wordCount } from "@/lib/rich-text/plain";
import { pageLimitFor } from "@/lib/venues/window";
import { inviteNewCoauthor, notifyCoauthor, type InviteResult } from "@/lib/submission/invite-coauthors";
import { createAdminClient } from "@/lib/supabase/admin";

export type ActionState = { error?: string; fieldErrors?: Record<string, string>; ok?: boolean; savedAt?: string };

const uuid = z.guid();
const friendly = (msg?: string) => {
  if (!msg) return "Something went wrong. Please try again.";
  if (/closed/i.test(msg)) return "Submissions for this venue are closed.";
  if (/cannot edit|cannot submit|permission|42501|row-level/i.test(msg)) return "You can't change this paper any more (deadline passed, withdrawn, or not your paper).";
  return msg.replace(/^.*?:\s*/, "").replace(/^\w/, (c) => c.toUpperCase());
};

async function bumpStep(id: string, step: number) {
  const supabase = await createClient();
  const { data } = await supabase.from("submissions").select("draft_step").eq("id", id).maybeSingle();
  if (data && (data.draft_step ?? 1) < step) await supabase.from("submissions").update({ draft_step: step }).eq("id", id);
}

const go = (id: string, step: string, intent: FormDataEntryValue | null) => {
  revalidatePath(`/submissions/${id}`, "layout");
  if (intent === "exit") redirect("/workspace/submissions");
  redirect(`/submissions/${id}/${step}`);
};

/* SB01 — start a draft, or change type/track of an existing one. */
export async function saveType(_: ActionState, fd: FormData): Promise<ActionState> {
  const paperType = String(fd.get("paperType") ?? "").trim();
  const track = String(fd.get("track") ?? "").trim();
  const errs: Record<string, string> = {};
  if (!paperType) errs.paperType = "Choose what you're submitting.";
  if (!track) errs.track = "Choose a track to continue.";
  if (Object.keys(errs).length) return { fieldErrors: errs };
  const supabase = await createClient();
  const subId = String(fd.get("submissionId") ?? "");
  if (subId) {
    if (!uuid.safeParse(subId).success) return { error: "Bad request." };
    const { error } = await supabase.from("submissions").update({ paper_type: paperType, track }).eq("id", subId).select("id").single();
    if (error) return { error: friendly(error.message) };
    await bumpStep(subId, 2);
    go(subId, "details", fd.get("intent"));
  }
  const venueId = String(fd.get("venueId") ?? "");
  if (!uuid.safeParse(venueId).success) return { error: "Bad request." };
  const { data, error } = await supabase.rpc("create_draft", { p_venue: venueId, p_paper_type: paperType, p_track: track });
  if (error || !data) return { error: friendly(error?.message) };
  go(data as string, "details", fd.get("intent"));
  return {};
}

/**
 * From the event page's "How to submit" table: a draft of that type, without the "Venue & type" step (the track is
 * chosen on Details). An empty draft of the same type started in the last hour is reused, so going back and
 * clicking again doesn't pile up drafts.
 */
export async function startDraft(venueId: string, paperType: string): Promise<{ id: string } | { error: string }> {
  const type = String(paperType ?? "").trim().slice(0, 80);
  if (!uuid.safeParse(venueId).success || !type) return { error: "Bad request." };
  const supabase = await createClient();
  const since = new Date(Date.now() - 3600e3).toISOString();
  const { data: recent } = await supabase.from("submissions").select("id")
    .eq("venue_id", venueId).eq("paper_type", type).eq("stage", "draft").eq("title", "Untitled paper").is("abstract", null)
    .gte("created_at", since).order("created_at", { ascending: false }).limit(1).maybeSingle();
  if (recent?.id) return { id: recent.id as string };
  const { data, error } = await supabase.rpc("create_draft", { p_venue: venueId, p_paper_type: type, p_track: null });
  if (error || !data) return { error: friendly(error?.message) };
  return { id: data as string };
}

/* SB02 — details + declarations. */
const detailsSchema = z.object({
  title: z.string().trim().refine((s) => mdToPlain(s).length >= 10, "Enter the full title (at least 10 characters).").refine((s) => s.length <= 200, "200 characters at most."),
  abstract: z.string().trim().min(1, "Enter the abstract.").refine((s) => wordCount(s) <= 250, "250 words at most."),
  shortTitle: z.string().trim().max(120).optional(),
});
export async function saveDetails(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("submissionId") ?? "");
  if (!uuid.safeParse(id).success) return { error: "Bad request." };
  const intent = fd.get("intent");
  const parsed = detailsSchema.safeParse({ title: fd.get("title"), abstract: fd.get("abstract"), shortTitle: fd.get("shortTitle") || undefined });
  // Declarations and the short title are on the page only when shown (declarationsShown / shortTitle sent); when hidden,
  // the values already saved are kept, and originality is confirmed on the Submit step instead.
  const declShown = fd.get("declarationsShown") === "1";
  const original = fd.get("original") === "on";
  const track = fd.has("track") ? String(fd.get("track") ?? "").trim().slice(0, 120) : null;
  // Keyword priorities (table between title and abstract), in priority order: 1 = main.
  // 1 to 3 keywords with the priorities 1, 2 and 3, each once, and priority 1 given (the table enforces it; checked again here).
  const keywords = fd.get("keywordsShown") === "1" ? [...new Set(fd.getAll("keyword").map(String).filter(Boolean))].slice(0, 3) : null;
  let keywordPriority: Record<string, number> | null = null;
  if (keywords) {
    try {
      const raw = JSON.parse(String(fd.get("keywordPriority") ?? "{}")) as Record<string, unknown>;
      keywordPriority = Object.fromEntries(keywords.map((k) => [k, Math.min(3, Math.max(1, Number(raw[k]) || 1))]));
    } catch { keywordPriority = Object.fromEntries(keywords.map((k, i) => [k, i + 1])); }
  }
  const prioritiesRepeat = !!keywordPriority && new Set(Object.values(keywordPriority)).size < Object.keys(keywordPriority).length;
  const draftOnly = intent === "exit";
  if (!draftOnly) {
    const errs: Record<string, string> = {};
    if (!parsed.success) for (const i of parsed.error.issues) errs[String(i.path[0])] = i.message;
    if (track === "") errs.track = "Choose a track to continue.";
    if (keywords && keywords.length < 1) errs.keywords = "Choose at least one keyword (priority 1).";
    else if (prioritiesRepeat) errs.keywords = "Use each priority (1, 2 and 3) only once.";
    else if (keywordPriority && !Object.values(keywordPriority).includes(1)) errs.keywords = "Give priority 1 to your main keyword.";
    if (declShown && !original) errs.original = "Please confirm to continue.";
    if (Object.keys(errs).length) return { fieldErrors: errs };
  }
  const supabase = await createClient();
  const { data: prev } = await supabase.from("submissions").select("declarations").eq("id", id).maybeSingle();
  const was = (prev?.declarations ?? {}) as { original?: boolean; preprint?: boolean; student_award?: boolean; keyword_priority?: Record<string, number> };
  const decl = declShown
    ? { original, preprint: fd.get("preprint") === "on", student_award: fd.get("studentAward") === "on" }
    : { original: !!was.original, preprint: !!was.preprint, student_award: !!was.student_award };
  const { error } = await supabase.from("submissions").update({
    title: String(fd.get("title") ?? "").trim().slice(0, 200) || "Untitled paper",
    abstract: String(fd.get("abstract") ?? "").trim().slice(0, 4000) || null,
    ...(fd.has("shortTitle") ? { short_title: String(fd.get("shortTitle") ?? "").trim().slice(0, 120) || null } : {}),
    declarations: { ...decl, ...(keywordPriority ? { keyword_priority: keywordPriority } : was.keyword_priority ? { keyword_priority: was.keyword_priority } : {}) },
    ...(track ? { track } : {}),
    ...(keywords ? { keywords } : {}),
  }).eq("id", id).select("id").single();
  if (error) return { error: friendly(error.message) };
  if (!draftOnly) await bumpStep(id, 3);
  go(id, "authors", intent);
  return {};
}

/* SB03 — authors. */
/**
 * Add a co-author: by PIN or email. `found` = a person with a profile; `pending` = an account that hasn't finished
 * signing up (no profile yet) — added by email, its sign-up name is used when the list is saved (set_authors).
 */
export async function lookupPerson(query: string): Promise<{ found?: { personId: string; name: string; institution: string | null; plenaryId: string | null }; pending?: { email: string; name: string }; error?: string }> {
  const q = query.trim();
  if (!q) return { error: "Enter an email or PIN." };
  if (/^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/.test(q)) return { error: "Adding by ORCID iD isn't available yet — use their email." }; // TODO(orcid)
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("find_person", { p_query: q });
  if (error) return { error: friendly(error.message) };
  const r = (data as Record<string, unknown>[] | null)?.[0];
  if (!r) return {};
  if (!r.person_id) return { pending: { email: q.toLowerCase(), name: `${q.toLowerCase()}${r.display_name ? ` (${r.display_name as string})` : ""}` } };
  // Found by email: only initials come back (no harvesting names), so show the email they typed with the initials.
  const byEmail = q.includes("@");
  const name = byEmail ? `${q.toLowerCase()}${r.display_name ? ` (${r.display_name as string})` : ""}` : (r.display_name as string) || q;
  return { found: { personId: r.person_id as string, name, institution: (r.institution as string) ?? null, plenaryId: (r.plenary_id as string) ?? null } };
}

const authorItem = z.union([
  z.object({ personId: z.guid(), corresponding: z.boolean() }),
  z.object({ email: z.string().email(), givenName: z.string().max(120), familyName: z.string().max(120), institution: z.string().max(200).optional(), corresponding: z.boolean() }),
]);
export async function saveAuthors(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("submissionId") ?? "");
  if (!uuid.safeParse(id).success) return { error: "Bad request." };
  let list: unknown;
  try { list = JSON.parse(String(fd.get("authors") ?? "[]")); } catch { return { error: "Bad request." }; }
  const parsed = z.array(authorItem).min(1).max(40).safeParse(list);
  if (!parsed.success) return { error: "Check the author list: each new co-author needs an email and a name." };
  const payload = parsed.data.map((a) => ("personId" in a ? { person_id: a.personId, corresponding: a.corresponding } : { email: a.email, given_name: a.givenName, family_name: a.familyName, institution: a.institution, corresponding: a.corresponding }));
  // The Commitment (PaperCept's "Paper Submitted to …" terms) must be agreed to continue.
  const committed = fd.get("commitment") === "on";
  if (fd.get("intent") !== "exit" && !committed) return { error: "Tick “I agree” under Commitment to continue." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_authors", { p_submission: id, p_authors: payload });
  if (error) return { error: friendly(error.message) };
  if (committed) {
    const { data: cur } = await supabase.from("submissions").select("declarations").eq("id", id).maybeSingle();
    const d = (cur?.declarations ?? {}) as Record<string, unknown>;
    if (!d.commitment_at) await supabase.from("submissions").update({ declarations: { ...d, commitment_at: new Date().toISOString() } }).eq("id", id);
  }
  // (Co-authors were already emailed when they were added: addCoauthor below.)
  if (fd.get("intent") !== "exit") await bumpStep(id, 5);
  go(id, "files", fd.get("intent")); // the Keywords step is skipped (keyword priorities are on Details)
  return {};
}

/**
 * "Add" / "Add co-author" on the Authors step: saves the author list with the new person at once (set_authors), then
 * emails them — someone new gets an account and "Set your password"; someone with an account gets an invitation.
 */
export async function addCoauthor(submissionId: string, authorsJson: string, added: { personId: string; name: string } | { email: string; givenName: string; familyName: string; institution: string }): Promise<{ error?: string; result?: InviteResult }> {
  if (!uuid.safeParse(submissionId).success) return { error: "Bad request." };
  let list: unknown;
  try { list = JSON.parse(authorsJson); } catch { return { error: "Bad request." }; }
  const parsed = z.array(authorItem).min(1).max(40).safeParse(list);
  if (!parsed.success) return { error: "Check the author list: each new co-author needs an email and a name." };
  const payload = parsed.data.map((a) => ("personId" in a ? { person_id: a.personId, corresponding: a.corresponding } : { email: a.email, given_name: a.givenName, family_name: a.familyName, institution: a.institution, corresponding: a.corresponding }));
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_authors", { p_submission: submissionId, p_authors: payload });
  if (error) return { error: friendly(error.message) };

  const { data: me } = await supabase.auth.getUser();
  const meta = (me.user?.user_metadata ?? {}) as { given_name?: string; family_name?: string };
  const inviter = { name: [meta.given_name, meta.family_name].filter(Boolean).join(" ").trim() || me.user?.email || "A co-author", email: me.user?.email ?? null };
  if ("email" in added) {
    return { result: await inviteNewCoauthor(submissionId, inviter, { email: added.email, givenName: added.givenName, familyName: added.familyName, institution: added.institution }) };
  }
  // Found by email or PIN: someone with an account gets the invitation; a person without one (added earlier as a
  // co-author by someone else) is only added — no account is created and no email is sent.
  const db = createAdminClient();
  const { data: person } = await db.from("persons").select("user_id, given_name, family_name, person_emails(email, is_primary)").eq("id", added.personId).maybeSingle();
  if (!person?.user_id) return { result: "added" };
  const emails = ((person.person_emails ?? []) as { email: string; is_primary: boolean }[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary));
  const name = [person.given_name, person.family_name].filter(Boolean).join(" ").trim();
  return { result: await notifyCoauthor(submissionId, inviter, emails[0]?.email ?? null, name, added.personId) };
}

/* SB04 — keywords. */
export async function saveKeywords(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("submissionId") ?? "");
  if (!uuid.safeParse(id).success) return { error: "Bad request." };
  const keywords = fd.getAll("keyword").map(String).filter(Boolean).slice(0, 5);
  const own = String(fd.get("own") ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 5).map((s) => s.slice(0, 60));
  const intent = fd.get("intent");
  if (intent !== "exit" && keywords.length < 1) return { fieldErrors: { keywords: "Choose at least one keyword on the Details step." } };
  const supabase = await createClient();
  const { error } = await supabase.from("submissions").update({ keywords, own_keywords: own }).eq("id", id).select("id").single();
  if (error) return { error: friendly(error.message) };
  if (intent !== "exit") await bumpStep(id, 5);
  go(id, "files", intent);
  return {};
}

/* SB05 — after the browser uploads to Storage: check the PDF and record the file. */
const ROLES = ["paper", "appendix", "source", "data", "video"] as const;
export async function finishUpload(input: { submissionId: string; role: (typeof ROLES)[number]; path: string; name: string; size: number; mime: string }): Promise<{ error?: string; status?: string }> {
  if (!uuid.safeParse(input.submissionId).success || !ROLES.includes(input.role) || !input.path.startsWith(`${input.submissionId}/`)) return { error: "Bad request." };
  const ctx = await loadSubmission(input.submissionId);
  if (!ctx?.editable) return { error: "You can't change this paper any more." };
  const supabase = await createClient();
  let pages: number | null = null;
  let check: Record<string, unknown> = {};
  if (input.role === "paper" || input.mime === "application/pdf") {
    const { data: blob, error } = await supabase.storage.from("papers").download(input.path);
    if (error || !blob) return { error: "We couldn't read the uploaded file. Try again." };
    const result = await checkPdf(new Uint8Array(await blob.arrayBuffer()), {
      pageLimit: await pageLimitFor(ctx.venue, ctx.sub.paperType),
      doubleBlind: ctx.venue.doubleBlind,
      names: ctx.authors.flatMap((a) => a.name.split(/\s+/).filter((p) => p.length >= 4)),
      institutions: ctx.authors.map((a) => a.institution ?? "").filter(Boolean),
    });
    pages = result.pages;
    check = result;
  }
  const { error } = await supabase.rpc("record_submission_file", {
    p_submission: input.submissionId, p_role: input.role, p_path: input.path, p_name: input.name.slice(0, 200), p_size: input.size, p_mime: input.mime, p_pages: pages, p_check: check,
  });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/submissions/${input.submissionId}`, "layout");
  return { status: (check.status as string) ?? "recorded" };
}

export async function removeFile(fileId: string, submissionId: string): Promise<{ error?: string }> {
  if (!uuid.safeParse(fileId).success) return { error: "Bad request." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_submission_file", { p_file: fileId });
  if (error) return { error: friendly(error.message) };
  revalidatePath(`/submissions/${submissionId}`, "layout");
  return {};
}

export async function fileUrl(path: string): Promise<{ url?: string; error?: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase.storage.from("papers").createSignedUrl(path, 300);
  return error || !data ? { error: "Couldn't open the file." } : { url: data.signedUrl };
}

export async function continueFromFiles(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("submissionId") ?? "");
  const ctx = await loadSubmission(id);
  if (!ctx) return { error: "Bad request." };
  if (fd.get("intent") !== "exit") {
    if (!ctx.done.files) return { error: "Upload a PDF that passes the checks to continue." };
    await bumpStep(id, 7); // the Conflicts step (6) is hidden for now
  }
  go(id, "review", fd.get("intent")); // was "conflicts"
  return {};
}

/* SB06 — conflicts. */
const conflictItem = z.object({ personId: z.guid().nullable(), institution: z.string().max(200).nullable(), reason: z.string().max(200) });
export async function saveConflicts(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("submissionId") ?? "");
  if (!uuid.safeParse(id).success) return { error: "Bad request." };
  let list: unknown;
  try { list = JSON.parse(String(fd.get("conflicts") ?? "[]")); } catch { return { error: "Bad request." }; }
  const parsed = z.array(conflictItem).max(60).safeParse(list);
  if (!parsed.success) return { error: "Bad request." };
  if (parsed.data.some((c) => c.reason.trim().length < 2)) return { error: "Add a reason for each conflict." };
  const supabase = await createClient();
  const del = await supabase.from("submission_conflicts").delete().eq("submission_id", id);
  if (del.error) return { error: friendly(del.error.message) };
  if (parsed.data.length) {
    const { error } = await supabase.from("submission_conflicts").insert(parsed.data.map((c) => ({ submission_id: id, person_id: c.personId, institution: c.institution, reason: c.reason.trim() })));
    if (error) return { error: friendly(error.message) };
  }
  const { error } = await supabase.from("submissions").update({ conflicts_ok_at: new Date().toISOString() }).eq("id", id).select("id").single();
  if (error) return { error: friendly(error.message) };
  if (fd.get("intent") !== "exit") await bumpStep(id, 7);
  go(id, "review", fd.get("intent"));
  return {};
}

/* SB07 — submit. */
export async function submitPaper(_: ActionState, fd: FormData): Promise<ActionState> {
  const id = String(fd.get("submissionId") ?? "");
  if (!uuid.safeParse(id).success) return { error: "Bad request." };
  const agree = fd.get("agree") === "on", present = fd.get("present") === "on", original = fd.get("original") === "on";
  if (!agree || !present || !original) return { error: "Tick all three boxes to submit." };
  const supabase = await createClient();
  // The originality declaration (moved here from the Details step) is stored where submit_paper checks it.
  const { data: cur } = await supabase.from("submissions").select("declarations").eq("id", id).maybeSingle();
  const { error: declError } = await supabase.from("submissions").update({ declarations: { ...((cur?.declarations ?? {}) as Record<string, unknown>), original: true } }).eq("id", id);
  if (declError) return { error: friendly(declError.message) };
  const { error } = await supabase.rpc("submit_paper", { p_submission: id, p_agree: agree, p_present: present });
  if (error) return { error: friendly(error.message) };
  revalidatePath("/workspace", "layout");
  revalidatePath(`/submissions/${id}`, "layout");
  redirect(`/submissions/${id}/submitted`);
}

/** Delete a draft the person started (never a submitted paper). */
export async function deleteDraft(id: string): Promise<{ error?: string }> {
  if (!uuid.safeParse(id).success) return { error: "Bad request." };
  const supabase = await createClient();
  // Files first, through Storage (SQL can't delete storage rows). Only the draft's author may: papers_delete policy.
  const { data: draft } = await supabase.from("submissions").select("id, stage").eq("id", id).maybeSingle();
  if (!draft) return { error: "Only the person who started this draft can delete it." };
  if (draft.stage !== "draft") return { error: "Only drafts can be deleted — withdraw a submitted paper instead." };
  const { data: listed } = await supabase.storage.from("papers").list(id, { limit: 1000 });
  const { data: rows } = await supabase.from("submission_files").select("storage_path").eq("submission_id", id);
  const paths = [...new Set([
    ...((listed ?? []) as { name: string }[]).map((f) => `${id}/${f.name}`),
    ...((rows ?? []) as { storage_path: string | null }[]).map((f) => f.storage_path).filter((p): p is string => !!p),
  ])];
  if (paths.length) await supabase.storage.from("papers").remove(paths);
  const { error } = await supabase.rpc("delete_draft", { p_submission: id });
  if (error) {
    if (/function .*delete_draft|does not exist|PGRST202/i.test(error.message)) return { error: "Deleting drafts needs the latest database update." };
    if (/only drafts/i.test(error.message)) return { error: "Only drafts can be deleted — withdraw a submitted paper instead." };
    if (/not your draft/i.test(error.message)) return { error: "Only the person who started this draft can delete it." };
    return { error: friendly(error.message) };
  }
  revalidatePath("/workspace/submissions");
  redirect("/workspace/submissions");
}
