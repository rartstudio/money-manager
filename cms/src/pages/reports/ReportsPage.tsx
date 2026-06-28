import { useEffect, useMemo, useState } from 'react'
import { getMonthlySummary, getCategoryBreakdown, getInsights } from '@/api/reports'
import { listTransactions, type Transaction } from '@/api/transactions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import PageHeader from '@/components/shared/PageHeader'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Trophy, CalendarDays, BarChart2 } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, CartesianGrid,
} from 'recharts'

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

function formatShort(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}

const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']

interface Summary { income: number; expense: number; balance: number; transaction_count: number; avg_daily_expense: number }
interface CategoryItem { category: { id: string; name: string; icon: string; color: string }; amount: number; percentage: number }
interface Insights {
  top_expense_category?: { category_name: string; amount: number; percentage: number }
  biggest_single_expense?: { amount: number; description: string; date: string; category_name: string }
  month_over_month?: { expense_change_percent: number; income_change_percent: number; trend: string }
  budget_exceeded_categories?: string[]
  savings_rate: number
}

export default function ReportsPage() {
  const now = new Date()
  const [month, setMonth] = useState(now.getMonth() + 1)
  const [year, setYear] = useState(now.getFullYear())
  const [breakdownType, setBreakdownType] = useState<'expense' | 'income'>('expense')

  const [summary, setSummary] = useState<Summary | null>(null)
  const [breakdown, setBreakdown] = useState<CategoryItem[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)

  const [monthTxs, setMonthTxs] = useState<Transaction[]>([])
  const [monthTxsLoading, setMonthTxsLoading] = useState(false)

  const [showWeekly, setShowWeekly] = useState(false)

  // Main fetch — summary, breakdown, insights, monthly transactions
  useEffect(() => {
    setLoading(true)
    setMonthTxsLoading(true)
    const pad = (n: number) => String(n).padStart(2, '0')
    const daysInMonth = new Date(year, month, 0).getDate()
    const startDate = `${year}-${pad(month)}-01`
    const endDate = `${year}-${pad(month)}-${pad(daysInMonth)}`

    Promise.all([
      getMonthlySummary(month, year),
      getCategoryBreakdown(breakdownType, month, year),
      getInsights(month, year),
      listTransactions({ start_date: startDate, end_date: endDate, limit: 500 }),
    ])
      .then(([s, b, ins, txs]) => {
        setSummary(s.data.data)
        setBreakdown(b.data.data ?? [])
        setInsights(ins.data.data)
        setMonthTxs(txs.data.data.transactions ?? [])
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false)
        setMonthTxsLoading(false)
      })
  }, [month, year, breakdownType])

  // Daily chart data
  const dailyData = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const map: Record<number, { income: number; expense: number }> = {}
    for (let d = 1; d <= daysInMonth; d++) map[d] = { income: 0, expense: 0 }
    for (const tx of monthTxs) {
      const d = new Date(tx.date).getDate()
      if (tx.type === 'income') map[d].income += tx.amount
      if (tx.type === 'expense') map[d].expense += tx.amount
    }
    return Array.from({ length: daysInMonth }, (_, i) => ({
      day: String(i + 1),
      Pemasukan: map[i + 1].income,
      Pengeluaran: map[i + 1].expense,
    }))
  }, [monthTxs, month, year])

  // Weekly data
  const weeklyData = useMemo(() => {
    const daysInMonth = new Date(year, month, 0).getDate()
    const weeks: { label: string; shortLabel: string; start: number; end: number }[] = []
    for (let s = 1; s <= daysInMonth; s += 7) {
      const e = Math.min(s + 6, daysInMonth)
      weeks.push({ label: `Minggu ${weeks.length + 1}`, shortLabel: `Mg ${weeks.length + 1}`, start: s, end: e })
    }
    return weeks.map(({ label, shortLabel, start, end }) => {
      const slice = monthTxs.filter((t) => {
        const d = new Date(t.date).getDate()
        return d >= start && d <= end
      })
      const income = slice.filter((t) => t.type === 'income').reduce((a, t) => a + t.amount, 0)
      const expense = slice.filter((t) => t.type === 'expense').reduce((a, t) => a + t.amount, 0)
      return { label, shortLabel, dateRange: `${start}–${end} ${monthNames[month - 1]}`, income, expense, net: income - expense, count: slice.length }
    })
  }, [monthTxs, month, year])

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
  const mom = insights?.month_over_month
  const savingsRate = insights?.savings_rate ?? null

  const pieData = breakdown.slice(0, 7).map((b) => ({
    name: `${b.category.icon} ${b.category.name}`,
    value: b.amount,
    pct: b.percentage,
  }))

  const momExpColor = mom && mom.expense_change_percent < 0 ? 'text-green-600' : 'text-red-600'
  const momIncColor = mom && mom.income_change_percent > 0 ? 'text-green-600' : 'text-red-600'
  const hasDailyData = dailyData.some((d) => d.Pemasukan > 0 || d.Pengeluaran > 0)

  return (
    <div className="space-y-6">
      <PageHeader title="Laporan" description={`Analisis keuangan bulan ${monthNames[month - 1]} ${year}`} />

      {/* Month/year picker */}
      <div className="flex gap-2">
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v ?? month))}>
          <SelectTrigger className="w-32">
            <SelectValue>{monthNames[month - 1]}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {monthNames.map((m, i) => <SelectItem key={i+1} value={String(i+1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v ?? year))}>
          <SelectTrigger className="w-28">
            <SelectValue>{year}</SelectValue>
          </SelectTrigger>
          <SelectContent>
            {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Pemasukan', value: summary?.income, color: 'text-green-600' },
          { label: 'Pengeluaran', value: summary?.expense, color: 'text-red-600' },
          { label: 'Selisih Bersih', value: summary?.balance, color: summary?.balance != null && summary.balance >= 0 ? 'text-green-600' : 'text-red-600' },
          { label: 'Rata-rata Pengeluaran/Hari', value: summary?.avg_daily_expense, color: 'text-foreground' },
        ].map(({ label, value, color }) => (
          <Card key={label}>
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-medium text-muted-foreground">{label}</CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? <Skeleton className="h-7 w-28" /> : (
                <p className={`text-lg font-bold ${color}`}>{value != null ? formatRupiah(value) : '-'}</p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Insights row */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Tingkat Tabungan</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-20" /> : savingsRate != null ? (
              <>
                <p className={`text-2xl font-bold ${savingsRate >= 20 ? 'text-green-600' : savingsRate >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {Math.round(savingsRate)}%
                </p>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${savingsRate >= 20 ? 'bg-green-500' : savingsRate >= 0 ? 'bg-yellow-400' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(Math.max(savingsRate, 0), 100)}%` }} />
                </div>
              </>
            ) : <p className="text-sm text-muted-foreground">-</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pengeluaran vs Bulan Lalu</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-24" /> : mom ? (
              <div className="flex items-center gap-2">
                {mom.expense_change_percent < -1 ? <TrendingDown size={20} className="text-green-600" /> :
                 mom.expense_change_percent > 1 ? <TrendingUp size={20} className="text-red-600" /> :
                 <Minus size={20} className="text-muted-foreground" />}
                <div>
                  <p className={`text-lg font-bold ${momExpColor}`}>
                    {mom.expense_change_percent > 0 ? '+' : ''}{mom.expense_change_percent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground capitalize">{
                    mom.trend === 'improving' ? 'Membaik' : mom.trend === 'worsening' ? 'Memburuk' : 'Stabil'
                  }</p>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">-</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground">Pemasukan vs Bulan Lalu</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-24" /> : mom ? (
              <div className="flex items-center gap-2">
                {mom.income_change_percent > 1 ? <TrendingUp size={20} className="text-green-600" /> :
                 mom.income_change_percent < -1 ? <TrendingDown size={20} className="text-red-600" /> :
                 <Minus size={20} className="text-muted-foreground" />}
                <div>
                  <p className={`text-lg font-bold ${momIncColor}`}>
                    {mom.income_change_percent > 0 ? '+' : ''}{mom.income_change_percent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-muted-foreground">dari bulan lalu</p>
                </div>
              </div>
            ) : <p className="text-sm text-muted-foreground">-</p>}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Trophy size={11} /> Pengeluaran Terbesar
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-32" /> : insights?.biggest_single_expense ? (
              <>
                <p className="text-lg font-bold text-red-600">{formatRupiah(insights.biggest_single_expense.amount)}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {insights.biggest_single_expense.description || insights.biggest_single_expense.category_name}
                </p>
                <p className="text-xs text-muted-foreground">{insights.biggest_single_expense.date}</p>
              </>
            ) : <p className="text-sm text-muted-foreground">-</p>}
          </CardContent>
        </Card>
      </div>

      {/* Budget exceeded alert */}
      {!loading && insights?.budget_exceeded_categories && insights.budget_exceeded_categories.length > 0 && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-950/20 p-3 text-sm">
          <AlertTriangle size={16} className="text-red-500 mt-0.5 shrink-0" />
          <div>
            <p className="font-medium text-red-700 dark:text-red-400">Anggaran terlampaui</p>
            <p className="text-red-600 dark:text-red-400">{insights.budget_exceeded_categories.join(', ')}</p>
          </div>
        </div>
      )}

      {/* Category breakdown: pie + detail list side by side */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-semibold">
              {breakdownType === 'expense' ? 'Pengeluaran' : 'Pemasukan'} per Kategori
            </CardTitle>
            <Select value={breakdownType} onValueChange={(v) => setBreakdownType(v as 'expense' | 'income')}>
              <SelectTrigger className="w-32 h-7 text-xs">
                <SelectValue>{breakdownType === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Pengeluaran</SelectItem>
                <SelectItem value="income">Pemasukan</SelectItem>
              </SelectContent>
            </Select>
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-52 w-full" /> : pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Belum ada data</p>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <PieChart>
                  <Pie data={pieData} cx="40%" cy="50%" innerRadius={52} outerRadius={80} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip formatter={(v, _n, p) => [`${formatRupiah(Number(v))} (${p.payload.pct}%)`, p.payload.name]} contentStyle={{ fontSize: 12 }} />
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8}
                    formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">
              Detail {breakdownType === 'expense' ? 'Pengeluaran' : 'Pemasukan'} — {monthNames[month-1]} {year}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{[1,2,3,4].map(i => <Skeleton key={i} className="h-6 w-full" />)}</div>
            ) : breakdown.length === 0 ? (
              <p className="text-sm text-muted-foreground">Tidak ada data</p>
            ) : (
              <div className="space-y-3">
                {breakdown.map((item) => (
                  <div key={item.category.id}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span>{item.category.icon} {item.category.name}</span>
                      <span className={`font-medium ${breakdownType === 'expense' ? 'text-red-600' : 'text-green-600'}`}>
                        {formatRupiah(item.amount)}
                        <span className="text-muted-foreground font-normal ml-1">({item.percentage.toFixed(1)}%)</span>
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className={`h-full rounded-full ${breakdownType === 'expense' ? 'bg-red-500' : 'bg-green-500'}`}
                        style={{ width: `${Math.min(item.percentage, 100)}%` }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Arus Kas Harian */}
      <Card>
        <CardHeader className="flex flex-row items-center gap-2 pb-3">
          <BarChart2 size={16} className="text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">
            Arus Kas Harian — {monthNames[month - 1]} {year}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthTxsLoading ? (
            <Skeleton className="h-52 w-full" />
          ) : !hasDailyData ? (
            <p className="text-sm text-muted-foreground text-center py-10">Tidak ada transaksi bulan ini</p>
          ) : (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyData} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
                  <defs>
                    <linearGradient id="gradIncome" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="gradExpense" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#ef4444" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#ef4444" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.06} />
                  <XAxis dataKey="day" tick={{ fontSize: 10 }} axisLine={false} tickLine={false}
                    interval={dailyData.length > 20 ? 4 : 1} />
                  <YAxis tickFormatter={formatShort} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip formatter={(v, name) => [formatRupiah(Number(v)), name]}
                    labelFormatter={(l) => `Tgl ${l}`} contentStyle={{ fontSize: 12 }} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Pemasukan" stroke="#10b981" strokeWidth={2} fill="url(#gradIncome)" dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="Pengeluaran" stroke="#ef4444" strokeWidth={2} fill="url(#gradExpense)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>

              {(() => {
                const peakExp = dailyData.reduce((a, b) => a.Pengeluaran >= b.Pengeluaran ? a : b)
                const peakInc = dailyData.reduce((a, b) => a.Pemasukan >= b.Pemasukan ? a : b)
                return (
                  <div className="grid grid-cols-2 gap-3">
                    {peakExp.Pengeluaran > 0 && (
                      <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900 px-4 py-3">
                        <p className="text-[10px] text-red-400 font-medium uppercase tracking-wide mb-1">Pengeluaran Tertinggi</p>
                        <p className="text-sm font-bold text-red-600">Tgl {peakExp.day}</p>
                        <p className="text-xs text-red-500">{formatRupiah(peakExp.Pengeluaran)}</p>
                      </div>
                    )}
                    {peakInc.Pemasukan > 0 && (
                      <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-100 dark:border-green-900 px-4 py-3">
                        <p className="text-[10px] text-green-500 font-medium uppercase tracking-wide mb-1">Pemasukan Tertinggi</p>
                        <p className="text-sm font-bold text-green-600">Tgl {peakInc.day}</p>
                        <p className="text-xs text-green-600">{formatRupiah(peakInc.Pemasukan)}</p>
                      </div>
                    )}
                  </div>
                )
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Perbandingan Mingguan */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Perbandingan Mingguan — {monthNames[month - 1]} {year}</CardTitle>
          </div>
          <Button variant={showWeekly ? 'default' : 'outline'} size="sm" className="h-7 text-xs"
            onClick={() => setShowWeekly((v) => !v)}>
            {showWeekly ? 'Tutup' : 'Tampilkan'}
          </Button>
        </CardHeader>

        {showWeekly && (
          <CardContent className="space-y-5">
            {monthTxsLoading ? (
              <Skeleton className="h-52 w-full" />
            ) : weeklyData.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Tidak ada transaksi bulan ini</p>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={weeklyData.map((w) => ({ name: w.shortLabel, Pemasukan: w.income, Pengeluaran: w.expense }))} barCategoryGap="30%" barGap={3}>
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={formatShort} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v) => formatRupiah(Number(v))} contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="Pemasukan" fill="#10b981" radius={[3, 3, 0, 0]} />
                    <Bar dataKey="Pengeluaran" fill="#ef4444" radius={[3, 3, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Periode</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-green-700 dark:text-green-400">Pemasukan</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-red-600 dark:text-red-400">Pengeluaran</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Selisih</th>
                        <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Trx</th>
                      </tr>
                    </thead>
                    <tbody>
                      {weeklyData.map((w) => (
                        <tr key={w.label} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                          <td className="px-4 py-2.5">
                            <p className="text-xs font-medium">{w.label}</p>
                            <p className="text-[10px] text-muted-foreground">{w.dateRange}</p>
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold text-green-600 tabular-nums">
                            {w.income > 0 ? formatRupiah(w.income) : <span className="text-muted-foreground font-normal">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs font-semibold text-red-500 tabular-nums">
                            {w.expense > 0 ? formatRupiah(w.expense) : <span className="text-muted-foreground font-normal">—</span>}
                          </td>
                          <td className={`px-4 py-2.5 text-right text-xs font-semibold tabular-nums ${w.net < 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {w.net !== 0 ? formatRupiah(w.net) : <span className="text-muted-foreground font-normal">—</span>}
                          </td>
                          <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{w.count}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr className="border-t bg-muted/30">
                        <td className="px-4 py-2.5 text-xs font-semibold">Total</td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold text-green-600 tabular-nums">
                          {formatRupiah(weeklyData.reduce((a, w) => a + w.income, 0))}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-semibold text-red-500 tabular-nums">
                          {formatRupiah(weeklyData.reduce((a, w) => a + w.expense, 0))}
                        </td>
                        <td className={`px-4 py-2.5 text-right text-xs font-semibold tabular-nums ${
                          weeklyData.reduce((a, w) => a + w.net, 0) < 0 ? 'text-red-500' : 'text-green-600'}`}>
                          {formatRupiah(weeklyData.reduce((a, w) => a + w.net, 0))}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                          {weeklyData.reduce((a, w) => a + w.count, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {weeklyData.some((w) => w.expense > 0) && (() => {
                  const withExp = weeklyData.filter((w) => w.expense > 0)
                  const worstExp = withExp.reduce((a, b) => a.expense > b.expense ? a : b)
                  const bestExp = withExp.reduce((a, b) => a.expense < b.expense ? a : b)
                  return (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-lg border bg-red-50 dark:bg-red-950/20 border-red-100 dark:border-red-900 px-4 py-3">
                        <p className="text-[10px] text-red-400 font-medium uppercase tracking-wide mb-1">Pengeluaran Tertinggi</p>
                        <p className="text-sm font-bold text-red-600">{worstExp.label}</p>
                        <p className="text-xs text-red-500">{formatRupiah(worstExp.expense)}</p>
                        <p className="text-[10px] text-muted-foreground">{worstExp.dateRange}</p>
                      </div>
                      <div className="rounded-lg border bg-green-50 dark:bg-green-950/20 border-green-100 dark:border-green-900 px-4 py-3">
                        <p className="text-[10px] text-green-500 font-medium uppercase tracking-wide mb-1">Pengeluaran Terendah</p>
                        <p className="text-sm font-bold text-green-600">{bestExp.label}</p>
                        <p className="text-xs text-green-600">{formatRupiah(bestExp.expense)}</p>
                        <p className="text-[10px] text-muted-foreground">{bestExp.dateRange}</p>
                      </div>
                    </div>
                  )
                })()}
              </>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
