import { useState } from 'react'
import type { Library as LibraryState } from '../hooks/useLibrary'
import { todayISO } from '../lib/dates'
import { AddForms } from './AddForms'
import { BoardView } from './BoardView'
import { CompactPiece } from './CompactPiece'
import { GridView } from './GridView'
import { GroupedView } from './GroupedView'
import { PracticeCalendar } from './PracticeCalendar'
import { TableView } from './TableView'
import { Toolbar } from './Toolbar'

export function Library({ lib, isIOS = false }: { lib: LibraryState; isIOS?: boolean }) {
  const [showPractice, setShowPractice] = useState(false)
  const { composers, pieces, logs, panel, setPanel, view, visible, flat, noMatches } = lib
  const instrumentCount = new Set(pieces.flatMap(p => p.instruments ?? [])).size
  const todayCount = new Set(logs.filter(log => log.practiced_on === todayISO()).map(log => log.piece_id)).size
  return (
    <>
      <div className="library-intro">
        <div>
          <span className="library-kicker">Your music</span>
          <h2>Library</h2>
          <p>{composers.length} {composers.length === 1 ? 'composer' : 'composers'} · {pieces.length} {pieces.length === 1 ? 'piece' : 'pieces'} · {instrumentCount} {instrumentCount === 1 ? 'instrument' : 'instruments'}</p>
        </div>
        <div className="intro-actions">
          {!isIOS && <button className={`btn${panel === 'composer' ? ' active' : ''}`} onClick={() => setPanel(panel === 'composer' ? null : 'composer')}>+ Composer</button>}
          <button className="btn primary" onClick={() => setPanel(panel === 'piece' ? null : 'piece')} disabled={!composers.length} title={composers.length ? '' : 'Add a composer first'}>+ Piece</button>
        </div>
      </div>

      {(!isIOS || panel === 'piece') && <AddForms lib={lib} />}
      <section className="practice-summary" aria-label="Practice activity">
        <button type="button" className="practice-summary-toggle" aria-expanded={showPractice} aria-controls="practice-activity" onClick={() => setShowPractice(!showPractice)}>
          <span className="practice-summary-icon" aria-hidden="true">✦</span>
          <span className="practice-summary-copy"><strong>Your practice</strong><span>{todayCount} {todayCount === 1 ? 'piece' : 'pieces'} practiced today</span></span>
          <span className="practice-summary-action">{showPractice ? 'Hide activity' : 'View activity'} <span aria-hidden="true">{showPractice ? '↑' : '↓'}</span></span>
        </button>
        {showPractice && <div id="practice-activity"><PracticeCalendar logs={logs} pieces={pieces} composers={composers} /></div>}
      </section>
      <Toolbar lib={lib} />

      {!composers.length && <div className="empty"><h3>No music yet</h3><p>{isIOS ? 'Add your first composer in the Composers tab to start building your library.' : 'Add your first composer to start building your library.'}</p></div>}
      {(view !== 'grouped' || lib.filtering) && noMatches && <div className="empty"><h3>{lib.filtering ? 'No pieces found' : 'No pieces yet'}</h3><p>{lib.filtering ? 'Try clearing the filters or add a piece.' : 'Add a piece to start your collection.'}</p></div>}

      {visible.length > 0 && <div className="library-results-heading"><span>Your pieces</span><span>{visible.length} {visible.length === 1 ? 'piece' : 'pieces'}</span></div>}
      {view === 'list' && flat.length > 0 && <div className="focus-list">{flat.map(p => <CompactPiece key={p.id} lib={lib} p={p} />)}</div>}
      {view === 'table' && visible.length > 0 && <TableView lib={lib} />}
      {view === 'grid' && flat.length > 0 && <GridView lib={lib} />}
      {view === 'board' && visible.length > 0 && <BoardView lib={lib} />}
      {view === 'grouped' && <GroupedView lib={lib} />}
    </>
  )
}
