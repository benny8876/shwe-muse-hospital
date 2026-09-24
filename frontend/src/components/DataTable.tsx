import type { ReactNode } from 'react'

export type Column<T> = {
  key: string
  label: string
  render?: (row: T) => ReactNode
  className?: string
}

type Props<T> = {
  columns: Column<T>[]
  rows: T[]
  emptyText?: string
  keyField?: keyof T | ((row: T, index: number) => string | number)
  onRowClick?: (row: T) => void
  isRowSelected?: (row: T) => boolean
  wrapperClassName?: string
  footer?: ReactNode
}

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  rows,
  emptyText = 'No records found.',
  keyField = 'id',
  onRowClick,
  isRowSelected,
  wrapperClassName = '',
  footer,
}: Props<T>) {
  const getKey = (row: T, index: number) => {
    if (typeof keyField === 'function') return keyField(row, index)
    const value = row[keyField as string]
    return value != null ? String(value) : index
  }

  return (
    <div className={`card overflow-auto p-0 ${wrapperClassName}`.trim()}>
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="sticky top-0 z-10 text-left" style={{ background: 'var(--brand-600)' }}>
            {columns.map((col) => (
              <th key={col.key} className={`px-3 py-2.5 font-semibold text-white text-xs uppercase tracking-wide ${col.className || ''}`}>{col.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-3 py-8 text-center text-slate-500">{emptyText}</td>
            </tr>
          ) : (
            rows.map((row, index) => (
              <tr
                key={getKey(row, index)}
                className={`border-b last:border-0 border-slate-200 ${onRowClick ? 'cursor-pointer' : ''} ${
                  isRowSelected?.(row)
                    ? 'bg-[var(--brand-50)] hover:bg-[var(--brand-50)]'
                    : index % 2 === 1
                      ? 'bg-slate-50/60 hover:bg-slate-100'
                      : 'hover:bg-slate-50'
                }`}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`px-3 py-2 align-top ${col.className || ''}`}>
                    {col.render ? col.render(row) : String(row[col.key] ?? '—')}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
        {footer && rows.length > 0 && (
          <tfoot>{footer}</tfoot>
        )}
      </table>
    </div>
  )
}
