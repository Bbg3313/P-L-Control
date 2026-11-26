"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  APP_COMPANY_NAME,
  APP_LOGO_ALT,
  APP_LOGO_SRC,
  APP_SUBTITLE,
} from "@/lib/brand";
import { AUTH_UNLOCK_SESSION_KEY } from "@/lib/auth-session";

function PasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      const data = (await res.json()) as { error?: string };

      if (!res.ok) {
        setError(data.error ?? "비밀번호가 올바르지 않습니다.");
        setPassword("");
        return;
      }

      sessionStorage.setItem(AUTH_UNLOCK_SESSION_KEY, "1");
      const from = searchParams.get("from");
      router.replace(from && from.startsWith("/") ? from : "/");
      router.refresh();
    } catch {
      setError("확인 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center">
            <Image
              src={APP_LOGO_SRC}
              alt={APP_LOGO_ALT}
              width={64}
              height={64}
              className="h-16 w-16 object-contain"
              priority
            />
          </div>
          <CardTitle className="space-y-0.5 text-lg leading-snug">
            <span className="flex items-center justify-center gap-1.5">
              <Lock className="h-4 w-4" />
              {APP_COMPANY_NAME}
            </span>
            <span className="block text-base font-medium text-muted-foreground">
              {APP_SUBTITLE}
            </span>
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            접속 비밀번호를 입력하세요.
          </p>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              id="password"
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              autoFocus
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="비밀번호"
              className="text-center text-lg tracking-widest"
              aria-label="접속 비밀번호"
            />

            {error && (
              <p className="text-center text-sm text-destructive" role="alert">
                {error}
              </p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={loading || !password}
            >
              {loading ? "확인 중…" : "확인"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
          로딩 중…
        </div>
      }
    >
      <PasswordForm />
    </Suspense>
  );
}
