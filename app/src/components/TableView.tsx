import type { Library } from '../hooks/useLibrary'
import type { TableKey } from '../lib/sorting'
import { practicedText } from '../lib/dates'
import { InstrumentIcons, PieceActions, PieceTitle, PracticeButton, StatusPill, TagList } from './PieceParts'
import { Rating } from './Rating'

const COLUMNS: [TableKey | null, string][] = [
  ['title', 'Title'], ['composer', 'Composer'], [null, 'Instruments'], [null, 'Tags'], ['status', 'Status'],
  ['difficulty', 'Difficulty'], ['rating', 'Rating'], ['pages', 'Pages'], ['practiced', 'Practiced'],
]

export function TableView({ lib }: { lib: Library }) {
  const { tableSort, sortBy, tableRows, composerNameOf, update } = lib
  return (
    <div className="table-wrap">
      <table className="piece-table">
        <thead>
          <tr>
            {COLUMNS.map(([key, label]) => (
              <th key={label} className={key ? undefined : 'no-sort'} aria-sort={key && tableSort.key === key ? (tableSort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                {key ? (
                  <button type="button" className={tableSort.key === key ? 'on' : ''} onClick={() => sortBy(key)}>
                    {label}<span aria-hidden="true">{tableSort.key === key ? (tableSort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
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
              <td className="t-title" data-label="Title"><PieceTitle lib={lib} p={p} /></td>
              <td className="t-muted" data-label="Composer">{composerNameOf(p.composer_id)}</td>
              <td data-label="Instruments"><InstrumentIcons p={p} /></td>
              <td data-label="Tags"><TagList lib={lib} p={p} /></td>
              <td data-label="Status"><StatusPill lib={lib} p={p} /></td>
              <td data-label="Difficulty"><Rating label="Difficulty" glyph="●" value={p.difficulty} onChange={(n) => update(p, { difficulty: n })} /></td>
              <td className="stars" data-label="Rating"><Rating label="Rating" glyph="★" value={p.rating} onChange={(n) => update(p, { rating: n })} /></td>
              <td className="t-muted" data-label="Pages">{p.pdf_pages ?? '–'}</td>
              <td className="t-muted" data-label="Practiced">{p.last_practiced ? practicedText(p.last_practiced) : '–'}</td>
              <td className="t-actions" data-label="Actions"><PracticeButton lib={lib} p={p} /><PieceActions lib={lib} p={p} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
