import { Link } from 'react-router-dom'
import { Check, CreditCard } from 'lucide-react'
import { useData } from '@/data/store'
import { Avatar } from '@/components/ui/avatar'
import { MentionText } from '@/components/ui/mentions'
import { profileDisplayName } from '@/lib/derive'
import { formatFeedAgo } from '@/lib/format'
import type { ActivityEvent } from '@/types'

/** One line of the activity feed: avatar, "Name did thing", optional comment preview. */
export function ActivityItem({ ev }: { ev: ActivityEvent }) {
  const { profiles, tasks, comments, payments } = useData()
  const actor = profiles.find((p) => p.id === ev.actor_id)
  const task = ev.entity === 'task' || ev.entity === 'comment' || ev.entity === 'subtask' ? tasks.find((t) => t.id === ev.entity_id) : undefined
  const comment = ev.entity === 'comment' ? comments.find((c) => c.id === ev.meta?.comment_id) : undefined
  const isMoney = ev.entity === 'payment'
  const link = task ? `/tasks/${task.id}` : ev.entity === 'project' ? `/projects/${ev.entity_id}` : ev.entity === 'client' ? `/clients/${ev.entity_id}` : isMoney && payments.some((p) => p.id === ev.entity_id) ? `/payments?p=${ev.entity_id}` : undefined

  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      {isMoney ? (
        <span className={`av sm ${ev.action === 'paid' ? 'ok' : 'gray'}`}>{ev.action === 'paid' ? <Check className="i i-xs" /> : <CreditCard className="i i-xs" />}</span>
      ) : (
        <Avatar profile={actor} size="sm" />
      )}
      <div className="small grow" style={{ lineHeight: 1.5, minWidth: 0 }}>
        <b className="m">{actor ? profileDisplayName(actor) : 'Someone'}</b>{' '}
        {link ? <Link className="link-hover" to={link} style={{ color: 'var(--ink2)' }}>{ev.message}</Link> : ev.message}
        {comment && (
          <div style={{ marginTop: 6, padding: '8px 10px', borderRadius: 8, background: 'var(--soft)', color: 'var(--ink3)' }}>
            <MentionText body={comment.body} />
          </div>
        )}
        <div className="faint xs" style={{ marginTop: 2 }}>{formatFeedAgo(ev.created_at)}</div>
      </div>
    </div>
  )
}
