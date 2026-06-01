# Corporate P&L & Investment Capacity Dashboard

Web dashboard for monthly profit & loss and investment capacity (net profit minus fixed costs reserve). Built for marketing agency operations.

## Stack

- Next.js 14 (App Router)
- Tailwind CSS + shadcn/ui
- Recharts
- Lucide React

## Getting started

```powershell
cd corporate-pl-dashboard
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project structure

- `src/app/(dashboard)/` — Main routes (Dashboard, Revenue, Expenses, Settings)
- `src/lib/financial-data.ts` — Dummy agency revenue/expense records and P&L calculations
- `src/components/dashboard/` — Summary cards and revenue vs expenses chart

## Investment capacity

For the selected month:

**Investment Capacity = Net Profit − Fixed Costs Reserve**

Default reserve: **₩114,800,000** (editable in Settings in a future step). All amounts are in KRW.
