import { useLibrary } from '../hooks/useLibrary'
import { AddForms } from './AddForms'
import { BoardView } from './BoardView'
import { GridView } from './GridView'
import { GroupedView } from './GroupedView'
import { PdfPreview } from './PdfPreview'
import { PracticeCalendar } from './PracticeCalendar'
import { TableView } from './TableView'
import { Toasts } from './Toasts'
import { Toolbar } from './Toolbar'

export function Library() {
  const lib = useLibrary()
  const { composers, pieces, logs, panel, setPanel, view, visible, flat, noMatches } = lib
  const instrumentCount = new Set(pieces.flatMap(p => p.instruments ?? [])).size
  return (
    <>
      <Toasts lib={lib} />
      <PdfPreview lib={lib} />

      <div className="library-intro">
        <div>
          <h2>Library</h2>
          <p>{composers.length} {composers.length === 1 ? 'composer' : 'composers'} · {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'} · {instrumentCount} {instrumentCount === 1 ? 'instrument' : 'instruments'}</p>
        </div>
        <div className="intro-actions">
          <button className={`btn${panel === 'composer' ? ' active' : ''}`} onClick={() => setPanel(panel === 'composer' ? null : 'composer')}>+ Composer</button>
          <button className="btn primary" onClick={() => setPanel(panel === 'piece' ? null : 'piece')} disabled={!composers.length} title={composers.length ? '' : 'Add a composer first'}>+ Piece</button>
        </div>
      </div>

      <PracticeCalendar logs={logs} pieces={pieces} composers={composers} />

      <AddForms lib={lib} />
      <Toolbar lib={lib} />

      {!composers.length && <div className="empty"><h3>No music yet</h3><p>Add your first composer to start building your library.</p></div>}
      {view !== 'grouped' && noMatches && <div className="empty"><h3>No pieces found</h3><p>Try clearing the filters or add a piece.</p></div>}

      {view === 'table' && visible.length > 0 && <TableView lib={lib} />}
      {view === 'grid' && flat.length > 0 && <GridView lib={lib} />}
      {view === 'board' && visible.length > 0 && <BoardView lib={lib} />}
      {view === 'grouped' && <GroupedView lib={lib} />}
    </>
  )
}
