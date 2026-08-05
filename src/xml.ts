/**
 * xml.ts — shared escaping helpers so every template/pattern renderer
 * escapes text the same way. Unescaped `&`/`<`/`>` in slide text is a
 * silent corruption source (produces XML that parses "fine" until a
 * client is strict about entities), so this is centralized rather than
 * left to each renderer to remember.
 */

export function escapeXmlText(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

export function escapeXmlAttr(s: string): string {
  return escapeXmlText(s).replace(/"/g, "&quot;");
}
