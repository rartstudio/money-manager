import { useEffect, useMemo, useState } from 'react'
import { getDashboard, getCategoryBreakdown, getMonthlyTrend, getMonthlySummary } from '@/api/reports'
import { listAccounts, type Account } from '@/api/accounts'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import PageHeader from '@/components/shared/PageHeader'
import { TrendingUp, TrendingDown, Wallet, ArrowLeftRight, AlertTriangle, ArrowRight, GitCompare, PlusCircle, X, LineChart as LineChartIcon } from 'lucide-react'
import { Link } from 'react-router-dom'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
  LineChart, Line, CartesianGrid,
} from 'recharts'

interface CategoryInfo { id: string; name: string; icon: string; color: string }
interface RecentTransaction { id: string; type: string; amount: number; description: string; date: string; category: CategoryInfo }
interface BudgetAlert { category_name: string; budget_amount: number; spent: number; percentage: number }
interface TopCategory { category_name: string; amount: number; percentage: number }
interface DashboardData {
  balance: number; income: number; expense: number
  recent_transactions: RecentTransaction[]
  budget_alerts: BudgetAlert[]
  top_expenses: TopCategory[]
}
interface CategoryBreakdown { category: CategoryInfo; amount: number; percentage: number }
interface TrendItem { month: string; income: number; expense: number }
interface Summary { income: number; expense: number; balance: number; transaction_count: number; avg_daily_expense: number }

const COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6','#f97316']
const CAT_TREND_COLORS = [
  '#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6',
  '#ec4899','#14b8a6','#f97316','#84cc16','#0ea5e9',
  '#a855f7','#d946ef','#06b6d4','#78716c','#64748b',
]
const monthNames = ['Jan','Feb','Mar','Apr','Mei','Jun','Jul','Agu','Sep','Okt','Nov','Des']
const ACCOUNT_TYPE_LABELS: Record<string, string> = {
  bank: 'Bank', cash: 'Tunai', ewallet: 'Dompet Digital', investment: 'Investasi', other: 'Lainnya',
}

function formatRupiah(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n)
}
function formatShort(n: number) {
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}M`
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}jt`
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(0)}rb`
  return String(n)
}
function monthOffset(month: number, year: number, offset: number) {
  let m = month + offset, y = year
  while (m <= 0) { m += 12; y-- }
  while (m > 12) { m -= 12; y++ }
  return { month: m, year: y }
}

export default function DashboardPage() {
  const now = new Date()
  const month = now.getMonth() + 1
  const year = now.getFullYear()

  // — Main data —
  const [data, setData] = useState<DashboardData | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])
  const [breakdown, setBreakdown] = useState<CategoryBreakdown[]>([])
  const [trend, setTrend] = useState<TrendItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      getDashboard(month, year),
      listAccounts(),
      getCategoryBreakdown('expense', month, year),
      getMonthlyTrend(),
    ])
      .then(([dash, accs, brkd, trnd]) => {
        setData(dash.data.data as DashboardData)
        setAccounts((accs.data.data ?? []) as Account[])
        setBreakdown((brkd.data.data ?? []) as CategoryBreakdown[])
        setTrend(((trnd.data.data ?? []) as TrendItem[]).slice(-6))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [month, year])

  // — Category trend —
  const [catTrendType, setCatTrendType] = useState<'expense' | 'income'>('expense')
  const [showCategoryTrend, setShowCategoryTrend] = useState(false)
  const [categoryTrendData, setCategoryTrendData] = useState<CategoryBreakdown[][]>([])
  const [categoryTrendLoading, setCategoryTrendLoading] = useState(false)
  const [selectedCatIds, setSelectedCatIds] = useState<Set<string>>(new Set())

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
      categoryTrendMonths.map(({ month: m, year: y }) => getCategoryBreakdown(catTrendType, m, y))
    )
      .then((results) => {
        const allData = results.map((r) => (r.data.data ?? []) as CategoryBreakdown[])
        setCategoryTrendData(allData)
        const allIds = new Set<string>()
        allData.forEach((md) => md.forEach((b: CategoryBreakdown) => allIds.add(b.category.id)))
        setSelectedCatIds(allIds)
      })
      .catch(() => {})
      .finally(() => setCategoryTrendLoading(false))
  }, [showCategoryTrend, catTrendType, categoryTrendMonths])

  const allTrendCategories = useMemo(() => {
    const seen = new Set<string>()
    const result: { id: string; name: string }[] = []
    ;[...categoryTrendData].reverse().forEach((md) => {
      md.forEach((b) => {
        if (!seen.has(b.category.id)) {
          seen.add(b.category.id)
          result.unshift({ id: b.category.id, name: `${b.category.icon} ${b.category.name}` })
        }
      })
    })
    return result
  }, [categoryTrendData])

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

  // — Monthly comparison —
  const prevM = month > 1 ? month - 1 : 12
  const prevY = month > 1 ? year : year - 1
  const [showCompare, setShowCompare] = useState(false)
  const [compareSlots, setCompareSlots] = useState([
    { month: prevM, year: prevY },
    { month, year },
  ])
  const [compareData, setCompareData] = useState<(Summary | null)[]>([])
  const [compareLoading, setCompareLoading] = useState(false)
  const COMPARE_COLORS = ['#6366f1', '#f59e0b', '#10b981']
  const years = [year - 1, year, year + 1]

  useEffect(() => {
    if (!showCompare) return
    setCompareLoading(true)
    Promise.all(compareSlots.map((s) => getMonthlySummary(s.month, s.year)))
      .then((results) => setCompareData(results.map((r) => r.data.data as Summary)))
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

  const updateSlot = (i: number, field: 'month' | 'year', val: number) =>
    setCompareSlots((prev) => prev.map((s, idx) => idx === i ? { ...s, [field]: val } : s))
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

  // — Derived —
  const totalBalance = accounts.reduce((s, a) => s + a.balance, 0)
  const netMonth = data ? data.income - data.expense : null
  const savingsRate = netMonth != null && data?.income && data.income > 0
    ? Math.round((netMonth / data.income) * 100) : null

  const trendData = trend.map((t) => ({
    name: monthNames[Number(t.month.split('-')[1]) - 1],
    Pemasukan: t.income,
    Pengeluaran: t.expense,
  }))
  const pieData = breakdown.slice(0, 6).map((b) => ({
    name: `${b.category.icon} ${b.category.name}`,
    value: b.amount,
    pct: b.percentage,
  }))
  const recentTxs = data?.recent_transactions ?? []
  const budgetAlerts = data?.budget_alerts ?? []

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description={`Ringkasan keuangan — ${monthNames[month - 1]} ${year}`} />

      {/* Summary cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Saldo</CardTitle>
            <Wallet size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-28" /> : (
              <p className="text-xl font-bold">{formatRupiah(totalBalance)}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pemasukan</CardTitle>
            <TrendingUp size={16} className="text-green-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-28" /> : (
              <p className="text-xl font-bold text-green-600">{data ? formatRupiah(data.income) : '-'}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Pengeluaran</CardTitle>
            <TrendingDown size={16} className="text-red-500" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-28" /> : (
              <p className="text-xl font-bold text-red-600">{data ? formatRupiah(data.expense) : '-'}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Selisih Bersih</CardTitle>
            <ArrowLeftRight size={16} className="text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {loading ? <Skeleton className="h-7 w-28" /> : (
              <p className={`text-xl font-bold ${netMonth != null && netMonth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {netMonth != null ? formatRupiah(netMonth) : '-'}
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Row 2: Recent transactions + Account balances + Savings rate */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-sm font-semibold">Transaksi Terakhir</CardTitle>
            <Link to="/transactions" className="flex items-center gap-1 text-xs text-primary hover:underline">
              Lihat semua <ArrowRight size={12} />
            </Link>
          </CardHeader>
          <CardContent className="space-y-3">
            {loading ? (
              [1,2,3].map(i => <Skeleton key={i} className="h-10 w-full" />)
            ) : recentTxs.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Belum ada transaksi</p>
            ) : recentTxs.slice(0, 5).map((tx) => (
              <div key={tx.id} className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <span className="text-base shrink-0">{tx.category?.icon ?? '💸'}</span>
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{tx.description || tx.category?.name}</p>
                    <p className="text-[10px] text-muted-foreground">{tx.date}</p>
                  </div>
                </div>
                <span className={`text-xs font-semibold shrink-0 ${tx.type === 'income' ? 'text-green-600' : 'text-red-500'}`}>
                  {tx.type === 'income' ? '+' : '-'}{formatRupiah(tx.amount)}
                </span>
              </div>
            ))}
          </CardContent>
        </Card>

        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-sm font-semibold">Saldo Rekening</CardTitle>
              <Link to="/accounts" className="flex items-center gap-1 text-xs text-primary hover:underline">
                Kelola <ArrowRight size={12} />
              </Link>
            </CardHeader>
            <CardContent className="space-y-2">
              {loading ? (
                [1,2].map(i => <Skeleton key={i} className="h-8 w-full" />)
              ) : accounts.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-2">Belum ada rekening</p>
              ) : accounts.map((acc) => (
                <div key={acc.id} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-base">{acc.icon}</span>
                    <div>
                      <p className="text-xs font-medium">{acc.name}</p>
                      <p className="text-[10px] text-muted-foreground">{ACCOUNT_TYPE_LABELS[acc.type] ?? acc.type}</p>
                    </div>
                  </div>
                  <span className="text-xs font-semibold tabular-nums">{formatRupiah(acc.balance)}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          {savingsRate != null && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold">Tingkat Tabungan Bulan Ini</CardTitle>
              </CardHeader>
              <CardContent>
                <p className={`text-2xl font-bold ${savingsRate >= 20 ? 'text-green-600' : savingsRate >= 0 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {savingsRate}%
                </p>
                <div className="mt-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={`h-full rounded-full ${savingsRate >= 20 ? 'bg-green-500' : savingsRate >= 0 ? 'bg-yellow-400' : 'bg-red-500'}`}
                    style={{ width: `${Math.min(Math.max(savingsRate, 0), 100)}%` }} />
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="lg:col-span-1">
          {budgetAlerts.length > 0 && (
            <Card className="border-yellow-300 dark:border-yellow-700">
              <CardHeader className="flex flex-row items-center gap-2 pb-3">
                <AlertTriangle size={16} className="text-yellow-500" />
                <CardTitle className="text-sm font-semibold text-yellow-600 dark:text-yellow-400">
                  Peringatan Anggaran
                </CardTitle>
                <Link to="/budgets" className="ml-auto flex items-center gap-1 text-xs text-primary hover:underline">
                  Kelola <ArrowRight size={12} />
                </Link>
              </CardHeader>
              <CardContent className="space-y-3">
                {budgetAlerts.map((alert) => (
                  <div key={alert.category_name}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="font-medium">{alert.category_name}</span>
                      <span className={alert.percentage >= 100 ? 'text-red-500 font-semibold' : 'text-yellow-600'}>
                        {formatRupiah(alert.spent)} / {formatRupiah(alert.budget_amount)}
                        {' '}({Math.round(alert.percentage)}%)
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${alert.percentage >= 100 ? 'bg-red-500' : 'bg-yellow-400'}`}
                        style={{ width: `${Math.min(alert.percentage, 100)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Row 3: Trend chart + Expense donut */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">Tren 6 Bulan Terakhir</CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-52 w-full" />
            ) : trendData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Belum ada data</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={trendData} barCategoryGap="30%">
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
                  <YAxis tickFormatter={formatShort} tick={{ fontSize: 10 }} axisLine={false} tickLine={false} width={40} />
                  <Tooltip formatter={(v) => formatRupiah(Number(v))} contentStyle={{ fontSize: 12 }} />
                  <Bar dataKey="Pemasukan" fill="#10b981" radius={[3, 3, 0, 0]} />
                  <Bar dataKey="Pengeluaran" fill="#ef4444" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Pengeluaran per Kategori — {monthNames[month - 1]}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-52 w-full" />
            ) : pieData.length === 0 ? (
              <p className="text-sm text-muted-foreground py-10 text-center">Belum ada pengeluaran</p>
            ) : (
              <ResponsiveContainer width="100%" height={200}>
                <PieChart>
                  <Pie data={pieData} cx="40%" cy="50%" innerRadius={52} outerRadius={80} dataKey="value" paddingAngle={2}>
                    {pieData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                  </Pie>
                  <Tooltip
                    formatter={(v, _n, p) => [`${formatRupiah(Number(v))} (${p.payload.pct}%)`, p.payload.name]}
                    contentStyle={{ fontSize: 12 }}
                  />
                  <Legend layout="vertical" align="right" verticalAlign="middle" iconType="circle" iconSize={8}
                    formatter={(v) => <span style={{ fontSize: 11 }}>{v}</span>} />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* ── Tren Per Kategori ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div className="flex items-center gap-2">
            <LineChartIcon size={16} className="text-muted-foreground" />
            <CardTitle className="text-sm font-semibold">
              Tren {catTrendType === 'expense' ? 'Pengeluaran' : 'Pemasukan'} Per Kategori — 3 Bulan Terakhir
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            <Select value={catTrendType} onValueChange={(v) => { setCatTrendType(v as 'expense' | 'income'); setCategoryTrendData([]) }}>
              <SelectTrigger className="h-7 w-32 text-xs">
                <SelectValue>{catTrendType === 'expense' ? 'Pengeluaran' : 'Pemasukan'}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="expense">Pengeluaran</SelectItem>
                <SelectItem value="income">Pemasukan</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant={showCategoryTrend ? 'default' : 'outline'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setShowCategoryTrend((v) => !v)}
            >
              {showCategoryTrend ? 'Tutup' : 'Tampilkan'}
            </Button>
          </div>
        </CardHeader>

        {showCategoryTrend && (
          <CardContent className="space-y-5">
            {categoryTrendLoading ? (
              <Skeleton className="h-56 w-full" />
            ) : allTrendCategories.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">Tidak ada data</p>
            ) : (
              <>
                {/* Category pill toggles */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-muted-foreground">Pilih kategori yang ditampilkan:</p>
                    <div className="flex gap-2">
                      <button className="text-xs text-primary hover:underline"
                        onClick={() => setSelectedCatIds(new Set(allTrendCategories.map((c) => c.id)))}>
                        Pilih Semua
                      </button>
                      <span className="text-muted-foreground text-xs">·</span>
                      <button className="text-xs text-muted-foreground hover:underline"
                        onClick={() => setSelectedCatIds(new Set())}>
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
                          onClick={() => setSelectedCatIds((prev) => {
                            const next = new Set(prev)
                            if (next.has(cat.id)) next.delete(cat.id); else next.add(cat.id)
                            return next
                          })}
                          className={`flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-all ${
                            checked ? 'border-transparent text-white' : 'border-border bg-transparent text-muted-foreground hover:border-muted-foreground'
                          }`}
                          style={checked ? { background: color } : undefined}
                        >
                          <span className="inline-block w-2 h-2 rounded-full shrink-0"
                            style={{ background: color, opacity: checked ? 0.5 : 1 }} />
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
                            <Line key={cat.id} type="monotone" dataKey={cat.id} name={cat.name}
                              stroke={CAT_TREND_COLORS[idx % CAT_TREND_COLORS.length]}
                              strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
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
                            const isExpense = catTrendType === 'expense'
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
                                  {Math.abs(deltaPct) < 1 ? '→ stabil' : `${isUp ? '▲' : '▼'} ${Math.abs(deltaPct).toFixed(0)}%`}
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

      {/* ── Komparasi Bulan ── */}
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
            {/* Slot pickers */}
            <div className="flex flex-wrap items-end gap-3">
              {compareSlots.map((slot, i) => (
                <div key={i} className="flex items-end gap-1.5">
                  <div className="flex items-center gap-1">
                    <span className="inline-block w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COMPARE_COLORS[i] }} />
                    <span className="text-xs text-muted-foreground font-medium w-14">Bulan {i + 1}</span>
                  </div>
                  <Select value={String(slot.month)} onValueChange={(v) => updateSlot(i, 'month', Number(v))}>
                    <SelectTrigger className="h-8 w-24 text-xs"><SelectValue>{monthNames[slot.month - 1]}</SelectValue></SelectTrigger>
                    <SelectContent>
                      {monthNames.map((m, mi) => <SelectItem key={mi + 1} value={String(mi + 1)}>{m}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <Select value={String(slot.year)} onValueChange={(v) => updateSlot(i, 'year', Number(v))}>
                    <SelectTrigger className="h-8 w-20 text-xs"><SelectValue>{slot.year}</SelectValue></SelectTrigger>
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
                          : row.highlight === 'high' ? numericVals.indexOf(Math.max(...defined))
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
                          <p className={`text-sm font-bold ${color}`}>{icon} {Math.abs(pct).toFixed(1)}%</p>
                          <p className="text-[10px] text-muted-foreground">{compareLabels[0]} → {compareLabels[1]}</p>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            ) : null}
          </CardContent>
        )}
      </Card>
    </div>
  )
}
