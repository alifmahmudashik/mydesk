import { useMemo, useState, type FormEvent } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { useData } from '@/data/store'
import { formatAgo } from '@/lib/format'
import { listItem } from '@/lib/motion'
import type { ProjectNote } from '@/types'

export function NoteRow({ note, context }: { note: ProjectNote; context?: string }) {
  return (
    <motion.li
      layout="position"
      variants={listItem}
      initial="initial"
      animate="animate"
      exit="exit"
      className="rounded-lg border bg-background px-3.5 py-2.5"
    >
      <p className="whitespace-pre-wrap text-[13px] leading-relaxed">{note.note}</p>
      <p className="mt-1.5 text-xs text-muted-foreground">
        {note.created_by ?? 'You'} · {formatAgo(note.created_at)}
        {context && <> · {context}</>}
      </p>
    </motion.li>
  )
}

/** Running notes thread for a project: newest first, composer on top. */
export function NotesThread({ projectId }: { projectId: string }) {
  const allNotes = useData((s) => s.notes)
  const notes = useMemo(
    () =>
      allNotes
        .filter((n) => n.project_id === projectId)
        .sort((a, b) => b.created_at.localeCompare(a.created_at)),
    [allNotes, projectId],
  )
  const createRow = useData((s) => s.createRow)
  const project = useData((s) => s.projects.find((p) => p.id === projectId))
  const [draft, setDraft] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = draft.trim()
    if (!trimmed) return
    createRow<ProjectNote>(
      'project_notes',
      { project_id: projectId, note: trimmed, created_by: 'You' },
      {
        entity: 'note',
        action: 'created',
        message: `Added a note to "${project?.title ?? 'project'}"`,
      },
    )
    setDraft('')
  }

  return (
    <div>
      <form onSubmit={submit} className="mb-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Write a note…"
          aria-label="New note"
          className="min-h-16 text-[13px]"
        />
        <div className="mt-2 flex justify-end">
          <Button type="submit" variant="secondary" size="sm" disabled={!draft.trim()}>
            Add note
          </Button>
        </div>
      </form>
      <ul className="space-y-2">
        <AnimatePresence initial={false}>
          {notes.map((n) => (
            <NoteRow key={n.id} note={n} />
          ))}
        </AnimatePresence>
      </ul>
      {notes.length === 0 && (
        <p className="text-[13px] text-muted-foreground">No notes yet — decisions and updates land here.</p>
      )}
    </div>
  )
}
