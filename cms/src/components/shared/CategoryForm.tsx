import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import IconPicker from '@/components/shared/IconPicker'

export interface CategoryFormValue {
  name: string
  type: 'income' | 'expense'
  icon: string
}

interface Props {
  value: CategoryFormValue
  onChange: (v: CategoryFormValue) => void
  /** When set, hides the type selector and locks to this type */
  lockType?: 'income' | 'expense'
}

export default function CategoryForm({ value, onChange, lockType }: Props) {
  const set = (patch: Partial<CategoryFormValue>) => onChange({ ...value, ...patch })

  return (
    <div className="space-y-3">
      <div className="space-y-1">
        <Label>Nama</Label>
        <Input
          autoFocus
          value={value.name}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="Nama kategori"
        />
      </div>

      {lockType ? (
        <p className="text-xs text-muted-foreground">
          Tipe: <span className="font-medium">{lockType === 'income' ? 'Pemasukan' : 'Pengeluaran'}</span>
        </p>
      ) : (
        <div className="space-y-1">
          <Label>Tipe</Label>
          <Select
            value={value.type}
            onValueChange={(v) => set({ type: (v ?? 'expense') as 'income' | 'expense' })}
          >
            <SelectTrigger>
              <SelectValue>{value.type === 'income' ? 'Pemasukan' : 'Pengeluaran'}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="income">Pemasukan</SelectItem>
              <SelectItem value="expense">Pengeluaran</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="space-y-1">
        <Label>Icon</Label>
        <IconPicker value={value.icon} onChange={(icon) => set({ icon })} />
      </div>
    </div>
  )
}
