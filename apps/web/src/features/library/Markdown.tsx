import type { ReactNode } from 'react';

// FR-090: author Markdown rendered as React elements, never as HTML, so nothing an author writes
// can inject markup. HTML tags are dropped (a script's body with it).
// shortcut: paragraphs, "- " lists, **bold** and *italic* only; use a Markdown library if authors
// need headings, links or tables.
const stripTags = (md: string) =>
  md.replace(/<script\b[\s\S]*?<\/script\s*>/gi, '').replace(/<[^>]*>/g, '');

function inline(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|\*[^*]+\*)/)
    .map((part, i) =>
      part.startsWith('**') && part.length > 4 ? (
        <strong key={i}>{part.slice(2, -2)}</strong>
      ) : part.startsWith('*') && part.length > 2 ? (
        <em key={i}>{part.slice(1, -1)}</em>
      ) : (
        part
      ),
    );
}

export function Markdown({ source }: { source: string }) {
  return (
    <>
      {stripTags(source)
        .split(/\n\s*\n/)
        .map((block) => block.trim())
        .filter(Boolean)
        .map((block, i) => {
          const lines = block.split('\n');
          return lines.every((l) => /^\s*[-*] /.test(l)) ? (
            <ul key={i}>
              {lines.map((l, j) => (
                <li key={j}>{inline(l.replace(/^\s*[-*] /, ''))}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{inline(lines.join(' '))}</p>
          );
        })}
    </>
  );
}
