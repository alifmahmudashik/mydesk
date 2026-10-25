import type { ReactNode } from 'react'
import { addWeeks, parseISO, startOfWeek } from 'date-fns'
import { BookOpen, FileText, GraduationCap, Link2, Mic, Play, Wrench } from 'lucide-react'
import type { LearningItem, LearningKind, LearningLesson, LearningProgress, LearningTopic } from '@/types'


export const KINDS: { id: LearningKind; label: string; icon: ReactNode; color: string }[] = [
  { id: 'article', label: 'Article', icon: <FileText className="i i-sm" />, color: '#0284C7' },
  { id: 'video', label: 'Video', icon: <Play className="i i-sm" />, color: '#E11D48' },
  { id: 'course', label: 'Course', icon: <GraduationCap className="i i-sm" />, color: '#7C3AED' },
  { id: 'book', label: 'Book', icon: <BookOpen className="i i-sm" />, color: '#D97706' },
  { id: 'podcast', label: 'Podcast', icon: <Mic className="i i-sm" />, color: '#16A34A' },
  { id: 'tool', label: 'Tool', icon: <Wrench className="i i-sm" />, color: '#475569' },
  { id: 'other', label: 'Other', icon: <Link2 className="i i-sm" />, color: '#6B7280' },
]
export const kindMeta = (k: LearningKind) => KINDS.find((x) => x.id === k) ?? KINDS[KINDS.length - 1]

/** Guess the type from the link so sharing is one paste. */
export function detectKind(url: string): LearningKind | null {
  const u = url.toLowerCase()
  if (!u.trim()) return null
  if (/youtube\.com|youtu\.be|vimeo\.com|loom\.com|wistia/.test(u)) return 'video'
  if (/udemy\.|coursera\.|skillshop|academy|edx\.org|linkedin\.com\/learning|domestika|skillshare|\/course/.test(u)) return 'course'
  if (/spotify\.com\/(episode|show)|podcasts\.apple|podcast/.test(u)) return 'podcast'
  if (/goodreads|amazon\.[a-z.]+\/.*(dp|book)|books\.google/.test(u)) return 'book'
  if (/github\.com|chrome\.google\.com\/webstore|producthunt/.test(u)) return 'tool'
  return 'article'
}
export const hostOf = (url?: string | null) => {
  try {
    return url ? new URL(url.startsWith('http') ? url : `https://${url}`).hostname.replace(/^www\./, '') : ''
  } catch {
    return ''
  }
}
export const normUrl = (url: string) => (url.trim() && !/^https?:\/\//i.test(url.trim()) ? `https://${url.trim()}` : url.trim())
export const weekStart = (d = new Date()) => startOfWeek(d, { weekStartsOn: 1 })

/** Weeks in a row (ending this week, or last week if nothing yet this week) with at least one thing learned. */
export function streak(done: { completed_at?: string | null }[]) {
  const weeks = new Set(done.filter((i) => i.completed_at).map((i) => weekStart(parseISO(i.completed_at!)).getTime()))
  let w = weekStart()
  if (!weeks.has(w.getTime())) w = addWeeks(w, -1)
  let n = 0
  while (weeks.has(w.getTime())) {
    n++
    w = addWeeks(w, -1)
  }
  return n
}


/** Something someone finished: a single resource, or a lesson inside a topic. */
export interface LearnedEvent {
  id: string
  user_id: string
  title: string
  url?: string | null
  kind?: LearningKind
  takeaway?: string | null
  completed_at: string
  goal_id?: string | null
  /** Set for lessons: the topic it belongs to. */
  topic?: LearningTopic
}

/** Everything learned (resources + topic lessons), newest first. */
export function learnedEvents(items: LearningItem[], progress: LearningProgress[], lessons: LearningLesson[], topics: LearningTopic[]): LearnedEvent[] {
  const out: LearnedEvent[] = []
  for (const i of items) {
    if (i.status === 'done' && i.completed_at) out.push({ id: i.id, user_id: i.assignee_id, title: i.title, url: i.url, kind: i.kind, takeaway: i.takeaway, completed_at: i.completed_at, goal_id: i.goal_id })
  }
  for (const p of progress) {
    if (p.status !== 'done' || !p.completed_at) continue
    const lesson = lessons.find((l) => l.id === p.lesson_id)
    if (!lesson) continue
    out.push({ id: p.id, user_id: p.user_id, title: lesson.title, takeaway: p.takeaway, completed_at: p.completed_at, topic: topics.find((t) => t.id === lesson.topic_id) })
  }
  return out.sort((a, b) => b.completed_at.localeCompare(a.completed_at))
}

/** A person's progress through a topic. */
export function topicProgress(topicId: string, userId: string | undefined, lessons: LearningLesson[], progress: LearningProgress[]) {
  const ls = lessons.filter((l) => l.topic_id === topicId)
  const done = ls.filter((l) => progress.some((p) => p.lesson_id === l.id && p.user_id === userId && p.status === 'done')).length
  return { done, total: ls.length, pct: ls.length ? Math.round((done / ls.length) * 100) : 0 }
}

export const TOPIC_COLORS = ['#2563EB', '#7C3AED', '#0D9488', '#16A34A', '#D97706', '#E11D48', '#475569']
