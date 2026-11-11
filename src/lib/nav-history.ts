import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

/** Recently visited in-app pages (path + query), newest last. */
const visited: string[] = []

/** Record each page the user lands on. Mount once, inside the router. */
export function useTrackNavHistory() {
  const { pathname, search } = useLocation()
  useEffect(() => {
    const path = pathname + search
    if (visited[visited.length - 1] !== path) visited.push(path)
    if (visited.length > 50) visited.shift()
  }, [pathname, search])
}

/**
 * The most recent page the user came from that `skip` doesn't reject,
 * e.g. the client page they opened a project from, ignoring the deleted project's own pages.
 */
export function previousPage(skip: (path: string) => boolean, fallback: string) {
  for (let i = visited.length - 1; i >= 0; i--) {
    if (!skip(visited[i])) return visited[i]
  }
  return fallback
}
