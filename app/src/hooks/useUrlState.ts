import { useCallback, useSyncExternalStore } from 'react'
import type { Dispatch, SetStateAction } from 'react'

export const URL_STATE_CHANGE = 'sheet-music-url-change'

export function updateUrlState(key: string, value: string | null, push = false) {
  const url = new URL(window.location.href)
  if (value === null) url.searchParams.delete(key)
  else url.searchParams.set(key, value)
  if (url.href === window.location.href) return
  if (push) window.history.pushState(window.history.state, '', url)
  else window.history.replaceState(window.history.state, '', url)
  window.dispatchEvent(new Event(URL_STATE_CHANGE))
}

function subscribe(callback: () => void) {
  window.addEventListener('popstate', callback)
  window.addEventListener(URL_STATE_CHANGE, callback)
  return () => {
    window.removeEventListener('popstate', callback)
    window.removeEventListener(URL_STATE_CHANGE, callback)
  }
}

function useUrlValue<T extends string | null>(key: string, fallback: T, parse: (value: string | null) => T, format: (value: T) => string | null): [T, Dispatch<SetStateAction<T>>] {
  const search = useSyncExternalStore(subscribe, () => window.location.search, () => '')
  const value = parse(new URLSearchParams(search).get(key))
  const setValue: Dispatch<SetStateAction<T>> = useCallback((next) => {
    const current = parse(new URLSearchParams(window.location.search).get(key))
    updateUrlState(key, format(typeof next === 'function' ? next(current) : next))
  }, [key, parse, format])
  return [value ?? fallback, setValue]
}

const identity = (value: string) => value
const optional = (value: string | null) => value || null

export function useUrlString(key: string, fallback = '') {
  const parse = useCallback((value: string | null) => value ?? fallback, [fallback])
  return useUrlValue(key, fallback, parse, identity)
}

export function useUrlOptional(key: string) {
  return useUrlValue<string | null>(key, null, optional, optional)
}

export function useUrlEnum<T extends string>(key: string, fallback: T, allowed: readonly T[]) {
  return useUrlValue<T>(key, fallback, (value) => allowed.find((item) => item === value) ?? fallback, (value) => value)
}
