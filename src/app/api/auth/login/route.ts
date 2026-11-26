import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthPassword,
  getSessionToken,
} from "@/lib/auth";

export async function POST(request: Request) {
  let password = "";

  try {
    const body = (await request.json()) as {
      password?: string;
      pin?: string;
    };
    password = String(body.password ?? body.pin ?? "");
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (password !== getAuthPassword()) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  const response = NextResponse.json({ ok: true });
  // maxAge 없음 = 브라우저 세션 쿠키 (창 종료 시 만료)
  response.cookies.set(AUTH_COOKIE_NAME, getSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
  });

  return response;
}
