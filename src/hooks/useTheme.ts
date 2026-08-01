import { useCallback, useEffect, useState } from 'react'

const KEY = 'mydesk-theme'

export function useTheme() {
  const [dark, setDark] = useState(() => document.documentElement.classList.contains('dark'))

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
    document.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }, [dark])

  const toggle = useCallback(() => {
    setDark((d) => {
      localStorage.setItem(KEY, d ? 'light' : 'dark')
      return !d
    })
  }, [])

  return { dark, toggle }
}
