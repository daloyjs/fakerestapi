// Minimal YAML serializer sufficient for an OpenAPI 3 document.
// Avoids adding a runtime dependency. Output is human-readable and round-trippable
// through any standard YAML parser (PyYAML, js-yaml, Swagger UI, etc.).

const KEY_RE = /^[A-Za-z_][\w\-./]*$/;
const RESERVED = /^(true|false|null|yes|no|on|off|~)$/i;

function quoteString(s: string): string {
  if (s === '') return '""';
  // Always JSON-quote if there's any character that could confuse YAML or be ambiguous.
  if (
    /[:#&*!|>'"%@`\n\r\t]/.test(s) ||
    /^[\s\-?,\[\]{}]/.test(s) ||
    /\s$/.test(s) ||
    RESERVED.test(s) ||
    /^-?\d/.test(s) // looks like a number/date
  ) {
    return JSON.stringify(s);
  }
  return s;
}

function quoteKey(k: string): string {
  return KEY_RE.test(k) && !RESERVED.test(k) ? k : JSON.stringify(k);
}

function isComplex(v: unknown): boolean {
  if (v === null || typeof v !== 'object') return false;
  if (Array.isArray(v)) return v.length > 0;
  return Object.keys(v as object).length > 0;
}

/**
 * Dumps a value to YAML. `indent` is the leading whitespace placed before all
 * lines AFTER the first (the first line is positioned by the caller).
 */
export function yamlDump(value: unknown, indent = ''): string {
  if (value === null || value === undefined) return 'null';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'number') return Number.isFinite(value) ? String(value) : 'null';
  if (typeof value === 'string') return quoteString(value);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    return value
      .map((item, i) => {
        const prefix = i === 0 ? '' : indent;
        if (isComplex(item)) {
          if (Array.isArray(item)) {
            // nested array of arrays — emit on next line
            return `${prefix}-\n${indent}  ${yamlDump(item, indent + '  ')}`;
          }
          // object: dump with deeper indent, inline first key after the dash
          const sub = yamlDump(item, indent + '  ');
          return `${prefix}- ${sub}`;
        }
        return `${prefix}- ${yamlDump(item, indent + '  ')}`;
      })
      .join('\n');
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value as Record<string, unknown>);
    if (keys.length === 0) return '{}';
    return keys
      .map((k, i) => {
        const v = (value as Record<string, unknown>)[k];
        const prefix = i === 0 ? '' : indent;
        const ks = quoteKey(k);
        if (!isComplex(v)) {
          return `${prefix}${ks}: ${yamlDump(v, indent + '  ')}`;
        }
        const sub = yamlDump(v, indent + '  ');
        if (Array.isArray(v)) {
          // Array items already include their own indent (indent + '  ')
          return `${prefix}${ks}:\n${indent}  ${sub}`;
        }
        return `${prefix}${ks}:\n${indent}  ${sub}`;
      })
      .join('\n');
  }

  return String(value);
}
