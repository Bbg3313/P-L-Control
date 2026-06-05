import { NextResponse } from "next/server";
import {
  AUTH_COOKIE_NAME,
  getAuthPassword,
  getAuthUsername,
  getSessionToken,
} from "@/lib/auth";

export async function POST(request: Request) {
  let username = "";
  let password = "";

  try {
    const body = (await request.json()) as {
      username?: string;
      password?: string;
    };
    username = String(body.username ?? "").trim();
    password = String(body.password ?? "");
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (username !== getAuthUsername() || password !== getAuthPassword()) {
    return NextResponse.json(
      { error: "아이디 또는 비밀번호가 올바르지 않습니다." },
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
