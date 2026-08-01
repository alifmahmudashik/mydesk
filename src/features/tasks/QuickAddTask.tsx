import { useState, type FormEvent } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useData } from '@/data/store'
import type { Task } from '@/types'

/** Inline task composer used inside the project panel — Enter to add, stays focused for the next one. */
export function QuickAddTask({ projectId }: { projectId: string }) {
  const createRow = useData((s) => s.createRow)
  const [title, setTitle] = useState('')

  function submit(e: FormEvent) {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    createRow<Task>(
      'tasks',
      { project_id: projectId, title: trimmed, status: 'todo', priority: 'medium' },
      { entity: 'task', action: 'created', message: `Added task "${trimmed}"` },
    )
    setTitle('')
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2">
      <Input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        aria-label="New task title"
      />
      <Button type="submit" variant="secondary" disabled={!title.trim()}>
        <Plus strokeWidth={1.75} />
        Add
      </Button>
    </form>
  )
}
