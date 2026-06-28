import { cn } from '@/lib/utils'

export interface IconGroup {
  label: string
  icons: string[]
}

export const ICON_GROUPS: IconGroup[] = [
  {
    label: 'Makanan & Minuman',
    icons: [
      '🍔','🍜','🍕','🍱','☕','🍣','🍦','🥗','🥤','🍺',
      '🥩','🍰','🍎','🥦','🧃','🫖','🍫','🍿','🍞','🍳',
      '🥚','🧆','🥘','🫕','🍛','🥟','🍙','🧋','🍷','🥐',
    ],
  },
  {
    label: 'Belanja & Fashion',
    icons: [
      '🛒','🛍️','👗','👠','💄','👟','🧢','👜','💎','🏷️',
      '🪭','🧣','🧤','👒','🕶️','⌚','💍','🥿','🧥','👔',
    ],
  },
  {
    label: 'Rumah & Tangga',
    icons: [
      '🏠','🛋️','🪴','🧹','🔧','🔑','📦','🏡','🛁','🪟',
      '🪑','🛏️','🧺','🚿','🧴','🪣','🔨','💡','🕯️','🧻',
    ],
  },
  {
    label: 'Transportasi',
    icons: [
      '🚗','🚌','✈️','🚢','🚲','🛵','🚕','🚃','⛽','🚁',
      '🛺','🚐','🚑','🚓','🏍️','⛵','🚂','🛻','🛤️','🅿️',
    ],
  },
  {
    label: 'Kesehatan & Olahraga',
    icons: [
      '💊','🏥','🏋️','🧘','🩺','🦷','🩹','💉','🧬','🫀',
      '🏃','🚴','⚽','🏀','🎾','🏊','🥊','🧗','🏇','🎿',
    ],
  },
  {
    label: 'Hiburan & Hobi',
    icons: [
      '🎬','🎮','🎵','🎭','🎪','🎲','📸','🎤','🎸','🎯',
      '🎨','🎻','🎹','🎳','🎰','🎡','🎢','🎠','🎟️','🃏',
    ],
  },
  {
    label: 'Pendidikan & Karier',
    icons: [
      '📚','🎓','💼','💻','📱','🖥️','📝','✏️','🔬','🏫',
      '📡','🖊️','📐','📏','🗂️','📋','🗒️','📓','📕','🔭',
    ],
  },
  {
    label: 'Keuangan',
    icons: [
      '💳','💰','💸','📈','🏦','📊','🪙','🧾','💹','🤑',
      '📄','🏧','💵','💴','💶','💷','🏧','📉','🤝','🪙',
    ],
  },
  {
    label: 'Rekening & Dompet',
    icons: [
      '🏦','💵','📱','📈','💳','🪙','💰','🏧','💹','💎',
      '🗃️','🔐','🔒','💼','📂','🗄️','🧮','🖩','⚖️','🔏',
    ],
  },
  {
    label: 'Keluarga & Sosial',
    icons: [
      '❤️','👶','🎁','🎉','🎂','🌹','🐾','🐕','🐈','🌱',
      '☀️','🌈','🎀','🙏','👪','💝','🌸','🦋','🎊','🌻',
    ],
  },
  {
    label: 'Utilitas & Lainnya',
    icons: [
      '⚡','💧','🌐','🔥','❄️','🌬️','♻️','🔔','📢','📡',
      '🛡️','⚙️','🔩','🧲','🪫','🔋','📺','📻','☎️','🖨️',
    ],
  },
]

export const ALL_ICONS = ICON_GROUPS.flatMap((g) => g.icons)

interface Props {
  value: string
  onChange: (icon: string) => void
  grouped?: boolean
}

export default function IconPicker({ value, onChange, grouped = true }: Props) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2 mb-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-lg border text-xl">
          {value || '?'}
        </span>
        <span className="text-sm text-muted-foreground">
          {value ? 'Terpilih' : 'Belum dipilih'}
        </span>
      </div>

      <div className="rounded-lg border p-2 max-h-52 overflow-y-auto space-y-2">
        {grouped
          ? ICON_GROUPS.map((group) => (
              <div key={group.label}>
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1 px-1">
                  {group.label}
                </p>
                <div className="grid grid-cols-10 gap-0.5">
                  {group.icons.map((icon) => (
                    <IconBtn key={icon} icon={icon} selected={value === icon} onClick={() => onChange(icon)} />
                  ))}
                </div>
              </div>
            ))
          : (
            <div className="grid grid-cols-10 gap-0.5">
              {ALL_ICONS.map((icon) => (
                <IconBtn key={icon} icon={icon} selected={value === icon} onClick={() => onChange(icon)} />
              ))}
            </div>
          )}
      </div>
    </div>
  )
}

function IconBtn({ icon, selected, onClick }: { icon: string; selected: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex h-8 w-8 items-center justify-center rounded text-lg hover:bg-accent transition-colors',
        selected && 'bg-primary/20 ring-1 ring-primary'
      )}
    >
      {icon}
    </button>
  )
}
