import { EditorContent, useEditor, type Editor } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import LinkExtension from '@tiptap/extension-link'
import Placeholder from '@tiptap/extension-placeholder'
import { Bold, Italic, Link2, List, ListOrdered, Strikethrough } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { cn } from '@/lib/utils'

function ToolButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      // preventDefault so the editor keeps focus/selection while clicking toolbar buttons
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cn(
        'grid size-7 cursor-pointer place-items-center rounded-md transition-colors duration-150',
        active
          ? 'bg-primary-soft text-primary'
          : 'text-muted-foreground hover:bg-surface-hover hover:text-foreground',
      )}
    >
      <Icon className="size-4" strokeWidth={1.75} aria-hidden />
    </button>
  )
}

/**
 * Runs a formatting command pinned to the exact selection visible when the button was
 * clicked. Needed because TipTap/ProseMirror can otherwise resolve `.focus()` against a
 * broader selection type (e.g. after a prior select-all) than what's actually highlighted,
 * which — for list toggles in particular — wraps far more content than intended
 * (see ueberdosis/tiptap#6260, #7398). Re-expressing the same range as a plain text
 * selection first sidesteps that path entirely.
 */
function runOnSelection(editor: Editor, apply: (chain: ReturnType<Editor['chain']>) => ReturnType<Editor['chain']>) {
  const { from, to } = editor.state.selection
  apply(editor.chain().focus().setTextSelection({ from, to })).run()
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

interface RichTextEditorProps {
  /** Initial HTML (or plain text from older records). */
  defaultValue?: string | null
  /** Called on blur with the HTML, or null when empty. */
  onSave: (html: string | null) => void
  placeholder?: string
  ariaLabel?: string
  className?: string
}

/**
 * Lightweight rich-text field (bold, italic, strike, lists, links) that saves on blur.
 * Grows with content; the scroll cap is set by the parent (e.g. max-h in ProjectDetail).
 */
export function RichTextEditor({
  defaultValue,
  onSave,
  placeholder = 'Write something…',
  ariaLabel = 'Rich text editor',
  className,
}: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: false,
        codeBlock: false,
        blockquote: false,
        horizontalRule: false,
      }),
      LinkExtension.configure({ openOnClick: false, autolink: true, defaultProtocol: 'https' }),
      Placeholder.configure({ placeholder }),
    ],
    content: defaultValue || '',
    editorProps: {
      attributes: {
        class: 'rich-text min-h-16 px-4 py-3 text-sm leading-relaxed focus:outline-none',
        'aria-label': ariaLabel,
      },
    },
    onBlur: ({ editor }) => onSave(editor.isEmpty ? null : editor.getHTML()),
  })

  if (!editor) return null

  return (
    <div
      className={cn(
        'rounded-xl border bg-surface transition-colors duration-150 focus-within:border-primary',
        className,
      )}
    >
      <div className="flex items-center gap-0.5 border-b px-2 py-1.5" role="toolbar" aria-label="Formatting">
        <ToolButton
          icon={Bold}
          label="Bold"
          active={editor.isActive('bold')}
          onClick={() => runOnSelection(editor, (c) => c.toggleBold())}
        />
        <ToolButton
          icon={Italic}
          label="Italic"
          active={editor.isActive('italic')}
          onClick={() => runOnSelection(editor, (c) => c.toggleItalic())}
        />
        <ToolButton
          icon={Strikethrough}
          label="Strikethrough"
          active={editor.isActive('strike')}
          onClick={() => runOnSelection(editor, (c) => c.toggleStrike())}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolButton
          icon={List}
          label="Bullet list"
          active={editor.isActive('bulletList')}
          onClick={() => runOnSelection(editor, (c) => c.toggleBulletList())}
        />
        <ToolButton
          icon={ListOrdered}
          label="Numbered list"
          active={editor.isActive('orderedList')}
          onClick={() => runOnSelection(editor, (c) => c.toggleOrderedList())}
        />
        <span className="mx-1 h-4 w-px bg-border" aria-hidden />
        <ToolButton
          icon={Link2}
          label="Add link"
          active={editor.isActive('link')}
          onClick={() => promptForLink(editor)}
        />
      </div>
      {/* Grows with content, scrolls past 40% of the viewport */}
      <div className="max-h-[40vh] overflow-y-auto">
        <EditorContent editor={editor} />
      </div>
    </div>
  )
}
