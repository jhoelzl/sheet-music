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
              <th key={label} aria-sort={key && tableSort.key === key ? (tableSort.dir === 1 ? 'ascending' : 'descending') : undefined}>
                {key ? (
                  <button type="button" className={tableSort.key === key ? 'on' : ''} onClick={() => sortBy(key)}>
                    {label}<span aria-hidden="true">{tableSort.key === key ? (tableSort.dir === 1 ? ' ▲' : ' ▼') : ''}</span>
                  </button>
                ) : label}
              </th>
            ))}
            <th />
          </tr>
        </thead>
        <tbody>
          {tableRows.map((p) => (
            <tr key={p.id}>
              <td className="t-title"><PieceTitle lib={lib} p={p} /></td>
              <td className="t-muted">{composerNameOf(p.composer_id)}</td>
              <td><InstrumentIcons p={p} /></td>
              <td><TagList lib={lib} p={p} /></td>
              <td><StatusPill lib={lib} p={p} /></td>
              <td><Rating label="Difficulty" glyph="●" value={p.difficulty} onChange={(n) => update(p, { difficulty: n })} /></td>
              <td className="stars"><Rating label="Rating" glyph="★" value={p.rating} onChange={(n) => update(p, { rating: n })} /></td>
              <td className="t-muted">{p.pdf_pages ?? '–'}</td>
              <td className="t-muted">{p.last_practiced ? practicedText(p.last_practiced) : '–'}</td>
              <td className="t-actions"><PracticeButton lib={lib} p={p} /><PieceActions lib={lib} p={p} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
