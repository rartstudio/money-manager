import { useEffect, useState } from 'react'
import {
  listAccounts,
  createAccount,
  updateAccount,
  setBalance,
  deleteAccount,
  type Account,
} from '@/api/accounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import PageHeader from '@/components/shared/PageHeader'
import IconPicker from '@/components/shared/IconPicker'
import { Plus, Pencil, Trash2, DollarSign } from 'lucide-react'
import { toast } from 'sonner'

const ACCOUNT_TYPES = [
  { value: 'bank', label: 'Bank' },
  { value: 'cash', label: 'Tunai' },
  { value: 'ewallet', label: 'Dompet Digital' },
  { value: 'investment', label: 'Investasi' },
  { value: 'other', label: 'Lainnya' },
]

const TYPE_EMOJI: Record<string, string> = {
  bank: '🏦', cash: '💵', ewallet: '📱', investment: '📈', other: '💳',
}
const TYPE_LABEL: Record<string, string> = {
  bank: 'Bank', cash: 'Tunai', ewallet: 'Dompet Digital', investment: 'Investasi', other: 'Lainnya',
}

const formatRupiah = (n: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)

const emptyForm = (): Partial<Account> => ({ name: '', type: 'bank', icon: '', color: '#6366f1' })

export default function AccountsPage() {
  const [items, setItems] = useState<Account[]>([])
  const [total, setTotal] = useState<number | null>(null)
  const [open, setOpen] = useState(false)
  const [balanceOpen, setBalanceOpen] = useState(false)
  const [editing, setEditing] = useState<Account | null>(null)
  const [form, setForm] = useState<Partial<Account>>(emptyForm())
  const [newBalance, setNewBalance] = useState('')
  const [deleteID, setDeleteID] = useState<string | null>(null)

  const load = () => {
    listAccounts()
      .then((r) => {
        const data = r.data.data ?? []
        setItems(data)
        setTotal(data.reduce((s, a) => s + a.balance, 0))
      })
      .catch(() => {})
  }

  useEffect(() => {
    load()
  }, [])

  const openCreate = () => {
    setEditing(null)
    setForm(emptyForm())
    setOpen(true)
  }
  const openEdit = (a: Account) => {
    setEditing(a)
    setForm({ name: a.name, type: a.type, icon: a.icon, color: a.color })
    setOpen(true)
  }
  const openBalance = (a: Account) => {
    setEditing(a)
    setNewBalance(String(a.balance))
    setBalanceOpen(true)
  }

  const handleSave = async () => {
    try {
      if (editing) {
        await updateAccount(editing.id, form)
        toast.success('Rekening diperbarui')
      } else {
        await createAccount(form)
        toast.success('Rekening ditambahkan')
      }
      setOpen(false)
      load()
    } catch {
      toast.error('Gagal menyimpan rekening')
    }
  }

  const handleSetBalance = async () => {
    if (!editing) return
    try {
      await setBalance(editing.id, Number(newBalance))
      toast.success('Saldo diperbarui')
      setBalanceOpen(false)
      load()
    } catch {
      toast.error('Gagal mengubah saldo')
    }
  }

  const handleDelete = async () => {
    if (!deleteID) return
    try {
      await deleteAccount(deleteID)
      toast.success('Rekening dihapus')
      setDeleteID(null)
      load()
    } catch {
      toast.error('Gagal menghapus rekening')
    }
  }

  return (
    <div>
      <PageHeader
        title="Rekening"
        description="Kelola rekening dan dompet"
        action={
          <Button size="sm" onClick={openCreate}>
            <Plus size={16} className="mr-1" /> Tambah
          </Button>
        }
      />

      {total !== null && (
        <Card className="mb-4">
          <CardContent className="pt-4">
            <p className="text-sm text-muted-foreground">Total Saldo Seluruh Rekening</p>
            <p className="text-2xl font-bold text-green-600">{formatRupiah(total)}</p>
          </CardContent>
        </Card>
      )}

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nama</TableHead>
            <TableHead>Tipe</TableHead>
            <TableHead>Saldo</TableHead>
            <TableHead className="text-right">Aksi</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {items.map((a) => (
            <TableRow key={a.id}>
              <TableCell>
                <div className="flex items-center gap-3">
                  <div
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-lg shrink-0"
                    style={{ background: `${a.color}22`, borderLeft: `3px solid ${a.color}` }}
                  >
                    {TYPE_EMOJI[a.type] ?? '💳'}
                  </div>
                  <span className="font-medium">{a.name}</span>
                </div>
              </TableCell>
              <TableCell>
                <Badge variant="outline" style={{ borderColor: a.color, color: a.color }}>
                  {TYPE_LABEL[a.type] ?? a.type}
                </Badge>
              </TableCell>
              <TableCell className={`font-semibold tabular-nums ${a.balance < 0 ? 'text-red-500' : ''}`}>
                {formatRupiah(a.balance)}
              </TableCell>
              <TableCell className="text-right">
                <Button
                  variant="ghost"
                  size="icon"
                  title="Ubah saldo"
                  onClick={() => openBalance(a)}
                >
                  <DollarSign size={14} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => openEdit(a)}>
                  <Pencil size={14} />
                </Button>
                <Button variant="ghost" size="icon" onClick={() => setDeleteID(a.id)}>
                  <Trash2 size={14} className="text-destructive" />
                </Button>
              </TableCell>
            </TableRow>
          ))}
          {items.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="text-center text-muted-foreground">
                Belum ada rekening
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>

      {/* Create / Edit */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? 'Edit Rekening' : 'Tambah Rekening'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Nama</Label>
              <Input
                value={form.name ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Tipe</Label>
              <Select
                value={form.type}
                onValueChange={(v) => setForm((f) => ({ ...f, type: v ?? undefined }))}
              >
                <SelectTrigger>
                  <SelectValue>
                    {ACCOUNT_TYPES.find((t) => t.value === form.type)?.label ?? 'Pilih tipe'}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>Icon</Label>
              <IconPicker
                value={form.icon ?? ''}
                onChange={(icon) => setForm((f) => ({ ...f, icon }))}
              />
            </div>
            <div className="space-y-1">
              <Label>Warna</Label>
              <div className="flex gap-2">
                <Input
                  type="color"
                  value={form.color ?? '#6366f1'}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                  className="h-9 w-14 p-1"
                />
                <Input
                  value={form.color ?? ''}
                  onChange={(e) => setForm((f) => ({ ...f, color: e.target.value }))}
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSave}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Set balance */}
      <Dialog open={balanceOpen} onOpenChange={setBalanceOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ubah Saldo — {editing?.name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-1">
            <Label>Saldo Baru (Rp)</Label>
            <Input
              type="number"
              value={newBalance}
              onChange={(e) => setNewBalance(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBalanceOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleSetBalance}>Simpan</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deleteID}
        title="Hapus Rekening"
        description="Rekening yang dihapus tidak dapat dikembalikan."
        onConfirm={handleDelete}
        onCancel={() => setDeleteID(null)}
      />
    </div>
  )
}
