import type { Library, TableColumnId } from '../hooks/useLibrary'
import type { TableKey } from '../lib/sorting'
import { practicedText } from '../lib/dates'
import { InstrumentIcons, PieceActions, PieceTitle, PracticeButton, StatusPill, TagList } from './PieceParts'
import { Rating } from './Rating'

type Column = {
  id: 'title' | TableColumnId
  label: string
  sortKey: TableKey | null
  dataLabel: string
  className?: string
}

const COLUMNS: Column[] = [
  { id: 'title', label: 'Title', sortKey: 'title', dataLabel: 'Title', className: 't-title' },
  { id: 'composer', label: 'Composer', sortKey: 'composer', dataLabel: 'Composer', className: 't-muted' },
  { id: 'instruments', label: 'Instruments', sortKey: null, dataLabel: 'Instruments' },
  { id: 'tags', label: 'Tags', sortKey: null, dataLabel: 'Tags' },
  { id: 'status', label: 'Status', sortKey: 'status', dataLabel: 'Status' },
  { id: 'difficulty', label: 'Difficulty', sortKey: 'difficulty', dataLabel: 'Difficulty' },
  { id: 'rating', label: 'Rating', sortKey: 'rating', dataLabel: 'Rating', className: 'stars' },
  { id: 'pages', label: 'Pages', sortKey: 'pages', dataLabel: 'Pages', className: 't-muted' },
  { id: 'practiced', label: 'Practiced', sortKey: 'practiced', dataLabel: 'Practiced', className: 't-muted' },
]

const TOGGLE_LABELS: Record<TableColumnId, string> = {
  composer: 'Composer',
  instruments: 'Instruments',
  tags: 'Tags',
  status: 'Status',
  difficulty: 'Difficulty',
  rating: 'Rating',
  pages: 'Pages',
  practiced: 'Practiced',
}

export function TableView({ lib }: { lib: Library }) {
  const { tableSort, sortBy, tableRows, composerNameOf, update, tableCompact, setTableCompact, tableHiddenColumns, toggleTableColumn, resetTableColumns } = lib
  const hidden = new Set(tableHiddenColumns)
  const visibleColumns = COLUMNS.filter((c) => c.id === 'title' || !hidden.has(c.id))
  return (
    <div className="table-wrap">
      <div className="table-tools">
        <button type="button" className={`btn${tableCompact ? ' active' : ''}`} onClick={() => setTableCompact(!tableCompact)}>
          Compact rows
        </button>
        <div className="table-columns" role="group" aria-label="Toggle table columns">
          {(Object.keys(TOGGLE_LABELS) as TableColumnId[]).map((id) => {
            const visible = !hidden.has(id)
            return (
              <button key={id} type="button" className={`filter-pill${visible ? ' active' : ''}`} aria-pressed={visible} onClick={() => toggleTableColumn(id)}>
                {TOGGLE_LABELS[id]}
              </button>
            )
          })}
        </div>
        {tableHiddenColumns.length > 0 && <button type="button" className="link" onClick={resetTableColumns}>Reset columns</button>}
      </div>

      <table className={`piece-table${tableCompact ? ' compact' : ''}`}>
        <thead>
          <tr>
            {visibleColumns.map(({ id, sortKey, label }) => (
              <th key={id} className={sortKey ? undefined : 'no-sort'} aria-sort={sortKey && tableSort.key === sortKey ? (tableSort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                {sortKey ? (
                  <button type="button" className={tableSort.key === sortKey ? 'on' : ''} onClick={() => sortBy(sortKey)}>
                    {label}<span aria-hidden="true">{tableSort.key === sortKey ? (tableSort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
                  </button>
                ) : label}
              </th>
            ))}
            <th className="no-sort" />
          </tr>
        </thead>
        <tbody>
          {tableRows.map((p) => (
            <tr key={p.id}>
              {visibleColumns.map((column) => {
                switch (column.id) {
                  case 'title':
                    return <td key={column.id} className={column.className} data-label={column.dataLabel}><PieceTitle lib={lib} p={p} /></td>
                  case 'composer':
                    return <td key={column.id} className={column.className} data-label={column.dataLabel}>{composerNameOf(p.composer_id)}</td>
                  case 'instruments':
                    return <td key={column.id} className={column.className} data-label={column.dataLabel}><InstrumentIcons p={p} /></td>
                  case 'tags':
                    return <td key={column.id} className={column.className} data-label={column.dataLabel}><TagList lib={lib} p={p} /></td>
                  case 'status':
                    return <td key={column.id} className={column.className} data-label={column.dataLabel}><StatusPill lib={lib} p={p} /></td>
                  case 'difficulty':
                    return <td key={column.id} className={column.className} data-label={column.dataLabel}><Rating label="Difficulty" glyph="●" value={p.difficulty} onChange={(n) => update(p, { difficulty: n })} /></td>
                  case 'rating':
                    return <td key={column.id} className={column.className} data-label={column.dataLabel}><Rating label="Rating" glyph="★" value={p.rating} onChange={(n) => update(p, { rating: n })} /></td>
                  case 'pages':
                    return <td key={column.id} className={column.className} data-label={column.dataLabel}>{p.pdf_pages ?? '–'}</td>
                  case 'practiced':
                    return <td key={column.id} className={column.className} data-label={column.dataLabel}>{p.last_practiced ? practicedText(p.last_practiced) : '–'}</td>
                }
              })}
              <td className="t-actions" data-label="Actions"><PracticeButton lib={lib} p={p} /><PieceActions lib={lib} p={p} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
