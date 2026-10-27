"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { FormEvent, Suspense, useEffect, useState } from "react";
import { confirmSignUp, resendSignUpCode } from "aws-amplify/auth";
import { AuthCard } from "@/components/ui/AuthCard";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { useRedirectIfSignedIn } from "@/lib/session";

const RESEND_COOLDOWN_SECONDS = 59;

function isNetworkError(error: unknown) {
  const name = (error as { name?: string })?.name ?? "";
  const message = (error as { message?: string })?.message ?? "";
  return name === "NetworkError" || /network/i.test(message);
}

function ConfirmEmailForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email");
  // Confirming leads to sign-in, which a signed-in user does not need
  const checkingSession = useRedirectIfSignedIn();

  useEffect(() => {
    if (!checkingSession && !email) {
      router.replace("/sign-up/");
    }
  }, [checkingSession, email, router]);

  if (checkingSession || !email) {
    return null;
  }

  return <ConfirmEmailCard email={email} />;
}

function ConfirmEmailCard({ email }: { email: string }) {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState<string>();
  const [network, setNetwork] = useState(false);
  const [expired, setExpired] = useState(false);
  const [resent, setResent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setNetwork(false);
    setExpired(false);
    setCodeError(undefined);
    setLoading(true);
    try {
      await confirmSignUp({ username: email, confirmationCode: code });
      router.push("/sign-in/");
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (isNetworkError(error)) {
        setNetwork(true);
      } else if (name === "ExpiredCodeException") {
        setExpired(true);
      } else if (name === "CodeMismatchException") {
        setCodeError("That code isn't right. Check the email and enter the 6 digits again.");
      } else {
        setNetwork(true);
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleResend() {
    setNetwork(false);
    setExpired(false);
    setResent(false);
    setResending(true);
    try {
      await resendSignUpCode({ username: email });
      setResent(true);
      setCooldown(RESEND_COOLDOWN_SECONDS);
    } catch (error) {
      if (isNetworkError(error)) {
        setNetwork(true);
      }
    } finally {
      setResending(false);
    }
  }

  const canResend = cooldown === 0;

  return (
    <>
      <form onSubmit={handleSubmit}>
        <AuthCard title="Check your email" description={`We sent a 6-digit code to ${email}.`}>
          {network && (
            <Alert variant="error" title="We couldn't connect">
              Check your internet connection and try again.
            </Alert>
          )}
          {expired && (
            <Alert variant="error" title="This code has expired">
              Request a new code below, then enter it here.
            </Alert>
          )}
          {resent && (
            <Alert variant="success" title="We sent a new code">
              It can take a minute to arrive. Check your spam folder if you don&apos;t see it.
            </Alert>
          )}
          <TextField
            label="Verification code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            helperText="Enter the 6 digits from the email."
            error={codeError}
            value={code}
            onChange={(e) => setCode(e.target.value)}
            required
          />
          <Button type="submit" fullWidth loading={loading} loadingLabel="Verifying your code">
            Verify email
          </Button>
          <div className="flex flex-wrap items-center justify-center gap-1 text-sm text-text-secondary">
            <span>Didn&apos;t get the code?</span>
            <Button
              type="button"
              variant="ghost"
              disabled={!canResend}
              loading={resending}
              onClick={handleResend}
            >
              {canResend ? "Resend code" : `Resend code in 0:${String(cooldown).padStart(2, "0")}`}
            </Button>
          </div>
        </AuthCard>
      </form>
      <p className="m-0 text-center text-sm text-text-secondary">
        Wrong email?{" "}
        <Link href="/sign-up/" className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
          Use a different one
        </Link>
      </p>
    </>
  );
}

export default function ConfirmEmailPage() {
  return (
    <AuthLayout>
      <Suspense fallback={null}>
        <ConfirmEmailForm />
      </Suspense>
    </AuthLayout>
  );
}
