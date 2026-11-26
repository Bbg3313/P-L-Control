"use client";

import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AUTH_UNLOCK_SESSION_KEY } from "@/lib/auth-session";

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    try {
      sessionStorage.removeItem(AUTH_UNLOCK_SESSION_KEY);
    } catch {
      /* ignore */
    }
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  return (
    <Button type="button" variant="outline" size="sm" onClick={handleLogout}>
      <LogOut data-icon="inline-start" />
      로그아웃
    </Button>
  );
}
