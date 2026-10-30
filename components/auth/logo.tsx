"use client";

import Image from "next/image";
import Link from "@/components/site/link";
import { useT } from "@/lib/i18n/client";

/** The Hyper Papers logo for light backgrounds (navy + saffron, transparent; public/logo/hyper-papers-on-light.png). */
export function Logo() {
  const t = useT();
  return (
    <Link href="/" className="flex items-center no-underline">
      <Image src="/logo/hyper-papers-on-light.png" alt={t.brand} width={144} height={40} priority className="h-10 w-auto" />
    </Link>
  );
}
