import { useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { AtSign } from 'lucide-react'
import type { Profile } from '@/types'
import { Avatar } from '@/components/ui/avatar'
import { mentionIds, profileDisplayName, profileFullName, splitMentions } from '@/lib/derive'
import { cn } from '@/lib/utils'

/** Renders stored text with @[Name](id) tokens as highlighted mentions. */
export function MentionText({ body, className }: { body: string; className?: string }) {
  return (
    <p className={className} style={{ whiteSpace: 'pre-wrap' }}>
      {splitMentions(body).map((part, i) =>
        part.kind === 'text' ? (
          <span key={i}>{part.text}</span>
        ) : (
          <span key={i} className="mention">
            @{part.name}
          </span>
        ),
      )}
    </p>
  )
}

interface ComposerProps {
  people: Profile[]
  meId?: string
  /** Shown next to people in the picker, e.g. "assignee". */
  roleOf?: (p: Profile) => string | undefined
  placeholder?: string
  submitLabel?: string
  footnote?: ReactNode
  onSubmit: (body: string, mentions: string[]) => void
  autoFocus?: boolean
}

/**
 * Comment box with @mention autocomplete. Typing "@" opens the picker; picking a person
 * inserts an @[Name](id) token (shown as "@Name" while typing via a hidden map).
 */
export function Composer({ people, meId, roleOf, placeholder = 'Write a comment… use @ to mention', submitLabel = 'Comment', footnote, onSubmit, autoFocus }: ComposerProps) {
  const [text, setText] = useState('')
  const [query, setQuery] = useState<string | null>(null)
  const [sel, setSel] = useState(0)
  const ref = useRef<HTMLTextAreaElement>(null)
  // Display text uses "@Name"; this maps each inserted display name to its user id.
  const picked = useRef(new Map<string, string>())

  // Best match first: display-name prefix, then any name word starting with the query,
  // then substring. You can't mention yourself.
  const matches = useMemo(() => {
    if (query === null) return []
    const q = query.toLowerCase()
    const score = (p: Profile) => {
      const display = profileDisplayName(p).toLowerCase()
      const words = `${display} ${profileFullName(p).toLowerCase()}`.split(/\s+/)
      if (display.startsWith(q)) return 0
      if (words.some((w) => w.startsWith(q))) return 1
      if (words.some((w) => w.includes(q))) return 2
      return 3
    }
    return people
      .filter((p) => p.id !== meId)
      .map((p) => ({ p, s: score(p) }))
      .filter((x) => x.s < 3)
      .sort((a, b) => a.s - b.s)
      .slice(0, 6)
      .map((x) => x.p)
  }, [people, query, meId])

  // Caret position to restore right after React re-renders the new text.
  const pendingCaret = useRef<number | null>(null)
  useLayoutEffect(() => {
    if (pendingCaret.current === null || !ref.current) return
    ref.current.focus()
    ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current)
    pendingCaret.current = null
  }, [text])

  const onChange = (value: string) => {
    setText(value)
    const caret = ref.current?.selectionStart ?? value.length
    const before = value.slice(0, caret)
    const m = before.match(/(^|\s)@([\p{L}\p{N}._-]*)$/u)
    setQuery(m ? m[2] : null)
    setSel(0)
  }

  const insert = (p: Profile) => {
    const el = ref.current
    if (!el) return
    const caret = el.selectionStart ?? text.length
    const before = text.slice(0, caret).replace(/@([\p{L}\p{N}._-]*)$/u, '')
    const name = profileDisplayName(p)
    picked.current.set(name, p.id)
    pendingCaret.current = before.length + name.length + 2
    setText(`${before}@${name} ${text.slice(caret)}`)
    setQuery(null)
  }

  /** Converts "@Name" back into @[Name](id) tokens for storage. */
  const encode = (value: string) => {
    let out = value
    // Longest names first so "Anik Abdur" wins over "Anik".
    for (const [name, id] of [...picked.current].sort((a, b) => b[0].length - a[0].length)) {
      out = out.split(`@${name}`).join(`@[${name}](${id})`)
    }
    return out
  }

  const submit = () => {
    const raw = text.trim()
    if (!raw) return
    const body = encode(raw)
    onSubmit(body, mentionIds(body))
    setText('')
    picked.current.clear()
  }

  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (query !== null && matches.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setSel((s) => (s + 1) % matches.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setSel((s) => (s - 1 + matches.length) % matches.length)
        return
      }
      if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault()
        insert(matches[sel])
        return
      }
      if (e.key === 'Escape') {
        e.stopPropagation()
        setQuery(null)
        return
      }
    }
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault()
      submit()
    }
  }

  const me = people.find((p) => p.id === meId)

  return (
    <div className="row" style={{ alignItems: 'flex-start', gap: 10 }}>
      <Avatar profile={me} size="md" />
      <div className="grow stack-sm">
        <div className="composer">
          <div className={cn('mention-pop', query !== null && matches.length > 0 && 'open')} role="listbox">
            <div className="menu-title">Mention someone on this project</div>
            {matches.map((p, i) => (
              <button
                key={p.id}
                type="button"
                className={cn('mi', i === sel && 'sel')}
                onMouseDown={(e) => {
                  e.preventDefault()
                  insert(p)
                }}
              >
                <Avatar profile={p} size="xs" />
                <span className="grow trunc">{profileFullName(p)}</span>
                <span className="hint-r faint xs">{p.id === meId ? 'you' : roleOf?.(p) ?? p.role}</span>
              </button>
            ))}
          </div>
          <textarea
            ref={ref}
            value={text}
            autoFocus={autoFocus}
            placeholder={placeholder}
            onChange={(e) => onChange(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => setTimeout(() => setQuery(null), 120)}
            rows={2}
          />
          <div className="row between">
            <button
              type="button"
              className="btn btn-ghost btn-sm btn-icon"
              aria-label="Mention someone"
              onClick={() => {
                const next = `${text}${text && !text.endsWith(' ') ? ' ' : ''}@`
                pendingCaret.current = next.length
                setText(next)
                setQuery('')
              }}
            >
              <AtSign className="i i-sm" />
            </button>
            <div className="row-sm">
              {footnote && <span className="xs faint hide-sm">{footnote}</span>}
              <button type="button" className="btn btn-pri btn-sm" onClick={submit} disabled={!text.trim()}>
                {submitLabel} <kbd>Ctrl ↵</kbd>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
