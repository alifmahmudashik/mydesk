/**
 * Code block language detection and auto-beautification.
 *
 * This runs automatically (on paste, load and blur), so it must never change what code means.
 * Only JSON, JS-like code, CSS and HTML get re-indented. Everything else (Python, shell, SQL,
 * YAML, plain text) keeps its own indentation and only gets whitespace tidied.
 * Every formatter is idempotent: running it twice gives the same result as running it once.
 */

export type CodeLanguage = 'json' | 'html' | 'css' | 'sql' | 'python' | 'bash' | 'javascript' | 'text'

export function detectLanguage(code: string): CodeLanguage {
  const trimmed = code.trim()
  if (!trimmed) return 'text'

  if (/^[{[]/.test(trimmed) && /[}\]]$/.test(trimmed)) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // Probably a JS object literal; keep checking.
    }
  }

  if (/^<(!DOCTYPE|[a-zA-Z][a-zA-Z0-9-]*)(\s[^>]*)?\/?>/i.test(trimmed) || /<\/(div|p|span|a|ul|ol|li|table|tr|td|html|body|head|script|style|section|button)>/i.test(trimmed)) {
    return 'html'
  }

  if (/^\s*(SELECT|INSERT\s+INTO|UPDATE\s+\w+\s+SET|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|WITH\s+\w+\s+AS)\b/i.test(trimmed)) {
    return 'sql'
  }

  if (/^\s*(def\s+\w+\s*\(.*\)\s*(->.*)?:|class\s+\w+.*:|from\s+[\w.]+\s+import\s|import\s+\w+\s*$|if\s+__name__\s*==|(elif|for|while|with)\s.*:\s*$|else:\s*$|print\()/m.test(trimmed)) {
    return 'python'
  }

  if (/^[.#:@a-zA-Z0-9_\-\s,>*[\]="']+\{\s*[a-zA-Z-]+\s*:[^;{}]+;/m.test(trimmed) && !/\b(function|const|let|var|=>)\b/.test(trimmed)) {
    return 'css'
  }

  if (/^\s*(npm|pnpm|yarn|npx|bun|curl|wget|git|docker|sudo|apt|brew|echo|cd|ls|mkdir|rm|cp|mv|export|cat|chmod)\s/m.test(trimmed) || /^\s*\$\s+\S/m.test(trimmed) || /^#!\/bin\//.test(trimmed)) {
    return 'bash'
  }

  if (
    /dataLayer\.push|gtag\(|fbq\(|console\.\w+\(|\b(const|let|var)\s+[\w$]+|\bfunction\b|\bimport\s.*\bfrom\b|\bexport\s|=>|document\.|window\./.test(trimmed) ||
    /^[\w$.]+\s*\(.*[)({]\s*;?$/m.test(trimmed)
  ) {
    return 'javascript'
  }

  return 'text'
}

export function beautifyCode(rawCode: string): { code: string; language: CodeLanguage } {
  const language = detectLanguage(rawCode)
  if (!rawCode.trim()) return { code: rawCode, language }

  switch (language) {
    case 'json':
      try {
        return { code: JSON.stringify(JSON.parse(rawCode.trim()), null, 2), language }
      } catch {
        return { code: beautifyJs(rawCode), language }
      }
    case 'javascript':
      return { code: beautifyJs(rawCode), language }
    case 'css':
      return { code: beautifyCss(rawCode), language }
    case 'html':
      return { code: beautifyHtml(rawCode), language }
    default:
      // Indentation can carry meaning here (Python, YAML) or be deliberate, so keep it.
      return { code: tidyLines(rawCode), language }
  }
}

/**
 * Whitespace-only cleanup that keeps each line's indentation: normalises line endings, strips
 * trailing spaces, removes the blank line after every line that web/GTM copies add, and
 * squeezes runs of blank lines down to one.
 */
function tidyLines(code: string): string {
  const lines = splitLines(code).map((l) => l.replace(/\s+$/, ''))
  const doubleSpaced = isDoubleSpaced(lines)
  const out: string[] = []
  for (const line of lines) {
    if (line === '') {
      if (doubleSpaced) continue
      if (out.length && out[out.length - 1] !== '') out.push('')
    } else {
      out.push(line)
    }
  }
  while (out.length && out[out.length - 1] === '') out.pop()
  return out.join('\n')
}

function splitLines(code: string): string[] {
  return code.replace(/\r\n?/g, '\n').split('\n')
}

/** True when nearly every line is followed by a blank one (typical of copied web code). */
function isDoubleSpaced(lines: string[]): boolean {
  const nonEmpty = lines.filter((l) => l.trim()).length
  const empty = lines.length - nonEmpty
  return nonEmpty > 2 && empty / nonEmpty >= 0.7
}

/** The brackets on one line, in order, ignoring strings and // comments. */
function brackets(line: string): string[] {
  let quote: string | null = null
  const found: string[] = []
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quote) {
      if (ch === '\\') i++
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '"' || ch === "'" || ch === '`') quote = ch
    else if (ch === '/' && line[i + 1] === '/') break
    else if ('{[()]}'.includes(ch)) found.push(ch)
  }
  return found
}

function beautifyJs(code: string): string {
  const tidied = tidyLines(code)
  // Re-indenting would change multi-line strings and block comments, so leave those alone.
  if (/`[^`]*\n[^`]*`/.test(tidied) || /\/\*[\s\S]*\n[\s\S]*\*\//.test(tidied)) return tidied

  const lines = tidied.split('\n').map((l) => l.trim())
  // No multi-line brackets means indentation is the user's own (or meaningful): keep it.
  const hasBlocks = lines.some((l) => /[{[(]$/.test(l.replace(/\s*\/\/.*$/, '')) || /^[}\])]/.test(l))
  if (!hasBlocks) return tidied

  // Drop blank lines straight after an opener or straight before a closer.
  const cleaned = lines.filter((l, i) => {
    if (l !== '') return true
    const prev = lines[i - 1] ?? ''
    const next = lines[i + 1] ?? ''
    return !/[{[(]$/.test(prev) && !/^[}\])]/.test(next)
  })

  // Each indent level remembers how many brackets its line left open, so a line that opens
  // several at once ("push({", "fn(a, function () {") indents one level, closed by "})".
  const levels: number[] = []
  const out: string[] = []
  for (let line of cleaned) {
    if (line === '') {
      out.push('')
      continue
    }
    const found = brackets(line)
    // Closers at the very start of the line ("}", "})", "],") pull the line itself left.
    const leadingClosers = (line.match(/^[}\])\s]*/)?.[0] ?? '').replace(/\s/g, '').length
    let lineDepth = levels.length
    let openedHere = false
    found.forEach((b, i) => {
      if ('{[('.includes(b)) {
        if (openedHere) levels[levels.length - 1]++
        else levels.push(1)
        openedHere = true
      } else if (levels.length) {
        levels[levels.length - 1]--
        if (levels[levels.length - 1] === 0) {
          levels.pop()
          openedHere = false
        }
      }
      if (i === leadingClosers - 1) lineDepth = levels.length
    })
    // "key : value" -> "key: value" (only when a value follows, so "default:" stays as is).
    line = line.replace(/^([\w$]+|"[^"]*"|'[^']*')\s*:\s*(?=\S)/, '$1: ')
    out.push('  '.repeat(lineDepth) + line)
  }
  return out.join('\n')
}

function beautifyCss(css: string): string {
  // Break after { ; } outside strings, parentheses and comments (so url(data:...;base64) survives).
  let text = ''
  let quote: string | null = null
  let parens = 0
  let comment = false
  const src = css.replace(/\r\n?/g, '\n')
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    text += ch
    if (comment) {
      if (ch === '*' && src[i + 1] === '/') {
        text += '/'
        i++
        comment = false
      }
      continue
    }
    if (quote) {
      if (ch === '\\') text += src[++i] ?? ''
      else if (ch === quote) quote = null
      continue
    }
    if (ch === '/' && src[i + 1] === '*') comment = true
    else if (ch === '"' || ch === "'") quote = ch
    else if (ch === '(') parens++
    else if (ch === ')') parens = Math.max(0, parens - 1)
    else if (parens === 0 && (ch === '{' || ch === ';' || ch === '}')) {
      if (ch === '}') text = text.slice(0, -1) + '\n}'
      text += '\n'
    }
  }

  let depth = 0
  const out: string[] = []
  for (const raw of text.split('\n')) {
    let line = raw.trim()
    if (!line) continue
    if (line.startsWith('}')) depth = Math.max(0, depth - 1)
    if (line.endsWith('{')) line = line.replace(/\s*\{$/, ' {')
    else if (depth > 0) line = line.replace(/^([a-zA-Z-]+)\s*:\s*/, '$1: ')
    out.push('  '.repeat(depth) + line)
    if (line.endsWith('{')) depth++
  }
  return out.join('\n')
}

const VOID_TAGS = /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)\b/i

function beautifyHtml(html: string): string {
  // Whitespace inside these is significant (or is code), so don't reflow.
  if (/<(pre|textarea|script|style)\b/i.test(html)) return tidyLines(html)

  const lines = html.replace(/\r\n?/g, '\n').replace(/>\s*</g, '>\n<').split('\n')
  let depth = 0
  const out: string[] = []
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) continue
    const closing = /^<\//.test(line)
    const tag = line.match(/^<([a-zA-Z][\w-]*)/)?.[1]
    const opening = !!tag && !VOID_TAGS.test(line) && !/\/>$/.test(line) && !new RegExp(`</${tag}>\\s*$`, 'i').test(line)
    if (closing) depth = Math.max(0, depth - 1)
    out.push('  '.repeat(depth) + line)
    if (opening) depth++
  }
  return out.join('\n')
}
