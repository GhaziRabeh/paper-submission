import "server-only";
import { cookies } from "next/headers";
import { expiresIn, sameHex, sign } from "@/lib/auth/signing";

/*
 * Sign-up without an email code (site switch off): step 1 (name, email, university…) is kept here, signed and for
 * 30 minutes, until step 2 chooses the password and the account is created. Nothing is in the database before that.
 */
export type PendingSignup = {
  email: string; firstName: string; lastName: string; next?: string; venue?: string;
  meta: Record<string, string>;
};

const NAME = "pl_signup";
const TTL_MIN = 30;

export async function setPendingSignup(p: PendingSignup) {
  const body = Buffer.from(JSON.stringify(p)).toString("base64url");
  const exp = expiresIn(TTL_MIN);
  (await cookies()).set(NAME, `${body}.${exp}.${sign(`pending-signup|${body}`, exp)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL_MIN * 60,
  });
}

/** The details from step 1, or null when missing, expired or tampered with. */
export async function readPendingSignup(): Promise<PendingSignup | null> {
  const raw = (await cookies()).get(NAME)?.value;
  const [body, expStr, sig] = raw?.split(".") ?? [];
  const exp = Number(expStr);
  if (!body || !sig || !Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000)) return null;
  try {
    if (!sameHex(sig, sign(`pending-signup|${body}`, exp))) return null;
    const p = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as PendingSignup;
    return typeof p.email === "string" && typeof p.firstName === "string" ? p : null;
  } catch {
    return null;
  }
}

export async function clearPendingSignup() {
  (await cookies()).delete(NAME);
}
