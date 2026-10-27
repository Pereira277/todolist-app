"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchUserAttributes, signOut } from "aws-amplify/auth";

export type Profile = { name: string; email: string };

/**
 * Loads the signed-in user's name and email for the top bar, sending anyone
 * without a session to the sign-in page.
 *
 * @returns The profile (null until loaded) and a sign-out handler
 */
export function useProfile(): { profile: Profile | null; handleSignOut: () => Promise<void> } {
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

  return { profile, handleSignOut };
}
