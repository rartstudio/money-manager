import { useEffect, useMemo, useState } from 'react'
import { getMonthlySummary, getCategoryBreakdown, getMonthlyTrend, getInsights } from '@/api/reports'
import { listTransactions, type Transaction } from '@/api/transactions'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import PageHeader from '@/components/shared/PageHeader'
import { TrendingUp, TrendingDown, Minus, AlertTriangle, Trophy, GitCompare, PlusCircle, X, CalendarDays, BarChart2, LineChart as LineChartIcon } from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  AreaChart, Area, LineChart, Line, CartesianGrid,
} from 'recharts'

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)

function formatShort(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}

function monthOffset(month: number, year: number, offset: number) {
  let m = month + offset
  let y = year
  while (m <= 0) { m += 12; y-- }
  while (m > 12) { m -= 12; y++ }
  return { month: m, year: y }
}

const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']
const CAT_TREND_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#84cc16','#0ea5e9',
  '#a855f7','#d946ef','#06b6d4','#78716c','#64748b',
]

interface Summary { income: number; expense: number; balance: number; transaction_count: number; avg_daily_expense: number }
interface CategoryItem { category: { id: string; name: string; icon: string; color: string }; amount: number; percentage: number }
interface TrendItem { month: string; income: number; expense: number }
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
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loading, setLoading] = useState(true)

  // Monthly transactions — shared by daily chart and weekly section
  const [monthTxs, setMonthTxs] = useState<Transaction[]>([])
  const [monthTxsLoading, setMonthTxsLoading] = useState(false)

  // Category trend (last 3 months)
  const [showCategoryTrend, setShowCategoryTrend] = useState(false)
  const [categoryTrendData, setCategoryTrendData] = useState<CategoryItem[][]>([])
  const [categoryTrendLoading, setCategoryTrendLoading] = useState(false)
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set())

  // — Comparison state —
  const prevMonth = month > 1 ? month - 1 : 12
  const prevYear = month > 1 ? year : year - 1
  const [showCompare, setShowCompare] = useState(false)
  const [compareSlots, setCompareSlots] = useState<{ month: number; year: number }[]>([
    { month: prevMonth, year: prevYear },
    { month, year },
  ])
  const [compareData, setCompareData] = useState<(Summary | null)[]>([])
  const [compareLoading, setCompareLoading] = useState(false)

  // — Weekly section toggle —
  const [showWeekly, setShowWeekly] = useState(false)

  // Main data fetch
  useEffect(() => {
    setLoading(true)
    const pad = (n: number) => String(n).padStart(2, '0')
    const daysInMonth = new Date(year, month, 0).getDate()
    const startDate = `${year}-${pad(month)}-01`
    const endDate = `${year}-${pad(month)}-${pad(daysInMonth)}`

    setMonthTxsLoading(true)

    Promise.all([
      getMonthlySummary(month, year),
      getCategoryBreakdown(breakdownType, month, year),
      getMonthlyTrend(),
      getInsights(month, year),
      listTransactions({ start_date: startDate, end_date: endDate, limit: 500 }),
    ])
      .then(([s, b, t, ins, txs]) => {
        setSummary(s.data.data)
        setBreakdown(b.data.data ?? [])
        setTrend((t.data.data ?? []).slice(-6))
        setInsights(ins.data.data)
        setMonthTxs(txs.data.data.transactions ?? [])
      })
      .catch(() => {})
      .finally(() => {
        setLoading(false)
        setMonthTxsLoading(false)
      })
  }, [month, year, breakdownType])

  // Category trend fetch (on demand)
  const categoryTrendMonths = useMemo(
    () => [-2, -1, 0].map((o) => {
      const { month: m, year: y } = monthOffset(month, year, o)
      return { label: `${monthNames[m - 1]} '${String(y).slice(-2)}`, month: m, year: y }
    }),
    [month, year],
  )

  useEffect(() => {
    if (!showCategoryTrend) return
    setCategoryTrendLoading(true)
    Promise.all(
      categoryTrendMonths.map(({ month: m, year: y }) => getCategoryBreakdown(breakdownType, m, y))
    )
      .then((results) => {
        const allData = results.map((r) => r.data.data ?? [])
        setCategoryTrendData(allData)
        // collect all unique category ids across all months
        const allIds = new Set<string>()
        allData.forEach((month) => month.forEach((b: CategoryItem) => allIds.add(b.category.id)))
        setSelectedCatIds(allIds)
      })
      .catch(() => {})
      .finally(() => setCategoryTrendLoading(false))
  }, [showCategoryTrend, month, year, breakdownType, categoryTrendMonths])

  // All categories across all 3 trend months (union), preserving order by current month first
  const allTrendCategories = useMemo(() => {
    const seen = new Set<string>()
    const result: { id: string; name: string }[] = []
    // current month first, then fill from other months
    ;[...categoryTrendData].reverse().forEach((monthData) => {
      monthData.forEach((b) => {
        if (!seen.has(b.category.id)) {
          seen.add(b.category.id)
          result.unshift({ id: b.category.id, name: `${b.category.icon} ${b.category.name}` })
        }
      })
    })
    return result
  }, [categoryTrendData])

  // Category trend chart data — keyed by id to avoid conflicts with duplicate names
  const categoryTrendChartData = useMemo(() => {
    if (categoryTrendData.length !== 3) return []
    const activeCats = allTrendCategories.filter((c) => selectedCatIds.has(c.id))
    return categoryTrendMonths.map(({ label }, mi) => {
      const entry: Record<string, number | string> = { month: label }
      activeCats.forEach(({ id }) => {
        const found = categoryTrendData[mi]?.find((b) => b.category.id === id)
        entry[id] = found?.amount ?? 0
      })
      return entry
    })
  }, [categoryTrendData, allTrendCategories, selectedCatIds, categoryTrendMonths])

  const activeCategories = useMemo(
    () => allTrendCategories.filter((c) => selectedCatIds.has(c.id)),
    [allTrendCategories, selectedCatIds],
  )

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

  // Weekly data (uses monthTxs)
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

  // Compare
  useEffect(() => {
    if (!showCompare) return
    setCompareLoading(true)
    Promise.all(compareSlots.map((s) => getMonthlySummary(s.month, s.year)))
      .then((results) => setCompareData(results.map((r) => (r.data as { data: Summary }).data)))
      .catch(() => {})
      .finally(() => setCompareLoading(false))
  }, [showCompare, compareSlots])

  const compareLabels = useMemo(
    () => compareSlots.map((s) => `${monthNames[s.month - 1]} '${String(s.year).slice(-2)}`),
    [compareSlots],
  )

  const compareChartData = useMemo(() => {
    if (compareData.length !== compareSlots.length) return []
    return [
      { metric: 'Pemasukan', ...Object.fromEntries(compareLabels.map((l, i) => [l, compareData[i]?.income ?? 0])) },
      { metric: 'Pengeluaran', ...Object.fromEntries(compareLabels.map((l, i) => [l, compareData[i]?.expense ?? 0])) },
      { metric: 'Selisih', ...Object.fromEntries(compareLabels.map((l, i) => [l, compareData[i]?.balance ?? 0])) },
    ]
  }, [compareData, compareLabels, compareSlots.length])

  const COMPARE_COLORS = ['#6366f1', '#f59e0b', '#10b981']

  const updateSlot = (i: number, field: 'month' | 'year', val: number) => {
    setCompareSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
  }

  const addSlot = () => {
    if (compareSlots.length >= 3) return
    const last = compareSlots[compareSlots.length - 1]
    const nm = last.month > 1 ? last.month - 1 : 12
    const ny = last.month > 1 ? last.year : last.year - 1
    setCompareSlots((prev) => [{ month: nm, year: ny }, ...prev])
  }

  const removeSlot = (i: number) => {
    if (compareSlots.length <= 2) return
    setCompareSlots((prev) => prev.filter((_, idx) => idx !== i))
  }

  const compareTableRows: { label: string; get: (s: Summary) => string; highlight: 'high' | 'low' | 'none' }[] = [
    { label: 'Pemasukan', get: (s) => formatRupiah(s.income), highlight: 'high' },
    { label: 'Pengeluaran', get: (s) => formatRupiah(s.expense), highlight: 'low' },
    { label: 'Selisih Bersih', get: (s) => formatRupiah(s.balance), highlight: 'high' },
    { label: 'Rata-rata/Hari', get: (s) => formatRupiah(s.avg_daily_expense), highlight: 'low' },
    { label: 'Jml Transaksi', get: (s) => String(s.transaction_count), highlight: 'none' },
  ]

  const years = [now.getFullYear() - 1, now.getFullYear(), now.getFullYear() + 1]
  const mom = insights?.month_over_month
  const savingsRate = insights?.savings_rate ?? null

  const trendData = trend.map((t) => ({
    name: monthNames[Number(t.month.split('-')[1]) - 1],
    Pemasukan: t.income,
    Pengeluaran: t.expense,
  }))

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
      <PageHeader title="Laporan" description="Analisis mendalam — mengapa dan bagaimana keuangan bulan ini" />

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
        {/* Savings Rate */}
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

        {/* MoM expense */}
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

        {/* MoM income */}
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

        {/* Biggest expense */}
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
            <p className="text-red-600 dark:text-red-400">
              {insights.budget_exceeded_categories.join(', ')}
            </p>
          </div>
        </div>
      )}

      {/* Charts row */}
      <div className="grid gap-4 lg:grid-cols-2">
        {/* Trend bar chart */}
        <Card>
          <CardHeader><CardTitle className="text-sm font-semibold">Tren 6 Bulan Terakhir</CardTitle></CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-52 w-full" /> : trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Belum ada data</p>
            ) : (
              <ResponsiveContainer width="100%" height={210}>
                <BarChart data={trendData} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatShort} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v) => formatRupiah(Number(v))} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Pemasukan" fill="#10b981" radius={[3,3,0,0]} />
                  <Bar dataKey="Pengeluaran" fill="#ef4444" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Category breakdown pie + list */}
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
      </div>

      {/* Category breakdown detail list */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">
            Detail {breakdownType === 'expense' ? 'Pengeluaran' : 'Pemasukan'} per Kategori — {monthNames[month-1]} {year}
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

      {/* ── Tren Per Kategori ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <LineChartIcon size={16} className="text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">
              Tren {breakdownType === 'expense' ? 'Pengeluaran' : 'Pemasukan'} Per Kategori — 3 Bulan Terakhir
            </CardTitle>
          </div>
          <Button
            variant={showCategoryTrend ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowCategoryTrend((v) => !v)}
          >
            {showCategoryTrend ? 'Tutup' : 'Tampilkan'}
          </Button>
        </CardHeader>

        {showCategoryTrend && (
          <CardContent className="space-y-5">
            {categoryTrendLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : allTrendCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Tidak ada data</p>
            ) : (
              <>
                {/* Category checkboxes */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Pilih kategori yang ditampilkan:</p>
                    <div className="flex gap-2">
                      <button
                        className="text-xs text-primary hover:underline"
                        onClick={() => setSelectedCatIds(new Set(allTrendCategories.map((c) => c.id)))}
                      >
                        Pilih Semua
                      </button>
                      <span className="text-muted-foreground text-xs">·</span>
                      <button
                        className="text-xs text-muted-foreground hover:underline"
                        onClick={() => setSelectedCatIds(new Set())}
                      >
                        Hapus Semua
                      </button>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {allTrendCategories.map((cat, idx) => {
                      const checked = selectedCatIds.has(cat.id)
                      const color = CAT_TREND_COLORS[idx % CAT_TREND_COLORS.length]
                      return (
                        <button
                          key={cat.id}
                          onClick={() => {
                            setSelectedCatIds((prev) => {
                              const next = new Set(prev)
                              if (next.has(cat.id)) next.delete(cat.id)
                              else next.add(cat.id)
                              return next
                            })
                          }}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all ${
                            checked
                              ? 'border-transparent text-white'
                              : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground'
                          }`}
                          style={checked ? { background: color } : undefined}
                        >
                          <span
                            className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ background: color, opacity: checked ? 0.5 : 1 }}
                          />
                          {cat.name}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {activeCategories.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-6">Pilih minimal 1 kategori</p>
                ) : (
                  <>
                    <ResponsiveContainer width="100%" height={260}>
                      <LineChart data={categoryTrendChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="currentColor" opacity={0.06} />
                        <XAxis dataKey="month" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                        <YAxis tickFormatter={formatShort} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                        <Tooltip formatter={(v) => formatRupiah(Number(v))} contentStyle={{ fontSize: 12 }} />
                        <Legend wrapperStyle={{ fontSize: 11 }} />
                        {activeCategories.map((cat) => {
                          const idx = allTrendCategories.findIndex((c) => c.id === cat.id)
                          return (
                            <Line
                              key={cat.id}
                              type="monotone"
                              dataKey={cat.id}
                              name={cat.name}
                              stroke={CAT_TREND_COLORS[idx % CAT_TREND_COLORS.length]}
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              activeDot={{ r: 6 }}
                            />
                          )
                        })}
                      </LineChart>
                    </ResponsiveContainer>

                    {/* Delta table */}
                    <div className="overflow-x-auto rounded-lg border">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b bg-muted/40">
                            <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Kategori</th>
                            {categoryTrendMonths.map(({ label }) => (
                              <th key={label} className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">{label}</th>
                            ))}
                            <th className="px-4 py-2.5 text-right text-xs font-medium text-muted-foreground">Δ vs 2 Bln Lalu</th>
                          </tr>
                        </thead>
                        <tbody>
                          {activeCategories.map((cat) => {
                            const idx = allTrendCategories.findIndex((c) => c.id === cat.id)
                            const color = CAT_TREND_COLORS[idx % CAT_TREND_COLORS.length]
                            const vals = categoryTrendMonths.map((_, mi) => {
                              const entry = categoryTrendChartData[mi]
                              return entry ? (entry[cat.id] as number ?? 0) : 0
                            })
                            const delta = vals[2] - vals[0]
                            const deltaPct = vals[0] !== 0 ? (delta / vals[0]) * 100 : 0
                            const isUp = delta > 0
                            const isExpense = breakdownType === 'expense'
                            const deltaColor = Math.abs(deltaPct) < 1 ? 'text-muted-foreground'
                              : (isExpense ? (isUp ? 'text-red-500' : 'text-green-600')
                                : (isUp ? 'text-green-600' : 'text-red-500'))
                            return (
                              <tr key={cat.id} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                                <td className="px-4 py-2.5 text-xs font-medium">
                                  <span className="flex items-center gap-1.5">
                                    <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
                                    {cat.name}
                                  </span>
                                </td>
                                {vals.map((v, mi) => (
                                  <td key={mi} className="px-4 py-2.5 text-right text-xs tabular-nums">
                                    {v > 0 ? formatRupiah(v) : <span className="text-muted-foreground">—</span>}
                                  </td>
                                ))}
                                <td className={`px-4 py-2.5 text-right text-xs font-semibold tabular-nums ${deltaColor}`}>
                                  {Math.abs(deltaPct) < 1 ? '→ stabil'
                                    : `${isUp ? '▲' : '▼'} ${Math.abs(deltaPct).toFixed(0)}%`}
                                </td>
                              </tr>
                            )
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Grafik Pengeluaran Harian ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <BarChart2 size={16} className="text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">
              Arus Kas Harian — {monthNames[month - 1]} {year}
            </CardTitle>
          </div>
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
                  <XAxis
                    dataKey="day"
                    tick={{ fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    interval={dailyData.length > 20 ? 4 : 1}
                  />
                  <YAxis tickFormatter={formatShort} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                  <Tooltip
                    formatter={(v, name) => [formatRupiah(Number(v)), name]}
                    labelFormatter={(l) => `Tgl ${l}`}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Area type="monotone" dataKey="Pemasukan" stroke="#10b981" strokeWidth={2} fill="url(#gradIncome)" dot={false} activeDot={{ r: 4 }} />
                  <Area type="monotone" dataKey="Pengeluaran" stroke="#ef4444" strokeWidth={2} fill="url(#gradExpense)" dot={false} activeDot={{ r: 4 }} />
                </AreaChart>
              </ResponsiveContainer>

              {/* Peak days */}
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

      {/* ── Weekly Breakdown Section ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <CalendarDays size={16} className="text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Perbandingan Mingguan — {monthNames[month - 1]} {year}</CardTitle>
          </div>
          <Button
            variant={showWeekly ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowWeekly((v) => !v)}
          >
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
                      {weeklyData.map((w) => {
                        const isDeficit = w.net < 0
                        return (
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
                            <td className={`px-4 py-2.5 text-right text-xs font-semibold tabular-nums ${isDeficit ? 'text-red-500' : 'text-green-600'}`}>
                              {w.net !== 0 ? formatRupiah(w.net) : <span className="text-muted-foreground font-normal">—</span>}
                            </td>
                            <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">{w.count}</td>
                          </tr>
                        )
                      })}
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
                          weeklyData.reduce((a, w) => a + w.net, 0) < 0 ? 'text-red-500' : 'text-green-600'
                        }`}>
                          {formatRupiah(weeklyData.reduce((a, w) => a + w.net, 0))}
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs text-muted-foreground">
                          {weeklyData.reduce((a, w) => a + w.count, 0)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {weeklyData.some((w) => w.expense > 0) && (
                  <div className="grid grid-cols-2 gap-3">
                    {(() => {
                      const withExp = weeklyData.filter((w) => w.expense > 0)
                      const worstExp = withExp.reduce((a, b) => a.expense > b.expense ? a : b)
                      const bestExp = withExp.reduce((a, b) => a.expense < b.expense ? a : b)
                      return (
                        <>
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
                        </>
                      )
                    })()}
                  </div>
                )}
              </>
            )}
          </CardContent>
        )}
      </Card>

      {/* ── Monthly Comparison Section ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <GitCompare size={16} className="text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">Komparasi Bulan</CardTitle>
          </div>
          <Button
            variant={showCompare ? 'default' : 'outline'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowCompare((v) => !v)}
          >
            {showCompare ? 'Tutup' : 'Bandingkan'}
          </Button>
        </CardHeader>

        {showCompare && (
          <CardContent className="space-y-5">
            <div className="flex flex-wrap items-end gap-3">
              {compareSlots.map((slot, i) => (
                <div key={i} className="flex items-end gap-1.5">
                  <div className="flex items-center gap-1">
                    <span
                      className="inline-block w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ background: COMPARE_COLORS[i] }}
                    />
                    <span className="text-xs text-muted-foreground font-medium w-14">Bulan {i + 1}</span>
                  </div>
                  <Select value={String(slot.month)} onValueChange={(v) => updateSlot(i, 'month', Number(v))}>
                    <SelectTrigger className="h-8 w-24 text-xs">
                      <SelectValue>{monthNames[slot.month - 1]}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {monthNames.map((m, mi) => (
                        <SelectItem key={mi + 1} value={String(mi + 1)}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(slot.year)} onValueChange={(v) => updateSlot(i, 'year', Number(v))}>
                    <SelectTrigger className="h-8 w-20 text-xs">
                      <SelectValue>{slot.year}</SelectValue>
                    </SelectTrigger>
                    <SelectContent>
                      {years.map((y) => <SelectItem key={y} value={String(y)}>{y}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  {compareSlots.length > 2 && (
                    <button onClick={() => removeSlot(i)} className="text-muted-foreground hover:text-destructive transition-colors">
                      <X size={14} />
                    </button>
                  )}
                </div>
              ))}
              {compareSlots.length < 3 && (
                <Button variant="ghost" size="sm" className="h-8 text-xs gap-1" onClick={addSlot}>
                  <PlusCircle size={13} /> Tambah bulan
                </Button>
              )}
            </div>

            {compareLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : compareData.length === compareSlots.length ? (
              <>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={compareChartData} barCategoryGap="25%" barGap={4}>
                    <XAxis dataKey="metric" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                    <YAxis tickFormatter={formatShort} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={44} />
                    <Tooltip formatter={(v) => formatRupiah(Number(v))} contentStyle={{ fontSize: 12 }} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    {compareLabels.map((label, i) => (
                      <Bar key={label} dataKey={label} fill={COMPARE_COLORS[i]} radius={[3, 3, 0, 0]} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>

                <div className="overflow-x-auto rounded-lg border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/40">
                        <th className="px-4 py-2.5 text-left text-xs font-medium text-muted-foreground">Metrik</th>
                        {compareLabels.map((label, i) => (
                          <th key={i} className="px-4 py-2.5 text-right text-xs font-medium">
                            <span className="flex items-center justify-end gap-1.5">
                              <span className="inline-block w-2 h-2 rounded-full" style={{ background: COMPARE_COLORS[i] }} />
                              {label}
                            </span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {compareTableRows.map((row) => {
                        const numericVals = compareData.map((d) => {
                          if (!d) return null
                          if (row.label === 'Pemasukan') return d.income
                          if (row.label === 'Pengeluaran') return d.expense
                          if (row.label === 'Selisih Bersih') return d.balance
                          if (row.label === 'Rata-rata/Hari') return d.avg_daily_expense
                          return d.transaction_count
                        })
                        const defined = numericVals.filter((v) => v != null) as number[]
                        const bestIdx = row.highlight === 'none' || defined.length === 0 ? -1
                          : row.highlight === 'high'
                          ? numericVals.indexOf(Math.max(...defined))
                          : numericVals.indexOf(Math.min(...defined))
                        return (
                          <tr key={row.label} className="border-b last:border-0 hover:bg-muted/20 transition-colors">
                            <td className="px-4 py-2.5 text-xs text-muted-foreground font-medium">{row.label}</td>
                            {compareData.map((d, i) => {
                              const isBest = bestIdx === i
                              const val = d ? row.get(d) : '—'
                              const isNeg = d && row.label === 'Selisih Bersih' && d.balance < 0
                              return (
                                <td key={i} className={`px-4 py-2.5 text-right text-xs font-semibold tabular-nums ${
                                  isBest ? 'text-green-600' : isNeg ? 'text-red-500' : ''
                                }`}>
                                  {isBest && <span className="mr-1 text-green-500">✓</span>}
                                  {val}
                                </td>
                              )
                            })}
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>

                {compareData.length === 2 && compareData[0] && compareData[1] && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {[
                      { label: 'Pemasukan', a: compareData[0]!.income, b: compareData[1]!.income, better: 'up' },
                      { label: 'Pengeluaran', a: compareData[0]!.expense, b: compareData[1]!.expense, better: 'down' },
                      { label: 'Selisih', a: compareData[0]!.balance, b: compareData[1]!.balance, better: 'up' },
                      { label: 'Rata-rata/Hari', a: compareData[0]!.avg_daily_expense, b: compareData[1]!.avg_daily_expense, better: 'down' },
                    ].map(({ label, a, b, better }) => {
                      const pct = a !== 0 ? ((b - a) / Math.abs(a)) * 100 : 0
                      const improved = better === 'up' ? pct > 0 : pct < 0
                      const color = Math.abs(pct) < 1 ? 'text-muted-foreground' : improved ? 'text-green-600' : 'text-red-500'
                      const icon = Math.abs(pct) < 1 ? '→' : pct > 0 ? '↑' : '↓'
                      return (
                        <div key={label} className="rounded-lg border bg-muted/20 px-3 py-2">
                          <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
                          <p className={`text-sm font-bold ${color}`}>
                            {icon} {Math.abs(pct).toFixed(1)}%
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {compareLabels[0]} → {compareLabels[1]}
                          </p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center py-8">Pilih bulan dan klik Bandingkan</p>
            )}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
