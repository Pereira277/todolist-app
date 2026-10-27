"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { fetchAuthSession } from "aws-amplify/auth";

export type Profile = { name: string; email: string };

/**
 * The single test for "signed in" used by every page, so the app pages and the
 * auth pages can never disagree and bounce the user between each other.
 *
 * Amplify refreshes expired tokens inside fetchAuthSession and clears them when
 * the refresh token is no longer valid; any failure counts as signed out.
 *
 * @returns The user's name and email from the ID token, or null without a valid session
 */
export async function getSignedInProfile(): Promise<Profile | null> {
  try {
    const { tokens } = await fetchAuthSession();
    const claims = tokens?.idToken?.payload;
    if (!claims) return null;
    return {
      name: typeof claims.name === "string" ? claims.name : "",
      email: typeof claims.email === "string" ? claims.email : "",
    };
  } catch {
    return null;
  }
}

/**
 * Sends a signed-in user from the sign-in, sign-up and confirm pages to the app.
 *
 * @returns True while the session check runs or the redirect is under way, so the page can render nothing
 */
export function useRedirectIfSignedIn(): boolean {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let cancelled = false;
    getSignedInProfile().then((profile) => {
      if (cancelled) return;
      if (profile) {
        router.replace("/app/");
      } else {
        setChecking(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return checking;
}
