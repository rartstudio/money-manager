import { useState, useRef } from 'react'
import { batchCreateTransactions } from '@/api/transactions'
import type { Category } from '@/api/categories'
import type { Account } from '@/api/accounts'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { TransactionFormFields, defaultTxForm, type TxFormData } from '@/components/shared/TransactionFormFields'
import { Plus, Trash2, Copy, CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'

interface BulkRow { _id: string; data: TxFormData; error?: string }
interface Result { imported: number; failed: number; errors: { index: number; message: string }[] }

interface Props {
  open: boolean
  onClose: () => void
  categories: Category[]
  accounts: Account[]
  onImported: () => void
}

let counter = 0
const mkRow = (base?: Partial<TxFormData>): BulkRow => ({
  _id: String(++counter),
  data: { ...defaultTxForm(), ...base },
})

const TYPE_BORDER: Record<string, string> = {
  income: 'border-l-green-400',
  expense: 'border-l-red-400',
  transfer: 'border-l-blue-400',
}

export default function BulkTransactionDialog({ open, onClose, categories, accounts, onImported }: Props) {
  const [rows, setRows] = useState<BulkRow[]>(() => [mkRow(), mkRow(), mkRow()])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [result, setResult] = useState<Result | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  const toggleCollapse = (id: string) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })

  const collapseAll = () => setCollapsed(new Set(rows.map((r) => r._id)))
  const expandAll = () => setCollapsed(new Set())

  const updateRow = (id: string, data: TxFormData) =>
    setRows((prev) => prev.map((r) => r._id === id ? { ...r, data, error: undefined } : r))

  const addRow = (base?: Partial<TxFormData>) => {
    const r = mkRow(base)
    setRows((prev) => [...prev, r])
    setCollapsed((prev) => { const next = new Set(prev); prev.forEach((id) => next.add(id)); return next })
    setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)
  }

  const removeRow = (id: string) => {
    if (rows.length <= 1) return
    setRows((prev) => prev.filter((r) => r._id !== id))
    setCollapsed((prev) => { const next = new Set(prev); next.delete(id); return next })
  }

  const duplicateRow = (row: BulkRow) => {
    const idx = rows.findIndex((r) => r._id === row._id)
    const dup = mkRow(row.data)
    setRows((prev) => {
      const next = [...prev]
      next.splice(idx + 1, 0, dup)
      return next
    })
  }

  const validate = (): boolean => {
    let ok = true
    setRows((prev) => prev.map((r) => {
      if (!r.data.amount || r.data.amount <= 0) {
        ok = false
        return { ...r, error: 'Nominal harus > 0' }
      }
      if (r.data.type !== 'transfer' && !r.data.category_id) {
        ok = false
        return { ...r, error: 'Kategori wajib diisi' }
      }
      if (r.data.type === 'transfer' && !r.data.to_account_id) {
        ok = false
        return { ...r, error: 'Rekening tujuan wajib diisi' }
      }
      return { ...r, error: undefined }
    }))
    return ok
  }

  const handleSubmit = async () => {
    if (!validate()) return
    setSubmitting(true)
    const payload = rows.map((r) => ({
      type: r.data.type,
      date: r.data.date,
      amount: r.data.amount,
      description: r.data.description,
      category_id: r.data.category_id || undefined,
      account_id: r.data.account_id || undefined,
      to_account_id: r.data.to_account_id || undefined,
    }))
    try {
      const res = await batchCreateTransactions(payload)
      const data = res.data.data
      setResult(data)
      setRows((prev) => prev.map((r, i) => {
        const err = data.errors?.find((e) => e.index === i)
        return err ? { ...r, error: err.message } : r
      }))
      if (data.imported > 0) onImported()
      if (data.failed === 0) toast.success(`${data.imported} transaksi berhasil disimpan`)
      else toast.warning(`${data.imported} berhasil, ${data.failed} gagal`)
    } catch {
      toast.error('Gagal mengirim transaksi')
    } finally {
      setSubmitting(false)
    }
  }

  const handleClose = () => {
    setRows([mkRow(), mkRow(), mkRow()])
    setResult(null)
    onClose()
  }

  const filled = rows.filter((r) => r.data.amount > 0).length

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent
        className="flex flex-col p-0 max-h-[90vh]"
        style={{ width: '85vw', maxWidth: '85vw', minHeight: '65vh' }}
      >
        <DialogHeader className="px-6 pt-5 pb-3 border-b shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle>Input Transaksi Massal</DialogTitle>
            <div className="flex items-center gap-2 mr-6">
              <button onClick={expandAll} className="text-xs text-primary hover:underline">Buka Semua</button>
              <span className="text-muted-foreground text-xs">·</span>
              <button onClick={collapseAll} className="text-xs text-primary hover:underline">Ciutkan Semua</button>
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            {rows.length} baris · {filled} terisi nominal
          </p>
        </DialogHeader>

        {/* Result banner */}
        {result && (
          <div className={`mx-6 mt-3 shrink-0 rounded-lg border px-4 py-3 flex items-center gap-3 text-sm ${
            result.failed === 0
              ? 'bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800'
              : 'bg-yellow-50 dark:bg-yellow-950/20 border-yellow-200 dark:border-yellow-800'
          }`}>
            {result.failed === 0
              ? <CheckCircle2 size={16} className="text-green-600 shrink-0" />
              : <XCircle size={16} className="text-yellow-600 shrink-0" />}
            <span>
              <strong>{result.imported}</strong> transaksi berhasil
              {result.failed > 0 && <>, <strong className="text-red-600">{result.failed}</strong> gagal — lihat baris merah di bawah</>}
            </span>
          </div>
        )}

        {/* Scrollable rows */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-3">
          {rows.map((row, idx) => {
            const isCollapsed = collapsed.has(row._id)
            const d = row.data
            const cat = categories.find((c) => c.id === d.category_id)
            const acc = accounts.find((a) => a.id === d.account_id)
            const toAcc = accounts.find((a) => a.id === d.to_account_id)
            const TYPE_LABEL: Record<string, string> = { income: 'Pemasukan', expense: 'Pengeluaran', transfer: 'Transfer' }
            const TYPE_COLOR: Record<string, string> = { income: 'text-green-600', expense: 'text-red-500', transfer: 'text-blue-500' }
            const fmtDate = d.date
              ? new Date(d.date + 'T00:00:00').toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
              : '—'

            return (
              <div
                key={row._id}
                className={`rounded-lg border-l-4 border border-border bg-card shadow-sm ${TYPE_BORDER[row.data.type]} ${row.error ? 'ring-1 ring-red-400' : ''}`}
              >
                {/* Clickable header */}
                <div
                  className="flex items-center justify-between px-4 py-2.5 bg-muted/30 rounded-t-lg cursor-pointer select-none hover:bg-muted/50 transition-colors"
                  onClick={() => toggleCollapse(row._id)}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-wrap">
                    {isCollapsed
                      ? <ChevronRight size={14} className="text-muted-foreground shrink-0" />
                      : <ChevronDown size={14} className="text-muted-foreground shrink-0" />}
                    <span className="text-xs font-semibold text-muted-foreground shrink-0">#{idx + 1}</span>

                    {isCollapsed ? (
                      <>
                        {/* Date */}
                        <span className="text-xs text-muted-foreground shrink-0">{fmtDate}</span>
                        <span className="text-muted-foreground text-xs">·</span>

                        {/* Type */}
                        <span className={`text-xs font-medium shrink-0 ${TYPE_COLOR[d.type]}`}>
                          {TYPE_LABEL[d.type]}
                        </span>

                        {/* Category */}
                        {cat && (
                          <>
                            <span className="text-muted-foreground text-xs">·</span>
                            <span className="text-xs shrink-0">{cat.icon} {cat.name}</span>
                          </>
                        )}

                        {/* Account */}
                        {acc && (
                          <>
                            <span className="text-muted-foreground text-xs">·</span>
                            <span className="text-xs text-muted-foreground shrink-0">{acc.name}</span>
                          </>
                        )}

                        {/* Transfer arrow */}
                        {toAcc && (
                          <>
                            <span className="text-muted-foreground text-xs">→</span>
                            <span className="text-xs text-muted-foreground shrink-0">{toAcc.name}</span>
                          </>
                        )}

                        {/* Amount */}
                        {d.amount > 0 && (
                          <>
                            <span className="text-muted-foreground text-xs">·</span>
                            <span className={`text-xs font-semibold tabular-nums shrink-0 ${TYPE_COLOR[d.type]}`}>
                              Rp {d.amount.toLocaleString('id-ID')}
                            </span>
                          </>
                        )}

                        {/* Description */}
                        {d.description && (
                          <>
                            <span className="text-muted-foreground text-xs">·</span>
                            <span className="text-xs text-muted-foreground italic truncate max-w-[160px]">{d.description}</span>
                          </>
                        )}

                        {row.error && <span className="text-xs text-red-500 font-medium shrink-0">⚠ {row.error}</span>}
                      </>
                    ) : (
                      row.error && <span className="text-xs text-red-500 font-medium shrink-0">⚠ {row.error}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => duplicateRow(row)}
                      title="Duplikat"
                      className="p-1.5 rounded hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Copy size={13} />
                    </button>
                    <button
                      onClick={() => removeRow(row._id)}
                      title="Hapus"
                      className="p-1.5 rounded hover:bg-red-100 dark:hover:bg-red-900/30 text-muted-foreground hover:text-red-500 transition-colors"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>
                </div>

                {/* Collapsible body */}
                {!isCollapsed && (
                  <div className="px-4 py-3">
                    {row.error && (
                      <p className="mb-2 text-xs text-red-500 font-medium">{row.error}</p>
                    )}
                    <TransactionFormFields
                      value={row.data}
                      onChange={(data) => updateRow(row._id, data)}
                      categories={categories}
                      accounts={accounts}
                    />
                  </div>
                )}
              </div>
            )
          })}
          <div ref={bottomRef} />
        </div>

        <DialogFooter className="px-6 py-4 border-t shrink-0 flex items-center justify-between flex-row gap-3">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5"
            onClick={() => {
              const last = rows[rows.length - 1]
              addRow({ date: last.data.date, type: last.data.type, account_id: last.data.account_id })
            }}
          >
            <Plus size={13} /> Tambah Baris
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleClose} disabled={submitting}>Tutup</Button>
            <Button onClick={handleSubmit} disabled={submitting || filled === 0}>
              {submitting ? 'Menyimpan...' : `Simpan ${filled} Transaksi`}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
