"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchUserAttributes, signOut } from "aws-amplify/auth";
import { TopBar } from "@/components/TopBar";

type Profile = { name: string; email: string };

export default function AppHomePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    fetchUserAttributes()
      .then((attrs) => {
        setProfile({ name: attrs.name ?? "", email: attrs.email ?? "" });
      })
      .catch(() => {
        router.replace("/sign-in/");
      });
  }, [router]);

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
        <h1 className="m-0 text-[30px] leading-[38px] font-semibold tracking-[-0.01em] text-text-primary">
          Hello, {profile.name}
        </h1>
        <p className="m-0 text-base leading-6 text-text-secondary">You&apos;re signed in as {profile.email}.</p>
      </main>
    </div>
  );
}
