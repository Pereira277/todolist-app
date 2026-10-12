"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useState } from "react";
import { signIn } from "aws-amplify/auth";
import { AuthCard } from "@/components/ui/AuthCard";
import { AuthLayout } from "@/components/ui/AuthLayout";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { PasswordField } from "@/components/ui/PasswordField";
import { TextField } from "@/components/ui/TextField";
import { INVALID_EMAIL_MESSAGE, isValidEmail } from "@/lib/validate";

function isNetworkError(error: unknown) {
  const name = (error as { name?: string })?.name ?? "";
  const message = (error as { message?: string })?.message ?? "";
  return name === "NetworkError" || /network/i.test(message);
}

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [emailError, setEmailError] = useState<string>();
  const [wrongCredentials, setWrongCredentials] = useState(false);
  const [network, setNetwork] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setWrongCredentials(false);
    setNetwork(false);

    if (!isValidEmail(email)) {
      setEmailError(INVALID_EMAIL_MESSAGE);
      return;
    }
    setEmailError(undefined);

    setLoading(true);
    try {
      const { isSignedIn, nextStep } = await signIn({ username: email, password });
      if (isSignedIn) {
        router.push("/app/");
      } else if (nextStep?.signInStep === "CONFIRM_SIGN_UP") {
        router.push(`/confirm/?email=${encodeURIComponent(email)}`);
      }
    } catch (error) {
      const name = (error as { name?: string })?.name;
      if (isNetworkError(error)) {
        setNetwork(true);
      } else if (name === "UserNotConfirmedException") {
        router.push(`/confirm/?email=${encodeURIComponent(email)}`);
      } else {
        // Cognito's "prevent user existence errors" setting merges wrong-password
        // and unknown-email into the same NotAuthorizedException on purpose.
        setWrongCredentials(true);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthLayout>
      <form onSubmit={handleSubmit}>
        <AuthCard title="Sign in" description="Welcome back. Pick up your lists where you left off.">
          {network && (
            <Alert variant="error" title="We couldn't connect">
              Check your internet connection and try again.
            </Alert>
          )}
          {wrongCredentials && (
            <Alert variant="error" title="We couldn't sign you in">
              The email or password is incorrect. Check both and try again.
            </Alert>
          )}
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
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <Button type="submit" fullWidth loading={loading} loadingLabel="Signing in">
            Sign in
          </Button>
        </AuthCard>
      </form>
      <p className="m-0 text-center text-sm text-text-secondary">
        New here?{" "}
        <Link href="/sign-up/" className="font-medium text-primary underline underline-offset-2 hover:text-primary-hover">
          Create an account
        </Link>
      </p>
    </AuthLayout>
  );
}
