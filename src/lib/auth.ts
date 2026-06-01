/** 인증 쿠키 (httpOnly) */
export const AUTH_COOKIE_NAME = "pl-control-auth";

/** 서버·미들웨어 전용 세션 토큰 (클라이언트에 노출하지 않음) */
export function getSessionToken(): string {
  return (
    process.env.PL_AUTH_SESSION_TOKEN ??
    "pl-control-7e9f2c8a4b1d6e3f0a5c9b2d8e1f4a7c6b3d9e2f5a8c1b4d7e0f3a6c9b2d5e8f1a4"
  );
}

/** 로그인 비밀번호 (서버 API에서만 사용) */
export function getAuthPassword(): string {
  return process.env.PL_AUTH_PASSWORD ?? "3313";
}

export function isAuthenticated(cookieValue: string | undefined): boolean {
  return cookieValue === getSessionToken();
}
