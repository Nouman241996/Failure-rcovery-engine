/**
 * Lightweight `{{path.to.value}}` interpolation used by TOOL_INVOKE body
 * templates and LLM_CALL prompt templates. Intentionally tiny — if users want
 * full Jinja/Handlebars semantics they can render client-side.
 */

const TOKEN_RE = /\{\{\s*([a-zA-Z0-9_.[\]]+)\s*\}\}/g;

export function interpolate<T>(template: T, context: Record<string, unknown>): T {
  if (typeof template === 'string') {
    return template.replace(TOKEN_RE, (_match, path: string) => {
      const value = lookup(context, path);
      return value === undefined || value === null ? '' : String(value);
    }) as unknown as T;
  }
  if (Array.isArray(template)) {
    return template.map((v) => interpolate(v, context)) as unknown as T;
  }
  if (template && typeof template === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(template as Record<string, unknown>)) {
      out[k] = interpolate(v, context);
    }
    return out as unknown as T;
  }
  return template;
}

function lookup(source: Record<string, unknown>, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = source;
  for (const p of parts) {
    if (cur && typeof cur === 'object' && p in (cur as Record<string, unknown>)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return undefined;
    }
  }
  return cur;
}
