"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { APP_COMPANY_NAME, APP_LOGO_ALT, APP_LOGO_SRC } from "@/lib/brand";

/** 탭(세션) 단위 잠금 해제 — 새로 열 때마다 다시 묻도록 sessionStorage 사용 */
const PIN_UNLOCK_SESSION_KEY = "pl-control-pin-unlocked";
const PIN_LENGTH = 4;

export function PinLockGate({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [pin, setPin] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setUnlocked(sessionStorage.getItem(PIN_UNLOCK_SESSION_KEY) === "1");
  }, []);

  useEffect(() => {
    if (unlocked === false) inputRef.current?.focus();
  }, [unlocked]);

  async function verify(value: string) {
    if (loading) return;
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: value }),
      });
      if (res.status === 401) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "비밀번호가 올바르지 않습니다.");
        setPin("");
        inputRef.current?.focus();
        return;
      }
      if (!res.ok) {
        setError("확인 요청에 실패했습니다.");
        return;
      }
      sessionStorage.setItem(PIN_UNLOCK_SESSION_KEY, "1");
      setUnlocked(true);
    } catch {
      setError("확인 요청에 실패했습니다.");
    } finally {
      setLoading(false);
    }
  }

  function handleChange(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    setPin(digits);
    if (digits.length === PIN_LENGTH) void verify(digits);
  }

  if (unlocked === null) return null;
  if (unlocked) return <>{children}</>;

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 p-4">
      <Card className="w-full max-w-xs">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center">
            <Image
              src={APP_LOGO_SRC}
              alt={APP_LOGO_ALT}
              width={56}
              height={56}
              className="h-14 w-14 object-contain"
              priority
            />
          </div>
          <CardTitle className="flex items-center justify-center gap-1.5 text-base">
            <Lock className="h-4 w-4" />
            {APP_COMPANY_NAME}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            접속 비밀번호를 입력하세요.
          </p>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (pin.length === PIN_LENGTH) void verify(pin);
            }}
            className="space-y-4"
          >
            <Input
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={PIN_LENGTH}
              value={pin}
              onChange={(e) => handleChange(e.target.value)}
              placeholder="••••"
              className="text-center text-2xl tracking-[0.5em]"
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
              disabled={loading || pin.length !== PIN_LENGTH}
            >
              {loading ? "확인 중…" : "확인"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
