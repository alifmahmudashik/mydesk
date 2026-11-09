import { EditorContent, useEditor, type Editor, ReactNodeViewRenderer, NodeViewWrapper, NodeViewContent, type ReactNodeViewProps } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import CodeBlock from '@tiptap/extension-code-block'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Check, Code2, Copy, Heading, Italic, Link2, List, ListOrdered, Sparkles } from 'lucide-react'
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

/** Custom CodeBlock node view with auto language detection, Beautify button, and Quick Copy button. */
function CodeBlockView({ node, editor, getPos, updateAttributes }: ReactNodeViewProps) {
  const [copied, setCopied] = useState(false)
  const [beautified, setBeautified] = useState(false)

  const text = node.textContent
  const detected = detectLanguage(text)
  const lang = (node.attrs.language as string) || (detected !== 'text' ? detected : 'code')

  const handleCopy = () => {
    if (!text) return
    void navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleBeautify = () => {
    if (!text.trim()) return
    const res = beautifyCode(text, node.attrs.language as string)
    const pos = typeof getPos === 'function' ? getPos() : null
    if (pos !== null) {
      const from = pos + 1
      const to = pos + node.nodeSize - 1
      const tr = editor.state.tr.replaceWith(from, to, editor.schema.text(res.code))
      editor.view.dispatch(tr)
      if (res.language && res.language !== 'text') {
        updateAttributes({ language: res.language })
      }
      setBeautified(true)
      setTimeout(() => setBeautified(false), 1500)
    }
  }

  return (
    <NodeViewWrapper className="code-block-wrapper">
      <div className="code-block-header" contentEditable={false}>
        <span className="code-block-lang">{lang.toUpperCase()}</span>
        <div className="code-block-actions">
          <button
            type="button"
            className="code-action-btn"
            onClick={handleBeautify}
            title="Auto-detect & beautify code (proper spacing & line breaks)"
          >
            <Sparkles className="i i-xs" />
            <span>{beautified ? 'Beautified!' : 'Beautify'}</span>
          </button>
          <button
            type="button"
            className="code-action-btn"
            onClick={handleCopy}
            title="Quick copy code to clipboard"
          >
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
        const { state } = view
        const { selection } = state
        const node = selection.$from.node()
        // If pasting directly inside an active codeBlock, auto-beautify the code on the fly!
        if (node && node.type.name === 'codeBlock') {
          const text = event.clipboardData?.getData('text/plain')
          if (text) {
            event.preventDefault()
            const { code: formatted } = beautifyCode(text)
            const tr = state.tr.replaceSelectionWith(state.schema.text(formatted))
            view.dispatch(tr)
            return true
          }
        }
        return false
      },
    },
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

  const toggleCodeBlock = () => {
    if (editor.isActive('codeBlock')) {
      editor.chain().focus().toggleCodeBlock().run()
    } else {
      // If text was selected when toggling into codeBlock, auto-beautify it
      const { from, to } = editor.state.selection
      const selectedText = editor.state.doc.textBetween(from, to, '\n')
      if (selectedText.trim()) {
        const { code: formatted, language } = beautifyCode(selectedText)
        editor
          .chain()
          .focus()
          .deleteRange({ from, to })
          .insertContent({
            type: 'codeBlock',
            attrs: { language },
            content: [{ type: 'text', text: formatted }],
          })
          .run()
      } else {
        editor.chain().focus().toggleCodeBlock().run()
      }
    }
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

/** Read-only render of stored description HTML (or legacy plain text). */
export function RichView({ html, className }: { html?: string | null; className?: string }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ref.current) return
    const pres = ref.current.querySelectorAll('pre')
    pres.forEach((pre) => {
      if (pre.dataset.enhanced) return
      pre.dataset.enhanced = 'true'

      const codeEl = pre.querySelector('code')
      const rawText = codeEl?.innerText || pre.innerText || ''
      if (!rawText.trim()) return

      // Auto-beautify stored code with proper line breaks and indentation
      const beautified = beautifyCode(rawText)
      if (codeEl) codeEl.innerText = beautified.code
      else pre.innerText = beautified.code

      const lang = beautified.language !== 'text' ? beautified.language : detectLanguage(beautified.code)

      const header = document.createElement('div')
      header.className = 'code-block-header'
      header.innerHTML = `
        <span class="code-block-lang">${(lang || 'code').toUpperCase()}</span>
        <div class="code-block-actions">
          <button type="button" class="code-action-btn copy-btn" title="Quick copy code">
            <svg class="i i-xs" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
            <span>Copy</span>
          </button>
        </div>
      `
      const copyBtn = header.querySelector('.copy-btn') as HTMLButtonElement | null
      copyBtn?.addEventListener('click', (e) => {
        e.stopPropagation()
        void navigator.clipboard.writeText(beautified.code)
        if (copyBtn) {
          copyBtn.innerHTML = `
            <svg class="i i-xs" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            <span>Copied!</span>
          `
        }
        setTimeout(() => {
          if (copyBtn) {
            copyBtn.innerHTML = `
              <svg class="i i-xs" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>
              <span>Copy</span>
            `
          }
        }, 2000)
      })

      pre.classList.add('code-block-pre')
      const wrapper = document.createElement('div')
      wrapper.className = 'code-block-wrapper'
      pre.parentNode?.insertBefore(wrapper, pre)
      wrapper.appendChild(header)
      wrapper.appendChild(pre)
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
