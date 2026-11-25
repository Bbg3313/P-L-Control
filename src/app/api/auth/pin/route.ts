import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthPassword,
  getSessionToken,
} from "@/lib/auth";

/** @deprecated /api/auth/login 사용. 호환용으로 유지 */
export async function POST(request: Request) {
  let pin = "";
  try {
    const body = (await request.json()) as { pin?: string; password?: string };
    pin = String(body.pin ?? body.password ?? "").trim();
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (pin !== getAuthPassword()) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(AUTH_COOKIE_NAME, getSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
