/**
 * Sandboxed evaluator for LLM-generated Preact components.
 * Strips module syntax, then evaluates inside `new Function` whose scope is a
 * Proxy over the allowed globals — anything else resolves to undefined,
 * blocking access to fetch/XHR/WebSocket/etc. even from within a Worker.
 */

export type GlobalsMap = Record<string, unknown>;

interface StripResult {
  code: string;
  exportName: string | null;
}

function stripModuleSyntax(raw: string): StripResult {
  let code = raw;
  let exportName: string | null = null;

  code = code.replace(/^import\b[^;]+;?\s*$/gm, "");

  code = code.replace(/export\s+default\s+function\s+(\w+)/, (_m, name) => {
    exportName = name;
    return `function ${name}`;
  });

  code = code.replace(/^export\s+default\s+(\w+)\s*;?\s*$/m, (_m, name) => {
    exportName ??= name;
    return "";
  });

  code = code.replace(/^export\s+(default\s+)?/gm, "");

  return { code: code.trim(), exportName };
}

function findComponentName(code: string): string | null {
  const fnMatches = [...code.matchAll(/function\s+([A-Z]\w*)\s*\(/g)];
  if (fnMatches.length) return fnMatches[fnMatches.length - 1][1];

  const constMatches = [...code.matchAll(/(?:const|let|var)\s+([A-Z]\w*)\s*=/g)];
  if (constMatches.length) return constMatches[constMatches.length - 1][1];

  return null;
}

export function evaluate(code: string, globals: GlobalsMap): (...args: unknown[]) => unknown {
  const { code: stripped, exportName } = stripModuleSyntax(code);
  const componentName = exportName ?? findComponentName(stripped);

  if (!componentName) {
    throw new Error(
      "[runtime] Cannot determine component name. Code must contain a PascalCase function or export default.",
    );
  }

  const sandbox = new Proxy(globals, {
    has() {
      return true;
    },
    get(target, key: string) {
      return Object.prototype.hasOwnProperty.call(target, key) ? target[key] : undefined;
    },
  });

  // `with` is banned in strict mode, but new Function() bodies are non-strict.
  const factory = new Function(
    "__sandbox__",
    `with(__sandbox__){${stripped}\nreturn ${componentName};}`,
  );

  return factory(sandbox) as (...args: unknown[]) => unknown;
}
