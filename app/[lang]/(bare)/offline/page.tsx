import type { Metadata } from "next";
import { getT } from "@/lib/i18n/server";
import { RetryButton, SavedPages } from "@/components/pwa/offline-bits";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getT();
  return { title: t("You’re offline"), robots: { index: false } };
}

/** Served by the service worker when a page isn't reachable and wasn't saved for offline use. */
export default async function OfflinePage() {
  const t = await getT();
  return (
    <main className="flex min-h-dvh items-center justify-center bg-[#F5F6F3] px-5 py-12 text-[15px] leading-[1.5] text-[#121826]">
      <div className="w-full max-w-[460px] rounded-[8px] border border-[#DADDE3] bg-white p-7">
        <div className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element -- plain <img>: works offline */}
          <img src="/logo/hyper-papers-on-light.png" alt={t.brand} width={144} height={40} className="h-10 w-auto" />
        </div>
        <p className="mt-7 font-mono text-[12px] font-medium uppercase tracking-[0.06em] text-[#A8600F]">{t("No connection")}</p>
        <h1 className="mt-2 font-serif text-[34px] font-normal leading-[1.1]">{t("You’re offline")}</h1>
        <p className="mt-3 text-[#4A5263]">{t("This page needs a connection. Your drafts are saved on the server, so nothing is lost — reconnect to carry on.")}</p>
        <RetryButton label={t("Try again")} />
        <SavedPages title={t("Available offline")} empty={t("Pages you have opened, like venues and deadlines, appear here for offline reading.")} />
      </div>
    </main>
  );
}
