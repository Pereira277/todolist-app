"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchUserAttributes, signOut } from "aws-amplify/auth";
import { TopBar } from "@/components/TopBar";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { fetchMe, type Me } from "@/lib/api";

type Profile = { name: string; email: string };

type MeState = { status: "loading" } | { status: "error" } | { status: "ready"; me: Me };

export default function AppHomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [meState, setMeState] = useState<MeState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    fetchUserAttributes()
      .then((attrs) => {
        setProfile({ name: attrs.name ?? "", email: attrs.email ?? "" });
      })
      .catch(() => {
        router.replace("/sign-in/");
      });
  }, [router]);

  useEffect(() => {
    let cancelled = false;
    fetchMe()
      .then((me) => {
        if (!cancelled) setMeState({ status: "ready", me });
      })
      .catch(() => {
        if (!cancelled) setMeState({ status: "error" });
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  function handleRetry() {
    setMeState({ status: "loading" });
    setAttempt((n) => n + 1);
  }

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  if (!profile) {
    return null;
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-background text-text-primary">
      <TopBar name={profile.name} email={profile.email} onSignOut={handleSignOut} />
      <main className="mx-auto flex w-full max-w-[640px] flex-col gap-2 px-4 pt-8 pb-16 sm:px-6 sm:pt-12">
        {meState.status === "loading" && (
          <p role="status" className="m-0 text-base leading-6 text-text-secondary">
            Loading your profile…
          </p>
        )}
        {meState.status === "error" && (
          <div className="flex flex-col items-start gap-4">
            <Alert variant="error" title="We couldn't connect">
              Check your internet connection and try again.
            </Alert>
            <Button variant="secondary" onClick={handleRetry}>
              Try again
            </Button>
          </div>
        )}
        {meState.status === "ready" && (
          <>
            <h1 className="m-0 text-[30px] leading-[38px] font-semibold tracking-[-0.01em] text-text-primary">
              Hello, {meState.me.name}
            </h1>
            <p className="m-0 text-base leading-6 text-text-secondary">
              You&apos;re signed in as {meState.me.email}.
            </p>
          </>
        )}
      </main>
    </div>
  );
}
