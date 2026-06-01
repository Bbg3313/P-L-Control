"use client";

import { useFinancial } from "@/contexts/financial-context";

export function DataSyncBanner() {
  const { syncStatus, hydrated } = useFinancial();

  if (!hydrated || syncStatus === "loading" || syncStatus === "cloud") {
    return null;
  }

  if (syncStatus === "local-only") {
    return (
      <div
        className="border-b border-amber-200 bg-amber-50 px-4 py-2.5 text-center text-sm text-amber-900"
        role="status"
      >
        이 기기에만 저장 중입니다. URL 공유 시 데이터가 보이지 않습니다. Vercel
        프로젝트에{" "}
        <strong>Upstash Redis</strong>를 연결한 뒤 다시 배포해 주세요. (설정
        페이지 안내)
      </div>
    );
  }

  return (
    <div
      className="border-b border-rose-200 bg-rose-50 px-4 py-2.5 text-center text-sm text-rose-800"
      role="alert"
    >
      서버 저장에 실패했습니다. 변경 내용이 다른 사람에게 보이지 않을 수
      있습니다. 잠시 후 다시 시도하거나 페이지를 새로고침해 주세요.
    </div>
  );
}
