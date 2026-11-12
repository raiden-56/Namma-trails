"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { endpoints } from "@/lib/api/endpoints";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { PendingAction } from "@/components/ui/PendingAction";
import { Tabs } from "@/components/ui/Tabs";

/** Only same-site relative paths are accepted as a return address (no open redirects). */
function safeNext(next: string | undefined): string | null {
  return next && next.startsWith("/") && !next.startsWith("//") && !next.startsWith("/\\") ? next : null;
}

/** Routes by what the signed-in user actually is (GET /auth/me), not by what the page asked for. */
async function destinationAfterSignIn(as: string | undefined, next?: string): Promise<string> {
  const me = await endpoints.me();
  const isAdmin = me.roles.some((r) => r === "super_admin" || r.endsWith("_admin"));
  const back = safeNext(next);
  if (back && (!back.startsWith("/admin") || isAdmin)) return back;
  if (isAdmin) return "/admin";
  if (me.providers.length > 0) return "/partner";
  if (as === "partner") return "/partner/register";
  return "/trips";
}

function ErrorText({ message }: { message?: string }) {
  return message ? (
    <p role="alert" className="rounded-md bg-danger/10 p-3 text-sm text-danger">
      {message}
    </p>
  ) : null;
}

function PhoneOtpForm({ as, next }: { as?: string; next?: string }) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [requested, setRequested] = useState(false);
  const valid = /^[6-9]\d{9}$/.test(phone);

  const request = useMutation({
    mutationFn: () => endpoints.requestOtp({ channel: "sms", destination: `+91${phone}`, purpose: "sign_in" }),
    onSuccess: () => setRequested(true),
  });
  const verify = useMutation({
    mutationFn: async () => {
      await endpoints.signInWithPhoneOtp({ phone: `+91${phone}`, code });
      return destinationAfterSignIn(as, next);
    },
    onSuccess: (path) => router.push(path),
  });

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        if (!requested) request.mutate();
        else verify.mutate();
      }}
    >
      <Field id="signin-phone" label="Mobile number" hint="Indian mobile number, without +91">
        <Input type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} value={phone} onChange={(e) => setPhone(e.target.value.replace(/\D/g, ""))} disabled={requested} />
      </Field>
      {requested ? (
        <Field id="signin-code" label="6-digit code">
          <Input inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
        </Field>
      ) : null}
      <ErrorText message={request.error?.message ?? verify.error?.message} />
      <Button type="submit" size="lg" disabled={!valid || (requested && code.length !== 6)} loading={request.isPending || verify.isPending}>
        {requested ? "Verify and sign in" : "Send code"}
      </Button>
    </form>
  );
}

const emailSchema = z.object({ email: z.email("Enter a valid email."), password: z.string().min(1, "Enter your password.") });

function EmailForm({ as, next }: { as?: string; next?: string }) {
  const router = useRouter();
  const { register, handleSubmit, formState } = useForm<z.infer<typeof emailSchema>>({ resolver: zodResolver(emailSchema) });
  const login = useMutation({
    mutationFn: async (v: z.infer<typeof emailSchema>) => {
      await endpoints.signInWithPassword(v);
      return destinationAfterSignIn(as, next);
    },
    onSuccess: (path) => router.push(path),
  });
  return (
    <form className="flex flex-col gap-4" noValidate onSubmit={handleSubmit((v) => login.mutate(v))}>
      <Field id="signin-email" label="Email" error={formState.errors.email?.message}>
        <Input type="email" autoComplete="email" {...register("email")} />
      </Field>
      <Field id="signin-password" label="Password" error={formState.errors.password?.message}>
        <Input type="password" autoComplete="current-password" {...register("password")} />
      </Field>
      <ErrorText message={login.error?.message} />
      <Button type="submit" size="lg" loading={login.isPending}>
        Sign in
      </Button>
      <PendingAction variant="link" hint="The reset API exists (POST /auth/password/reset); its screen ships with email OTP delivery in Phase 7.">
        Forgot password?
      </PendingAction>
    </form>
  );
}

export function SignInForms({ as, next }: { as?: string; next?: string }) {
  return (
    <Tabs
      label="Sign-in method"
      variant="pill"
      items={[
        { id: "phone", label: "Mobile OTP", content: <PhoneOtpForm as={as} next={next} /> },
        { id: "email", label: "Email", content: <EmailForm as={as} next={next} /> },
      ]}
    />
  );
}
