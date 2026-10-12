"use client";

import type { ReactNode } from "react";
import "@/lib/amplify-config";

export function Providers({ children }: { children: ReactNode }) {
  return children;
}
