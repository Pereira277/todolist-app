"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "aws-amplify/auth";
import { getSignedInProfile, type Profile } from "@/lib/session";

/**
 * Loads the signed-in user's name and email for the top bar, sending anyone
 * without a valid session to the sign-in page.
 *
 * @returns The profile (null until loaded) and a sign-out handler
 */
export function useProfile(): { profile: Profile | null; handleSignOut: () => Promise<void> } {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSignedInProfile().then((signedIn) => {
      if (cancelled) return;
      if (signedIn) {
        setProfile(signedIn);
      } else {
        router.replace("/sign-in/");
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function handleSignOut() {
    await signOut();
    router.push("/");
  }

  return { profile, handleSignOut };
}
