import { NextResponse } from "next/server";
import { getAccessPin } from "@/lib/auth";

export async function POST(request: Request) {
  let pin = "";
  try {
    const body = (await request.json()) as { pin?: string };
    pin = String(body.pin ?? "").trim();
  } catch {
    return NextResponse.json(
      { error: "요청 형식이 올바르지 않습니다." },
      { status: 400 }
    );
  }

  if (pin !== getAccessPin()) {
    return NextResponse.json(
      { error: "비밀번호가 올바르지 않습니다." },
      { status: 401 }
    );
  }

  return NextResponse.json({ ok: true });
}
