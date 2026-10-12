import type { Library } from '../hooks/useLibrary'
import { INSTRUMENTS } from '../lib/instruments'
import { FILTERS, SORTS, VIEWS } from '../lib/sorting'
import type { SortKey } from '../lib/sorting'

export function Toolbar({ lib }: { lib: Library }) {
  const { search, setSearch, view, setView, sort, setSort, filtering, clearFilters } = lib
  const { instrumentFilter, setInstrumentFilter, filter, setFilter, allTags, tagFilter, setTagFilter } = lib
  return (
    <>
      <div className="toolbar">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search pieces" placeholder="Search title, composer, notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setSearch('')}>✕</button>}
        </label>
        {view !== 'table' && (
          <label className="sort-field">
            <span>Sort</span>
            <select aria-label="Sort pieces" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        <div className="view-switch" role="group" aria-label="View">
          {VIEWS.map((v) => (
            <button key={v.value} type="button" className={view === v.value ? 'on' : ''} aria-pressed={view === v.value} onClick={() => setView(v.value)}>{v.label}</button>
          ))}
        </div>
        {filtering && <button type="button" className="link" onClick={clearFilters}>Clear filters</button>}
      </div>

      <div className="filter-bar" role="group" aria-label="Filter by instrument">
        {([{ value: 'all', label: 'All instruments', icon: '' }, ...INSTRUMENTS] as const).map((i) => (
          <button key={i.value} type="button" className={`filter-pill${instrumentFilter === i.value ? ' active' : ''}`} aria-pressed={instrumentFilter === i.value} onClick={() => setInstrumentFilter(i.value)}>{i.icon && `${i.icon} `}{i.label}</button>
        ))}
      </div>

      <div className="filter-bar" role="group" aria-label="Filter pieces">
        {FILTERS.map((f) => (
          <button key={f.value} type="button" className={`filter-pill${filter === f.value ? ' active' : ''}`} aria-pressed={filter === f.value} onClick={() => setFilter(f.value)}>{f.label}</button>
        ))}
      </div>

      {allTags.length > 0 && (
        <div className="filter-bar" role="group" aria-label="Filter by tag">
          <button type="button" className={`filter-pill${tagFilter === null ? ' active' : ''}`} aria-pressed={tagFilter === null} onClick={() => setTagFilter(null)}>All tags</button>
          {allTags.map((t) => (
            <button key={t} type="button" className={`filter-pill${tagFilter === t ? ' active' : ''}`} aria-pressed={tagFilter === t} onClick={() => setTagFilter(tagFilter === t ? null : t)}>#{t}</button>
          ))}
        </div>
      )}
    </>
  )
}
