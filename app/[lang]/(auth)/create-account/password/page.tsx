import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getT } from "@/lib/i18n/server";
import { NavyAside, SetupSteps, ShieldNote, SplitLayout, ui } from "@/components/auth/split-layout";
import { PasswordStepForm } from "@/components/auth/password-step-form";
import { signupSteps } from "@/components/auth/signup-steps";
import { createClient } from "@/lib/supabase/server";
import { resolveOnboarding, stepHref } from "@/lib/auth/onboarding";
import { safeNext } from "@/lib/config/site";
import { Reveal } from "@/components/motion/reveal";
import { AuthSkeleton } from "@/components/skeletons";
import { readPendingSignup } from "@/lib/auth/pending-signup";
import Link from "@/components/site/link";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Choose a password") };
}
type Search = { next?: string };

async function Content({ searchParams }: { searchParams: Promise<Search> }) {
  const { next: rawNext } = await searchParams;
  const next = rawNext ? safeNext(rawNext) : undefined;
  const supabase = await createClient();
  const r = await resolveOnboarding(supabase, { sync: false });
  if (!r.user) {
    // No-code sign-up: step 1 is kept in a signed cookie; the account is created here with the password.
    const pending = await readPendingSignup();
    if (pending) return <PendingPassword email={pending.email} first={pending.firstName} next={next} />;
    redirect(`/sign-in?next=${encodeURIComponent(`/create-account/password${next ? `?next=${encodeURIComponent(next)}` : ""}`)}`);
  }
  if (r.step !== "password") redirect(stepHref(r.step, next ?? "/welcome", { ref: r.ref, email: r.user.email }));
  const email = r.user.email ?? "";
  const meta = (r.user.user_metadata ?? {}) as { given_name?: string };
  const first = (meta.given_name ?? "").trim();
  const t = await getT();

  return (
    <SplitLayout showAside={false}
      width={440}
      aside={
        <NavyAside label={t("Account set-up progress")} kicker={t("Creating your account")} title={first ? t("Nearly done, {name}.", { name: first }) : t("Nearly done.")}>
          <SetupSteps doneLabel={t("Done")} steps={signupSteps(t, 3, { 1: email, 2: t("Confirmed.") })} />
          <ShieldNote><strong className="text-[#F5F6F3]">{t("Only you can set this password.")}</strong> {t("It can only be chosen after the code from your inbox, so nobody else can sign up with your email.")}</ShieldNote>
        </NavyAside>
      }
    >
      <div className="flex items-center gap-2 rounded-[6px] border border-[#B9E0CB] bg-[#E1F3EA] px-3 py-2 text-[14px] text-[#14603F]">
        <span aria-hidden className="font-semibold">✓</span><span><strong>{t("Email confirmed.")}</strong> {email}</span>
      </div>
      <p className={`mt-[22px] ${ui.kicker}`}>{t("Step 3 of 4")}</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>{t("Choose a password")}</h1>
      <p className={`mt-2 ${ui.muted}`}>{t("Use something long you don't use anywhere else. A short phrase works well.")}</p>
      <PasswordStepForm email={email} next={next} />
    </SplitLayout>
  );
}

/** Step 2 of the no-code sign-up: choose the password; this creates the account and signs you in. */
async function PendingPassword({ email, first, next }: { email: string; first: string; next?: string }) {
  const t = await getT();
  return (
    <SplitLayout showAside={false}
      width={440}
      aside={
        <NavyAside label={t("Account set-up progress")} kicker={t("Creating your account")} title={first ? t("Nearly done, {name}.", { name: first }) : t("Nearly done.")}>
          <SetupSteps doneLabel={t("Done")} steps={signupSteps(t, 3, { 1: email })} />
        </NavyAside>
      }
    >
      <Link href="/create-account" className="text-[14px] text-[#2F5FD0] no-underline">{t("← Back")}</Link>
      <p className={`mt-4 ${ui.kicker}`}>{t("Step 2 of 2")}</p>
      <h1 className={`mt-1.5 ${ui.h1}`}>{t("Choose a password")}</h1>
      <p className={`mt-2 ${ui.muted}`}>{t("For {email}.", { email })}</p>
      <PasswordStepForm email={email} next={next} pending />
    </SplitLayout>
  );
}

export default function Page({ searchParams }: { searchParams: Promise<Search> }) {
  return (
    <Reveal fallback={<AuthSkeleton aside />}>
      <Content searchParams={searchParams} />
    </Reveal>
  );
}
