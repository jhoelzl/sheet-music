import { useState } from 'react'
import type { Library } from '../hooks/useLibrary'
import { INSTRUMENTS } from '../lib/instruments'
import { FILTERS, SORTS, VIEWS } from '../lib/sorting'
import type { SortKey, View } from '../lib/sorting'

export function Toolbar({ lib }: { lib: Library }) {
  const [filtersOpen, setFiltersOpen] = useState(false)
  const { search, setSearch, view, setView, sort, setSort, filtering, clearFilters } = lib
  const { instrumentFilter, setInstrumentFilter, filter, setFilter, allTags, tagFilter, setTagFilter } = lib
  const activeFilters = Number(instrumentFilter !== 'all') + Number(filter !== 'all') + Number(tagFilter !== null)
  return (
    <>
      <div className="toolbar">
        <label className="search-field">
          <span aria-hidden="true">⌕</span>
          <input aria-label="Search pieces" placeholder="Search title, composer, notes…" value={search} onChange={(e) => setSearch(e.target.value)} />
          {search && <button type="button" className="search-clear" aria-label="Clear search" onClick={() => setSearch('')}>✕</button>}
        </label>
        <button type="button" className={`btn filter-toggle${activeFilters ? ' active' : ''}`} aria-expanded={filtersOpen} aria-controls="library-filters" onClick={() => setFiltersOpen(!filtersOpen)}>
          Filters{activeFilters > 0 && ` (${activeFilters})`}
        </button>
        {view !== 'table' && (
          <label className="sort-field">
            <span>Sort</span>
            <select aria-label="Sort pieces" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
              {SORTS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </label>
        )}
        <label className="sort-field">View
          <select aria-label="View" value={view} onChange={(e) => setView(e.target.value as View)}>
            {VIEWS.map((v) => <option key={v.value} value={v.value}>{v.label}</option>)}
          </select>
        </label>
        {filtering && <button type="button" className="link" onClick={clearFilters}>Clear filters</button>}
      </div>
      {filtersOpen && (
        <div className="library-filters" id="library-filters">
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
        </div>
      )}
    </>
  )
}
