import { EditorContent, useEditor, type Editor, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type ReactNodeViewProps } from '@tiptap/react'
import type { EditorView } from '@tiptap/pm/view'
import StarterKit from '@tiptap/starter-kit'
import CodeBlock from '@tiptap/extension-code-block'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Check, Code2, Copy, Heading, Italic, Link2, List, ListOrdered } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { beautifyCode, detectLanguage } from '@/lib/codeBeautifier'

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

/** Beautifies every code block in one transaction (positions are mapped, so several blocks are safe). */
function beautifyCodeBlocks(view: EditorView, addToHistory = true) {
  const { state } = view
  const tr = state.tr
  state.doc.descendants((node, pos) => {
    if (node.type.name !== 'codeBlock') return true
    const text = node.textContent
    if (!text.trim()) return false
    const { code, language } = beautifyCode(text)
    const at = tr.mapping.map(pos)
    if (code !== text) tr.replaceWith(at + 1, at + 1 + node.content.size, state.schema.text(code))
    const lang = language === 'text' ? null : language
    if (node.attrs.language !== lang) tr.setNodeMarkup(at, undefined, { ...node.attrs, language: lang })
    return false
  })
  if (!tr.docChanged) return
  if (!addToHistory) tr.setMeta('addToHistory', false)
  view.dispatch(tr)
}

/** Code block with a detected-language label and a one-click Copy button. */
function CodeBlockView({ node }: ReactNodeViewProps) {
  const [copied, setCopied] = useState(false)
  const text = node.textContent
  const detected = detectLanguage(text)
  const lang = detected === 'text' ? 'code' : detected

  const handleCopy = () => {
    if (!text) return
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <NodeViewWrapper className="code-block-wrapper">
      <div className="code-block-header" contentEditable={false}>
        <span className="code-block-lang">{lang.toUpperCase()}</span>
        <div className="code-block-actions">
          <button type="button" className="code-action-btn" onClick={handleCopy} title="Copy code to clipboard">
            {copied ? <Check className="i i-xs" /> : <Copy className="i i-xs" />}
            <span>{copied ? 'Copied!' : 'Copy'}</span>
          </button>
        </div>
      </div>
      <pre>
        <NodeViewContent as="code" />
      </pre>
    </NodeViewWrapper>
  )
}

const CustomCodeBlock = CodeBlock.extend({
  addNodeView() {
    return ReactNodeViewRenderer(CodeBlockView)
  },
})

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
      StarterKit.configure({ heading: { levels: [3] }, blockquote: false, horizontalRule: false, codeBlock: false }),
      CustomCodeBlock.configure({ defaultLanguage: null }),
      LinkExtension.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      Placeholder.configure({ placeholder }),
    ],
    content: defaultValue || '',
    editorProps: {
      attributes: { 'aria-label': ariaLabel },
      handlePaste: (view, event) => {
        // Pasting into a code block: insert as plain text, then tidy the block.
        if (view.state.selection.$from.parent.type.name !== 'codeBlock') return false
        const text = event.clipboardData?.getData('text/plain')
        if (!text) return false
        event.preventDefault()
        view.dispatch(view.state.tr.insertText(text))
        beautifyCodeBlocks(view)
        return true
      },
    },
    // Tidy stored code on load without adding an undo step; it's saved on the next blur.
    onCreate: ({ editor }) => beautifyCodeBlocks(editor.view, false),
    onBlur: ({ editor }) => {
      beautifyCodeBlocks(editor.view)
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

  const toggleCodeBlock = () => {
    const { from, to } = editor.state.selection
    const selectedText = editor.state.doc.textBetween(from, to, '\n')
    if (editor.isActive('codeBlock') || !selectedText.trim()) {
      editor.chain().focus().toggleCodeBlock().run()
      return
    }
    // Turn the whole selection (even several paragraphs) into one code block.
    editor
      .chain()
      .focus()
      .deleteRange({ from, to })
      .insertContent({ type: 'codeBlock', content: [{ type: 'text', text: selectedText }] })
      .run()
    beautifyCodeBlocks(editor.view)
  }

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
        <ToolButton label="Code block" active={editor.isActive('codeBlock')} onClick={toggleCodeBlock}>
          <Code2 className="i i-sm" />
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

const ICON_ATTRS = 'class="i i-xs" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
const COPY_ICON = `<svg ${ICON_ATTRS}><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>`
const CHECK_ICON = `<svg ${ICON_ATTRS}><polyline points="20 6 9 17 4 12"/></svg>`

/** Read-only render of stored description HTML (or legacy plain text). */
export function RichView({ html, className }: { html?: string | null; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  // Give each stored code block the same tidy formatting, language label and Copy button as the editor.
  useEffect(() => {
    if (!ref.current) return
    ref.current.querySelectorAll('pre').forEach((pre) => {
      if (pre.dataset.enhanced) return
      pre.dataset.enhanced = 'true'

      const codeEl = pre.querySelector('code') ?? pre
      const rawText = codeEl.textContent ?? ''
      if (!rawText.trim()) return

      const { code, language } = beautifyCode(rawText)
      codeEl.textContent = code

      const label = document.createElement('span')
      label.className = 'code-block-lang'
      label.textContent = (language === 'text' ? 'code' : language).toUpperCase()

      const copyBtn = document.createElement('button')
      copyBtn.type = 'button'
      copyBtn.className = 'code-action-btn'
      copyBtn.title = 'Copy code to clipboard'
      copyBtn.innerHTML = `${COPY_ICON}<span>Copy</span>`
      copyBtn.addEventListener('click', (e) => {
        e.stopPropagation()
        void navigator.clipboard.writeText(code)
        copyBtn.innerHTML = `${CHECK_ICON}<span>Copied!</span>`
        setTimeout(() => (copyBtn.innerHTML = `${COPY_ICON}<span>Copy</span>`), 2000)
      })

      const actions = document.createElement('div')
      actions.className = 'code-block-actions'
      actions.append(copyBtn)
      const header = document.createElement('div')
      header.className = 'code-block-header'
      header.append(label, actions)

      pre.classList.add('code-block-pre')
      const wrapper = document.createElement('div')
      wrapper.className = 'code-block-wrapper'
      pre.before(wrapper)
      wrapper.append(header, pre)
    })
  }, [html])

  if (!html) return null
  const isHtml = /<\/?[a-z][\s\S]*>/i.test(html)
  if (!isHtml) return <p className={cn('rich', className)} style={{ whiteSpace: 'pre-wrap' }}>{html}</p>
  return <div ref={ref} className={cn('rich', className)} dangerouslySetInnerHTML={{ __html: sanitize(html) }} />
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
