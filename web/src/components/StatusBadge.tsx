const labels = { open: 'Açık', completed: 'Tamamlandı', unassigned: 'Atanmamış', inactive: 'Pasif' } as const
export function StatusBadge({ status }: { status: keyof typeof labels }) {
  return <span className={`badge badge--${status}`}>{labels[status]}</span>
}
