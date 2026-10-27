"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signUp } from "aws-amplify/auth";
import { AuthCard } from "@/components/ui/AuthCard";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import { INVALID_EMAIL_MESSAGE, isValidEmail } from "@/lib/validate";
import { useRedirectIfSignedIn } from "@/lib/session";

function isNetworkError(error: unknown) {
  const name = (error as { name?: string })?.name ?? "";
  const message = (error as { message?: string })?.message ?? "";
  return name === "NetworkError" || /network/i.test(message);
}

export default function SignUpPage() {
  const router = useRouter();
  // A second account created over an active session would end up signed in as the first one
  const checkingSession = useRedirectIfSignedIn();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [formError, setFormError] = useState<{ title: string; message: string } | null>(null);
  const [network, setNetwork] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setNetwork(false);

    if (!isValidEmail(email)) {
      setEmailError(INVALID_EMAIL_MESSAGE);
      return;
    }
    setEmailError(undefined);

    setLoading(true);
    try {
      await signUp({
        username: email,
        password,
        options: { userAttributes: { email, name } },
      });
      router.push(`/confirm/?email=${encodeURIComponent(email)}`);
    } catch (error) {
      if (isNetworkError(error)) {
        setNetwork(true);
      } else {
        const message = error instanceof Error ? error.message : "Something went wrong. Try again.";
        setFormError({ title: "We couldn't create your account", message });
      }
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return null;
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit}>
        <AuthCard title="Create your account" description="Start a list and share it with anyone.">
          {network && (
            <Alert variant="error" title="We couldn't connect">
              Check your internet connection and try again. Your details are still here.
            </Alert>
          )}
          {formError && (
            <Alert variant="error" title={formError.title}>
              {formError.message}
            </Alert>
          )}
          <TextField
            label="Name"
            name="name"
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <TextField
            label="Email address"
            type="email"
            name="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
            required
          />
          <PasswordField
            label="Password"
            name="password"
            autoComplete="new-password"
            helperText="Use at least 8 characters."
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={8}
            required
          />
          <Button type="submit" fullWidth loading={loading} loadingLabel="Creating your account">
            Create account
          </Button>
        </AuthCard>
      </form>
      <p className="m-0 text-center text-sm text-text-secondary">
        Already have an account?{" "}
        <Link href="/sign-in/" className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
