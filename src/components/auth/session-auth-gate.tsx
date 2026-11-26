"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { AUTH_UNLOCK_SESSION_KEY } from "@/lib/auth-session";

/**
 * 창/탭을 닫으면 sessionStorage가 사라져 다시 비밀번호를 묻는다.
 * (쿠키만으로는 브라우저가 세션을 복원하는 경우가 있어 이중으로 잠금)
 */
export function SessionAuthGate({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ok, setOk] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function check() {
      if (sessionStorage.getItem(AUTH_UNLOCK_SESSION_KEY) === "1") {
        if (!cancelled) setOk(true);
        return;
      }
      try {
        await fetch("/api/auth/logout", { method: "POST" });
      } catch {
        /* ignore */
      }
      if (cancelled) return;
      const from =
        pathname && pathname !== "/login"
          ? `?from=${encodeURIComponent(pathname)}`
          : "";
      router.replace(`/login${from}`);
      router.refresh();
    }
    void check();
    return () => {
      cancelled = true;
    };
  }, [pathname, router]);

  if (!ok) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        확인 중…
      </div>
    );
  }

  return <>{children}</>;
}
