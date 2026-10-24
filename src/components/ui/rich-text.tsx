import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Heading, Italic, Link2, List, ListOrdered } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(active && 'on')}
      // keep focus/selection in the editor while clicking the toolbar
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

function promptForLink(editor: Editor) {
  const prev = editor.getAttributes('link').href as string | undefined
  const url = window.prompt('Link URL', prev ?? 'https://')
  if (url === null) return
  if (!url.trim()) {
    editor.chain().focus().extendMarkRange('link').unsetLink().run()
    return
  }
  editor.chain().focus().extendMarkRange('link').setLink({ href: url.trim() }).run()
}

interface RichTextProps {
  /** Initial HTML (or plain text from older records). */
  defaultValue?: string | null
  /** Called on blur with the HTML, or null when empty. */
  onSave: (html: string | null) => void
  placeholder?: string
  ariaLabel?: string
  /** Shows "Saved · just now" in the toolbar after each save. */
  showSaved?: boolean
}

/** The design's editor: toolbar (.editor-bar) + body (.editor). Saves on blur. */
export function RichText({ defaultValue, onSave, placeholder = 'Write something…', ariaLabel = 'Description', showSaved }: RichTextProps) {
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const lastSaved = useRef(defaultValue ?? '')
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [3] }, codeBlock: false, blockquote: false, horizontalRule: false }),
      LinkExtension.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      Placeholder.configure({ placeholder }),
    ],
    content: defaultValue || '',
    editorProps: { attributes: { 'aria-label': ariaLabel } },
    onBlur: ({ editor }) => {
      const html = editor.isEmpty ? '' : editor.getHTML()
      if (html === lastSaved.current) return
      lastSaved.current = html
      onSave(html || null)
      setSavedAt(Date.now())
    },
  })

  // Re-render the "just now" label occasionally.
  const [, tick] = useState(0)
  useEffect(() => {
    if (!savedAt) return
    const t = setInterval(() => tick((n) => n + 1), 30000)
    return () => clearInterval(t)
  }, [savedAt])

  if (!editor) return null
  const run = (fn: (c: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) => fn(editor.chain().focus()).run()
  const ago = savedAt ? Math.floor((Date.now() - savedAt) / 60000) : null

  return (
    <div>
      <div className="editor-bar" role="toolbar" aria-label="Formatting">
        <ToolButton label="Bold" active={editor.isActive('bold')} onClick={() => run((c) => c.toggleBold())}>
          <Bold className="i i-sm" />
        </ToolButton>
        <ToolButton label="Italic" active={editor.isActive('italic')} onClick={() => run((c) => c.toggleItalic())}>
          <Italic className="i i-sm" />
        </ToolButton>
        <ToolButton label="Heading" active={editor.isActive('heading')} onClick={() => run((c) => c.toggleHeading({ level: 3 }))}>
          <Heading className="i i-sm" />
        </ToolButton>
        <span className="vr" />
        <ToolButton label="Bullet list" active={editor.isActive('bulletList')} onClick={() => run((c) => c.toggleBulletList())}>
          <List className="i i-sm" />
        </ToolButton>
        <ToolButton label="Numbered list" active={editor.isActive('orderedList')} onClick={() => run((c) => c.toggleOrderedList())}>
          <ListOrdered className="i i-sm" />
        </ToolButton>
        <ToolButton label="Link" active={editor.isActive('link')} onClick={() => promptForLink(editor)}>
          <Link2 className="i i-sm" />
        </ToolButton>
        {showSaved && savedAt && (
          <span className="ml-auto xs faint" style={{ paddingRight: 8 }}>
            Saved · {ago === 0 ? 'just now' : `${ago} min ago`}
          </span>
        )}
      </div>
      <div className="editor" onClick={() => editor.commands.focus()}>
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}

/** Read-only render of stored description HTML (or legacy plain text). */
export function RichView({ html, className }: { html?: string | null; className?: string }) {
  if (!html) return null
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(html)
  if (!isHtml) return <p className={cn('rich', className)} style={{ whiteSpace: 'pre-wrap' }}>{html}</p>
  return <div className={cn('rich', className)} dangerouslySetInnerHTML={{ __html: sanitize(html) }} />
}

/** Minimal sanitizer for our own editor output: strips scripts, event handlers and js: urls. */
function sanitize(html: string) {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc.querySelectorAll('script,style,iframe,object,embed').forEach((n) => n.remove())
  doc.querySelectorAll('*').forEach((el) => {
    for (const attr of [...el.attributes]) {
      if (attr.name.startsWith('on')) el.removeAttribute(attr.name)
      if ((attr.name === 'href' || attr.name === 'src') && /^\s*javascript:/i.test(attr.value)) el.removeAttribute(attr.name)
    }
    if (el.tagName === 'A') {
      el.setAttribute('target', '_blank')
      el.setAttribute('rel', 'noreferrer')
    }
  })
  return doc.body.innerHTML
}
