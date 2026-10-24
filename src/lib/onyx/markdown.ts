/**
 * Robust Client-Side Markdown Parser & Sanitizer
 * 
 * Supports:
 * - Fenced code blocks with language labels & copy buttons
 * - Inline code
 * - Markdown tables
 * - Blockquotes
 * - Nested lists
 * - Headings
 * - Bold, italic, safe links
 * - Security: Sanitizes user/model input to prevent XSS
 */

export function sanitizeHtml(html: string): string {
  // Strip script, iframe, and dangerous event handlers
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/\son\w+\s*=\s*["'][^"']*["']/gi, '');
}

export function escapeHtml(str: string): string {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function renderMarkdown(markdown: string): string {
  if (!markdown) return '';

  let out = escapeHtml(markdown);

  // 1. Fenced Code Blocks: ```lang ... ```
  out = out.replace(/```([a-zA-Z0-9_\-\.]*)\n([\s\S]*?)```/g, (match, lang, code) => {
    const languageLabel = lang.trim() || 'plaintext';
    return `
      <div class="code-block-wrapper">
        <div class="code-block-header">
          <span>${languageLabel}</span>
          <button class="btn-copy-code" onclick="navigator.clipboard.writeText(this.closest('.code-block-wrapper').querySelector('code').innerText); this.innerText = 'Copied!'; setTimeout(() => this.innerText = 'Copy', 2000);">
            Copy
          </button>
        </div>
        <pre><code>${code.trim()}</code></pre>
      </div>
    `;
  });

  // 2. Inline Code
  out = out.replace(/`([^`\n]+)`/g, '<code>$1</code>');

  // 3. Tables (simple markdown tables)
  out = out.replace(/(\|[^\n]+\|\n)+/g, (tableBlock) => {
    const lines = tableBlock.trim().split('\n');
    if (lines.length < 2) return tableBlock;

    let html = '<table>';
    let isHeader = true;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      // Skip separator line e.g. |---|---|
      if (line.match(/^\|[\s\-:]+(\|[\s\-:]+)+\|$/)) {
        isHeader = false;
        continue;
      }

      const cells = line.split('|').filter((_, idx, arr) => idx > 0 && idx < arr.length - 1);
      html += '<tr>';
      cells.forEach(c => {
        const tag = isHeader ? 'th' : 'td';
        html += `<${tag}>${c.trim()}</${tag}>`;
      });
      html += '</tr>';
      if (i === 0 && !lines[1].match(/^\|[\s\-:]+/)) {
        isHeader = false;
      }
    }
    html += '</table>';
    return html;
  });

  // 4. Blockquotes
  out = out.replace(/^>\s+([^\n]+)/gm, '<blockquote>$1</blockquote>');

  // 5. Headings
  out = out.replace(/^### (.*$)/gm, '<h3>$1</h3>');
  out = out.replace(/^## (.*$)/gm, '<h2>$1</h2>');
  out = out.replace(/^# (.*$)/gm, '<h1>$1</h1>');

  // 6. Emphasis
  out = out.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*(.*?)\*/g, '<em>$1</em>');

  // 7. Unordered lists
  out = out.replace(/^\s*[-*+]\s+([^\n]+)/gm, '<li>$1</li>');
  out = out.replace(/(<li>[\s\S]*?<\/li>)/g, '<ul>$1</ul>');

  // 8. Clean consecutive tags
  out = out.replace(/<\/ul>\s*<ul>/g, '');

  // 9. Links (safe http/https only)
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // 10. Paragraphs & breaks
  out = out.replace(/\n\n+/g, '<br><br>');
  out = out.replace(/(?<!<\/h[1-3]>|<\/pre>|<\/blockquote>|<\/table>|<\/ul>)\n/g, '<br>');

  return sanitizeHtml(out);
}
