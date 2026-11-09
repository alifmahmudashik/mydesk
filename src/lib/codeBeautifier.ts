/**
 * Code detection & auto-beautification utility.
 * Normalizes line breaks, eliminates excessive blank lines (like double-spaced pastes),
 * fixes bracket indentation (2 spaces), and formats object/code syntax.
 */

export function detectLanguage(code: string): string {
  const trimmed = code.trim()
  if (!trimmed) return 'text'

  // JSON detection
  if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
    try {
      JSON.parse(trimmed)
      return 'json'
    } catch {
      // Might be JS object literal
    }
  }

  // HTML / XML detection
  if (
    /^<(!DOCTYPE|[a-zA-Z1-6]+(\s+[^>]*>|>))[\s\S]*>$/i.test(trimmed) ||
    /<\/(div|p|span|a|ul|li|table|html|body|head|script|style)>/i.test(trimmed)
  ) {
    return 'html'
  }

  // SQL detection
  if (/^\s*(SELECT|INSERT\s+INTO|UPDATE|DELETE\s+FROM|CREATE\s+TABLE|ALTER\s+TABLE|DROP\s+TABLE|WITH)\s+/i.test(trimmed)) {
    return 'sql'
  }

  // CSS detection
  if (/^[.#a-zA-Z0-9_\-\s,:]+\{\s*[a-zA-Z\-]+\s*:[^;]+;/m.test(trimmed)) {
    return 'css'
  }

  // Python detection
  if (/^\s*(def\s+\w+\(.*\):|import\s+\w+|from\s+\w+\s+import|class\s+\w+.*:|if\s+__name__\s*==)/m.test(trimmed)) {
    return 'python'
  }

  // Shell / Bash detection
  if (
    /^\s*(npm|pnpm|yarn|npx|bun|curl|git|docker|echo|cd|mkdir|rm|export|cat)\s+/m.test(trimmed) ||
    /^\s*\$\s+[a-z]/m.test(trimmed)
  ) {
    return 'bash'
  }

  // JavaScript / TypeScript detection
  if (
    /dataLayer\.push|console\.log|const\s+\w+|let\s+\w+|var\s+\w+|function\s*\(|function\s+\w+|import\s+.*from|export\s+(default\s+)?|=>/m.test(trimmed) ||
    /^[a-zA-Z_$][a-zA-Z0-9_$]*\s*:\s*[{["'0-9a-zA-Z]/m.test(trimmed) ||
    /^[a-zA-Z_$][a-zA-Z0-9_$]*\(/m.test(trimmed)
  ) {
    return 'javascript'
  }

  return 'javascript'
}

export function beautifyCode(rawCode: string, explicitLang?: string): { code: string; language: string } {
  if (!rawCode || !rawCode.trim()) return { code: rawCode, language: 'text' }

  const lang = explicitLang && explicitLang !== 'null' ? explicitLang : detectLanguage(rawCode)

  if (lang === 'json') {
    try {
      const parsed = JSON.parse(rawCode.trim())
      return { code: JSON.stringify(parsed, null, 2), language: 'json' }
    } catch {
      // Fall through to JS formatter
    }
  }

  if (lang === 'html') {
    return { code: beautifyHtml(rawCode), language: 'html' }
  }

  if (lang === 'css') {
    return { code: beautifyCss(rawCode), language: 'css' }
  }

  if (lang === 'sql') {
    return { code: beautifySql(rawCode), language: 'sql' }
  }

  return { code: beautifyJs(rawCode), language: lang }
}

function beautifyJs(code: string): string {
  // Normalize line breaks
  const rawLines = code.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')

  // Check if code has excessive double-spacing (e.g. pasted from web where every other line is empty)
  const nonEmptyCount = rawLines.filter((l) => l.trim().length > 0).length
  const emptyCount = rawLines.filter((l) => l.trim().length === 0).length
  const isPastedDoubleSpaced = nonEmptyCount > 2 && emptyCount / nonEmptyCount > 0.35

  const cleanedLines: string[] = []
  for (let i = 0; i < rawLines.length; i++) {
    const trimmed = rawLines[i].trim()
    if (!trimmed) {
      if (isPastedDoubleSpaced) {
        // Drop alternate empty lines if the entire pasted snippet is double-spaced
        continue
      }
      // Otherwise keep at most 1 empty line between logical sections
      if (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] !== '') {
        const prev = cleanedLines[cleanedLines.length - 1]
        // Never keep an empty line right after an opening bracket
        if (!/[\{\[\(]$/.test(prev)) {
          cleanedLines.push('')
        }
      }
    } else {
      cleanedLines.push(trimmed)
    }
  }

  // Remove trailing empty lines
  while (cleanedLines.length > 0 && cleanedLines[cleanedLines.length - 1] === '') {
    cleanedLines.pop()
  }

  // Remove empty lines right before a closing bracket
  for (let i = cleanedLines.length - 1; i > 0; i--) {
    if (cleanedLines[i - 1] === '' && /^[\}\]\)]/.test(cleanedLines[i])) {
      cleanedLines.splice(i - 1, 1)
    }
  }

  // Indentation calculation
  let depth = 0
  const result: string[] = []

  for (let i = 0; i < cleanedLines.length; i++) {
    let line = cleanedLines[i]

    if (line === '') {
      result.push('')
      continue
    }

    // Check how many closers start this line: e.g. "}", "})", "],", "};"
    const leadingClosers = line.match(/^[\}\]\)]+/)
    let closerCount = leadingClosers ? leadingClosers[0].length : 0

    // If combo like "})", count closing as 1 logical un-indent level
    if (leadingClosers && leadingClosers[0].length > 1 && /^[\}\]]\s*[\)\],]/.test(line)) {
      closerCount = 1
    }

    const lineDepth = Math.max(0, depth - closerCount)

    // Normalize spacing in object keys: "key : value" -> "key: value"
    line = line.replace(/^([a-zA-Z0-9_$]+|"[^"]+"|'[^']+')\s*:\s*/, '$1: ')

    result.push('  '.repeat(lineDepth) + line)

    // Calculate net change in brackets outside string literals
    let inSingleQuote = false
    let inDoubleQuote = false
    let inBacktick = false
    let netChange = 0

    for (let c = 0; c < line.length; c++) {
      const ch = line[c]
      const prev = c > 0 ? line[c - 1] : ''

      if (ch === "'" && !inDoubleQuote && !inBacktick && prev !== '\\') inSingleQuote = !inSingleQuote
      else if (ch === '"' && !inSingleQuote && !inBacktick && prev !== '\\') inDoubleQuote = !inDoubleQuote
      else if (ch === '`' && !inSingleQuote && !inDoubleQuote && prev !== '\\') inBacktick = !inBacktick
      else if (!inSingleQuote && !inDoubleQuote && !inBacktick) {
        if (ch === '{' || ch === '[' || ch === '(') netChange++
        else if (ch === '}' || ch === ']' || ch === ')') netChange--
      }
    }

    // If line ends with call + object opening like "({", count as 1 indent step
    if (/[\(\[]\s*[\{\[]\s*$/.test(line) && netChange > 1) {
      netChange = 1
    }

    depth = Math.max(0, depth + netChange)
  }

  return result.join('\n')
}

function beautifyHtml(html: string): string {
  let depth = 0
  const tokens = html.replace(/\r\n/g, '\n').replace(/>\s*</g, '>\n<').split('\n')
  const result: string[] = []

  for (const raw of tokens) {
    const line = raw.trim()
    if (!line) continue

    const isClosing = /^<\/[^>]+>/.test(line)
    const isSelfClosing = /^<[^>]+\/>/.test(line) || /^<(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)[^>]*>/i.test(line)
    const isOpening = /^<[^/!][^>]*>/.test(line) && !isSelfClosing

    if (isClosing) depth = Math.max(0, depth - 1)

    result.push('  '.repeat(depth) + line)

    if (isOpening) depth++
  }

  return result.join('\n')
}

function beautifyCss(css: string): string {
  const text = css.replace(/\{/g, ' {\n').replace(/\}/g, '\n}\n').replace(/;/g, ';\n')
  const lines = text.replace(/\r\n/g, '\n').split('\n')
  let depth = 0
  const result: string[] = []

  for (const raw of lines) {
    let line = raw.trim()
    if (!line) continue

    if (line.startsWith('}')) depth = Math.max(0, depth - 1)

    if (depth > 0 && line.includes(':') && !line.includes('{')) {
      line = line.replace(/^\s*([a-zA-Z\-]+)\s*:\s*/, '$1: ')
    }

    result.push('  '.repeat(depth) + line)

    if (line.endsWith('{')) depth++
  }

  return result.join('\n')
}

function beautifySql(sql: string): string {
  const keywords = [
    'SELECT',
    'FROM',
    'WHERE',
    'AND',
    'OR',
    'LEFT JOIN',
    'RIGHT JOIN',
    'INNER JOIN',
    'JOIN',
    'GROUP BY',
    'ORDER BY',
    'LIMIT',
    'OFFSET',
    'INSERT INTO',
    'VALUES',
    'UPDATE',
    'SET',
    'DELETE FROM',
    'HAVING',
  ]
  let formatted = sql.replace(/\s+/g, ' ').trim()

  for (const kw of keywords) {
    const re = new RegExp('\\b' + kw.replace(' ', '\\s+') + '\\b', 'gi')
    formatted = formatted.replace(re, '\n' + kw)
  }

  return formatted
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line, i) => {
      if (i === 0) return line
      if (/^(AND|OR|LEFT|RIGHT|INNER|JOIN|VALUES|SET)/i.test(line)) return '  ' + line
      return line
    })
    .join('\n')
}
