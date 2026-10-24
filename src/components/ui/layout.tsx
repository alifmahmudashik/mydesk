import { Fragment, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'

export interface Crumb {
  label: ReactNode
  to?: string
  icon?: ReactNode
}

/** Sticky top bar: breadcrumbs on the left, actions on the right. */
export function Topbar({ crumbs, children }: { crumbs: Crumb[]; children?: ReactNode }) {
  return (
    <div className="topbar">
      <nav className="crumbs" aria-label="Breadcrumb">
        {crumbs.map((c, i) => (
          <Fragment key={i}>
            {i > 0 && <span className="sep">/</span>}
            {c.to ? (
              <Link to={c.to}>
                {c.icon}
                {c.label}
              </Link>
            ) : i === crumbs.length - 1 ? (
              <b className="row-sm">
                {c.icon}
                {c.label}
              </b>
            ) : (
              <span className="row-sm">
                {c.icon}
                {c.label}
              </span>
            )}
          </Fragment>
        ))}
      </nav>
      <span className="spacer" />
      {children}
    </div>
  )
}

export function PageHead({ title, sub, eyebrow, children }: { title: ReactNode; sub?: ReactNode; eyebrow?: ReactNode; children?: ReactNode }) {
  return (
    <div className="ph">
      <div>
        {eyebrow && <div className="eyebrow">{eyebrow}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children}
    </div>
  )
}

export function Content({ children, width, className }: { children: ReactNode; width?: 'narrow' | 'full'; className?: string }) {
  return <div className={cn('content', width, className)}>{children}</div>
}

export function Empty({ icon, title, children, action, small }: { icon?: ReactNode; title: ReactNode; children?: ReactNode; action?: ReactNode; small?: boolean }) {
  return (
    <div className={cn('empty', small && 'sm')}>
      {icon && <div className="ico">{icon}</div>}
      <b>{title}</b>
      {children && <p>{children}</p>}
      {action && <div className="mt-8">{action}</div>}
    </div>
  )
}

export function Skeleton({ h = 16, w = '100%', className }: { h?: number; w?: number | string; className?: string }) {
  return <div className={cn('skel', className)} style={{ height: h, width: w }} />
}

/** Full-page loading placeholder in the shape of a typical page. */
export function PageSkeleton() {
  return (
    <>
      <div className="topbar">
        <Skeleton h={14} w={160} />
      </div>
      <div className="content">
        <Skeleton h={30} w={260} />
        <div className="kpis">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} h={96} />
          ))}
        </div>
        <Skeleton h={320} />
      </div>
    </>
  )
}

export function Card({ title, actions, children, footer, className, bodyClass, plain }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; footer?: ReactNode; className?: string; bodyClass?: string; plain?: boolean }) {
  return (
    <section className={cn('card', className)}>
      {(title || actions) && (
        <div className={cn('card-h', plain && 'plain')}>
          {typeof title === 'string' ? <h2 className="h2">{title}</h2> : title}
          {actions && <div className="row-sm">{actions}</div>}
        </div>
      )}
      {bodyClass === undefined ? children : <div className={bodyClass}>{children}</div>}
      {footer && <div className="card-f">{footer}</div>}
    </section>
  )
}

/** Settings-style section (.sec) with an anchor id for the side nav. */
export function Section({ id, title, desc, children, danger, className }: { id?: string; title: ReactNode; desc?: ReactNode; children: ReactNode; danger?: boolean; className?: string }) {
  return (
    <section id={id} className={cn('sec', danger && 'danger', className)}>
      <div className="sec-h">
        <h2>{title}</h2>
        {desc && <p>{desc}</p>}
      </div>
      <div className="sec-b">{children}</div>
    </section>
  )
}

/** Sticky save bar shown at the bottom of edit pages. */
export function SaveBar({ note, onCancel, onSave, saveLabel = 'Save changes', dirty = true }: { note?: ReactNode; onCancel?: () => void; onSave: () => void; saveLabel?: string; dirty?: boolean }) {
  return (
    <div className="savebar">
      <span className="note">{note}</span>
      {onCancel && (
        <button type="button" className="btn" onClick={onCancel}>
          Cancel
        </button>
      )}
      <button type="button" className="btn btn-pri" onClick={onSave} disabled={!dirty}>
        {saveLabel}
      </button>
    </div>
  )
}
