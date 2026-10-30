import "server-only";
import { absoluteUrl, site } from "@/lib/config/site";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendEmail } from "@/lib/email/send";
import { layout } from "@/lib/email/security-mail";

/*
 * Emails sent the moment a co-author is added on the Authors step (addCoauthor in lib/submission/actions.ts), in the
 * same layout as the account emails:
 *  - someone new (no Plenary account): an account is created for them right away (a Supabase invitation carrying
 *    their name and institution) and the email has one button, "Set your password". The link goes through
 *    /auth/confirm (type invite), which confirms the email; /auth/continue then opens "Choose a password", and the
 *    database links the paper to the new account (link_confirmed_user claims the placeholder made by set_authors);
 *  - someone with an account: an invitation telling them they were added, with a button to their submissions.
 * Best effort: a failed email never blocks the author list. Returns what happened, for the message on the page.
 */

export type NewCoauthor = { email: string; givenName: string; familyName: string; institution: string };
export type Inviter = { name: string; email: string | null };
export type InviteResult = "account_created" | "invited" | "added" | "not_sent";

async function paperFacts(submissionId: string) {
  const db = createAdminClient();
  const { data: sub } = await db.from("submissions").select("title, venue_id").eq("id", submissionId).maybeSingle();
  const { data: venue } = sub ? await db.from("venues").select("short_name, name").eq("id", sub.venue_id).maybeSingle() : { data: null };
  return {
    db,
    event: (venue?.short_name as string) || (venue?.name as string) || "a conference",
    title: !sub?.title || sub.title === "Untitled paper" ? "a paper (title to come)" : (sub.title as string),
  };
}

const footer = "You get this email because a co-author listed this address on a paper.";
const fromRow = (i: Inviter): [string, string] => ["From", i.email ? `${i.name} (${i.email})` : i.name];

/** Someone new: their account is created and they get "Set your password". Falls back to the invitation if the email already has an account. */
export async function inviteNewCoauthor(submissionId: string, inviter: Inviter, p: NewCoauthor): Promise<InviteResult> {
  try {
    const { db, event, title } = await paperFacts(submissionId);
    const email = p.email.trim().toLowerCase();
    const { data, error } = await db.auth.admin.generateLink({
      type: "invite", email,
      options: { data: { given_name: p.givenName, family_name: p.familyName, ...(p.institution ? { university: p.institution } : {}), invited_by: inviter.email ?? inviter.name } },
    });
    if (error || !data?.properties?.hashed_token) {
      // Already has an account (or an earlier invitation): tell them they were added instead.
      if (/already.*(registered|exists)/i.test(error?.message ?? "")) return await notifyCoauthor(submissionId, inviter, email, `${p.givenName} ${p.familyName}`.trim());
      console.error("[authors] account not created:", error?.message);
      return "not_sent";
    }
    const link = absoluteUrl(`/auth/confirm?${new URLSearchParams({ token_hash: data.properties.hashed_token, type: "invite", next: "/workspace/submissions" })}`);
    const name = `${p.givenName} ${p.familyName}`.trim();
    const mail = layout({
      subject: `${inviter.name} invited you to Plenary as a co-author`,
      kicker: "Invitation", kickerInk: "#1F47A8",
      title: name ? `Welcome, ${name}` : "You're invited",
      lead: `You have an invitation from ${inviter.name}, who added you as a co-author of ${title} for ${event}. We created your Plenary account with this email — just click the button to set your password.`,
      button: { label: "Set your password", href: link },
      detailsLabel: "Invitation",
      rows: [fromRow(inviter), ["Paper", title], ["Event", event], ["Your account", email]],
      note: "<strong>The button works once.</strong> If it has expired, choose “Forgot password” on the sign-in page with this email. Not your paper? Ignore this email or reply to the co-author who invited you.",
      footer, to: email,
    });
    const r = await sendEmail({ to: email, from: site.email.authFrom, ...mail, ...(inviter.email ? { replyTo: inviter.email } : {}) });
    return r.ok ? "account_created" : "not_sent";
  } catch (e) {
    console.error("[authors] invitation failed:", e instanceof Error ? e.message : e);
    return "not_sent";
  }
}

/** Someone with an account (found by email or PIN): an invitation saying they were added, with a button to their submissions. */
export async function notifyCoauthor(submissionId: string, inviter: Inviter, toEmail: string | null, name: string, personId?: string): Promise<InviteResult> {
  try {
    const { db, event, title } = await paperFacts(submissionId);
    let to = toEmail;
    if (!to && personId) {
      const { data } = await db.from("person_emails").select("email, is_primary").eq("person_id", personId);
      to = ((data ?? []) as { email: string; is_primary: boolean }[]).sort((a, b) => Number(b.is_primary) - Number(a.is_primary))[0]?.email ?? null;
    }
    if (!to) return "not_sent";
    const mail = layout({
      subject: `${inviter.name} added you as a co-author on Plenary`,
      kicker: "Co-author invitation", kickerInk: "#1F47A8",
      title: name ? `You're a co-author, ${name}` : "You're a co-author",
      lead: `You have an invitation from ${inviter.name}, who added you as a co-author of ${title} for ${event}. Sign in to see the paper in your submissions.`,
      button: { label: "Open your submissions", href: absoluteUrl("/workspace/submissions") },
      detailsLabel: "Invitation",
      rows: [fromRow(inviter), ["Paper", title], ["Event", event], ["Your account", to]],
      note: "<strong>Not your paper?</strong> Reply to this email to tell the co-author who added you.",
      footer, to,
    });
    const r = await sendEmail({ to, from: site.email.authFrom, ...mail, ...(inviter.email ? { replyTo: inviter.email } : {}) });
    return r.ok ? "invited" : "not_sent";
  } catch (e) {
    console.error("[authors] invitation failed:", e instanceof Error ? e.message : e);
    return "not_sent";
  }
}
