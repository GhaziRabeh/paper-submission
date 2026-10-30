import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { SubmissionFrame, requireCtx } from "@/components/submission/frame";
import { AuthorsForm, type Row } from "@/components/submission/authors-form";
import { Reveal } from "@/components/motion/reveal";
import { WizardSkeleton } from "@/components/skeletons";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("Authors") };
}
type P = { params: Promise<{ id: string }> };

async function Inner({ params }: P) {
  const { id } = await params;
  const ctx = await requireCtx(id, "authors");
  const rows: Row[] = ctx.authors.map((a) => ({
    key: a.personId, personId: a.personId, name: a.name, institution: a.institution, corresponding: a.corresponding, isYou: a.isYou, invite: !a.hasAccount,
    sub: [a.institution, a.isYou ? a.plenaryId : a.email].filter(Boolean).join(" · "),
  }));
  return (
    <SubmissionFrame ctx={ctx} step="authors">
      {/* The byline, how co-authors are handled and the conflicts note are inside the Authors card (authors-form.tsx). */}
      <AuthorsForm id={id} initial={rows} event={ctx.venue.acr} agreed={!!ctx.sub.declarations.commitment_at} />
    </SubmissionFrame>
  );
}

/** Canvas SB03-Authors. */
export default function Page(props: P) {
  return <Reveal fallback={<WizardSkeleton step="authors" />}><Inner {...props} /></Reveal>;
}
