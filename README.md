# 기업 손익·투자 여력 대시보드 (P&L Control)

마케팅 에이전시 운영을 위한 월별 손익(P&L) 및 투자 여력 관리 대시보드입니다.

## 링크

| 항목 | URL |
|------|-----|
| **배포 (Production)** | https://corporate-pl-dashboard.vercel.app |
| **GitHub** | https://github.com/Bbg3313/P-L-Control |

`main` 브랜치에 push하면 Vercel이 자동으로 프로덕션 배포합니다.

## 기술 스택

- Next.js 14 (App Router)
- Tailwind CSS + shadcn/ui
- Recharts
- Lucide React

## 로컬 실행

```powershell
git clone https://github.com/Bbg3313/P-L-Control.git
cd P-L-Control
npm install
npm run dev
```

http://localhost:3000 에서 확인합니다.

## 프로젝트 구조

- `src/app/(dashboard)/` — 대시보드, 매출, 비용, 설정
- `src/lib/financial-data.ts` — 더미 데이터 및 P&L·투자 여력 계산
- `src/components/dashboard/` — 요약 카드, 매출 vs 비용 차트

## 투자 여력 공식

해당 월 기준:

- **운영비** = 기타 비용 + 고정 인건비  
- **월평균 운영비** = 최근 3개월 운영비 평균 (데이터 있는 달 기준)  
- **예비금** = 월평균 운영비 × **3개월** (운영자금 3개월분, 일반적인 현금보유 기준)  
- **투자 여력** = 순이익 − 예비금

## 데이터 공유 (중요)

매출·비용·인건비는 **브라우저가 아니라 서버(Redis)** 에 저장됩니다.  
같은 URL과 비밀번호로 들어가면 **모든 사람이 같은 숫자**를 봅니다.

### Vercel에 Redis 연결 (최초 1회)

1. [Vercel](https://vercel.com) → 이 프로젝트 → **Storage** (또는 Marketplace에서 **Upstash Redis**)
2. Redis DB 생성 후 **이 프로젝트에 Connect**
3. 환경 변수 `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` 확인 후 **Redeploy**
4. 앱 **설정** 페이지에서 「서버에 저장 중」 문구 확인

Redis가 없으면 예전처럼 **그 브라우저에만** 저장됩니다.

## 배포

Vercel 프로젝트가 [P-L-Control](https://github.com/Bbg3313/P-L-Control) 저장소와 연결되어 있습니다.

```powershell
npm run build   # 로컬 빌드 검증
git push origin main   # 자동 배포
```
