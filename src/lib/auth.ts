/** 인증 쿠키 (httpOnly) */
export const AUTH_COOKIE_NAME = "pl-control-auth";

/** 사이트 접속 비밀번호 */
export const SITE_PASSWORD = "331300";

/** 서버·미들웨어 전용 세션 토큰 (클라이언트에 노출하지 않음) */
export function getSessionToken(): string {
  return (
    process.env.PL_AUTH_SESSION_TOKEN ??
    "pl-control-7e9f2c8a4b1d6e3f0a5c9b2d8e1f4a7c6b3d9e2f5a8c1b4d7e0f3a6c9b2d5e8f1a4"
  );
}

/** @deprecated 아이디 로그인 제거 — 호환용 */
export function getAuthUsername(): string {
  return "";
}

/** 접속 비밀번호 */
export function getAuthPassword(): string {
  return SITE_PASSWORD;
}

/** @deprecated getAuthPassword와 동일 */
export function getAccessPin(): string {
  return getAuthPassword();
}

export function isAuthenticated(cookieValue: string | undefined): boolean {
  return cookieValue === getSessionToken();
}
