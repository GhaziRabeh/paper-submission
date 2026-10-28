"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { finishSignup, saveChosenPassword, type PasswordState } from "@/lib/auth/onboarding-actions";
import { PasswordFields } from "@/components/auth/password-fields";
import { focusFirstError } from "@/components/auth/focus-error";
import { ui } from "@/components/auth/split-layout";
import { useT } from "@/lib/i18n/client";

/**
 * Choose the password: after the email code (saveChosenPassword), or — `pending` — step 2 of the no-code sign-up,
 * which creates the account from the details kept from step 1 (finishSignup).
 */
export function PasswordStepForm({ email, next, pending: create = false }: { email: string; next?: string; pending?: boolean }) {
  const t = useT();
  const [state, action, pending] = useActionState<PasswordState, FormData>(create ? finishSignup : saveChosenPassword, {});
  const [tried, setTried] = useState(false);
  const [ok, setOk] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => { if (state.fieldErrors || state.message) focusFirstError(formRef.current); }, [state]);
  const fe = state.fieldErrors;

  return (
    <form ref={formRef} action={action} noValidate className="mt-2" onSubmit={(e) => {
      setTried(true);
      if (!ok) { e.preventDefault(); focusFirstError(formRef.current); }
    }}>
      <input type="hidden" name="next" value={next ?? ""} />
      {/* Lets password managers save the new password against the confirmed email (plan T20). */}
      <input type="email" name="username" autoComplete="username" value={email} readOnly hidden />
      {state.message ? <p role="alert" data-form-error className="mt-4 rounded-[6px] border border-[#F0C2BE] bg-[#FDF0EF] px-3.5 py-3 text-[14px] text-[#7A1C15]">{t(state.message)}</p> : null}
      <PasswordFields email={email} tried={tried} serverErrors={{ password: fe?.password, confirm: fe?.confirm }} idPrefix="pr6p" onValid={setOk} signup />
      <button type="submit" disabled={pending} className={`mt-[18px] h-12 ${ui.primary}`}>{pending ? (create ? t("Creating your account…") : t("Saving…")) : create ? t("Create account") : t("Save password and continue")}</button>
      {create ? null : <p className={`mt-3 text-[13px] ${ui.muted}`}>{t("You can also sign in with an email code any time — the password is for when that's quicker.")}</p>}
    </form>
  );
}
