interface Props {
  name: string
  count: number
  active?: boolean
  onClick: () => void
}

export default function CategoryCard({ name, count, active, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col justify-between p-4 rounded-2xl min-w-[130px] h-[90px] transition-all
        ${active
          ? 'bg-purple text-white shadow-lg shadow-purple/30'
          : 'bg-card2 text-muted hover:bg-card2/80'}`}
    >
      <span className="text-xs font-medium opacity-70">{count} tasks</span>
      <span className={`text-base font-semibold ${active ? 'text-white' : 'text-white/80'}`}>
        {name}
      </span>
    </button>
  )
}
