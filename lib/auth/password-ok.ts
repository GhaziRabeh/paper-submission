import "server-only";
import { cookies } from "next/headers";
import { expiresIn, sameHex, sign } from "@/lib/auth/signing";

/*
 * Two-step sign-in by email (SIGNIN_TWO_STEP_EMAIL=on in .env): step 1 checks the password, step 2 the code sent by
 * email. Between the two, this signed cookie says "the password for this email was right" for 15 minutes, so the
 * email code alone can't open the account.
 */

const NAME = "pl_pw_ok";
const TTL_MIN = 15;

export const emailCodeAfterPassword = () => process.env.SIGNIN_TWO_STEP_EMAIL?.trim().toLowerCase() === "on";

const norm = (email: string) => email.trim().toLowerCase();

export async function setPasswordOk(email: string) {
  const body = Buffer.from(norm(email)).toString("base64url");
  const exp = expiresIn(TTL_MIN);
  (await cookies()).set(NAME, `${body}.${exp}.${sign(`password-ok|${body}`, exp)}`, {
    httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: TTL_MIN * 60,
  });
}

/** True when step 1 (the password) passed for this email in the last 15 minutes. */
export async function hasPasswordOk(email: string): Promise<boolean> {
  const raw = (await cookies()).get(NAME)?.value;
  const [body, expStr, sig] = raw?.split(".") ?? [];
  const exp = Number(expStr);
  if (!body || !sig || !Number.isInteger(exp) || exp < Math.floor(Date.now() / 1000)) return false;
  try {
    return sameHex(sig, sign(`password-ok|${body}`, exp)) && Buffer.from(body, "base64url").toString("utf8") === norm(email);
  } catch {
    return false;
  }
}

export async function clearPasswordOk() {
  (await cookies()).delete(NAME);
}
