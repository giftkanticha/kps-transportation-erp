import type { ReactNode } from 'react'

export interface ResponsiveColumn<Row> {
  /** Stable key for the column */
  key: string
  /** Header text; also used as the mobile row label (via data-label) */
  label: string
  /** Extra className for the <td> (e.g. "num right") */
  className?: string
  /** Cell renderer. Receives the row and its index. */
  render: (row: Row, index: number) => ReactNode
  /** Hide this column's label on the stacked mobile card (e.g. an actions cell) */
  hideLabelOnMobile?: boolean
}

interface ResponsiveTableProps<Row> {
  columns: ResponsiveColumn<Row>[]
  rows: Row[]
  rowKey: (row: Row, index: number) => string | number
  onRowClick?: (row: Row, index: number) => void
  /** Optional custom card renderer for mobile; overrides the stacked default */
  mobileCard?: (row: Row, index: number) => ReactNode
  /** Message shown when rows is empty */
  empty?: ReactNode
  className?: string
}

/**
 * A table that renders normally on desktop and, on narrow screens (≤640px),
 * turns each row into a stacked card. Cells carry data-label so the CSS
 * `.tbl.stack` variant can show "label: value" pairs — see index.css.
 *
 * If `mobileCard` is provided, that custom card is used on mobile instead of
 * the auto-stacked table.
 */
export function ResponsiveTable<Row>({
  columns,
  rows,
  rowKey,
  onRowClick,
  mobileCard,
  empty,
  className,
}: ResponsiveTableProps<Row>) {
  if (rows.length === 0 && empty != null) {
    return <div className="empty-state">{empty}</div>
  }

  const table = (
    <div className={`tbl-wrap${mobileCard ? ' only-desktop' : ''}`}>
      <table className={`tbl stack${className ? ` ${className}` : ''}`}>
        <thead>
          <tr>
            {columns.map(c => (
              <th key={c.key} className={c.className}>{c.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={rowKey(row, i)}
              onClick={onRowClick ? () => onRowClick(row, i) : undefined}
              style={onRowClick ? { cursor: 'pointer' } : undefined}
            >
              {columns.map(c => (
                <td
                  key={c.key}
                  className={c.className}
                  {...(c.hideLabelOnMobile ? {} : { 'data-label': c.label })}
                >
                  {c.render(row, i)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )

  if (!mobileCard) return table

  return (
    <>
      {table}
      <div className="only-mobile">
        {rows.map((row, i) => (
          <div
            key={rowKey(row, i)}
            onClick={onRowClick ? () => onRowClick(row, i) : undefined}
          >
            {mobileCard(row, i)}
          </div>
        ))}
      </div>
    </>
  )
}
