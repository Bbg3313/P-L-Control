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

## 배포

Vercel 프로젝트가 [P-L-Control](https://github.com/Bbg3313/P-L-Control) 저장소와 연결되어 있습니다.

```powershell
npm run build   # 로컬 빌드 검증
git push origin main   # 자동 배포
```
