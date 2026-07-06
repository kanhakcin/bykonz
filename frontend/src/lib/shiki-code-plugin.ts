// Custom code plugin for iotlog.
// Wraps @streamdown/code's createCodePlugin (which already uses JS regex engine, no WASM)
// and restricts supportsLanguage to IoT/fleet-relevant languages only,
// preventing runtime fetching of irrelevant language grammar chunks
// (emacs-lisp 780 kB, cpp 626 kB, wolfram 262 kB, etc.).
import { createCodePlugin } from '@streamdown/code';

const IOT_LANGS = new Set([
  'javascript',
  'js',
  'typescript',
  'ts',
  'jsx',
  'tsx',
  'json',
  'jsonc',
  'bash',
  'sh',
  'zsh',
  'shell',
  'python',
  'py',
  'sql',
  'yaml',
  'yml',
  'html',
  'css',
  'markdown',
  'md',
  'text',
  'txt',
  'plaintext',
]);

const base = createCodePlugin();

export const code: typeof base = {
  ...base,
  supportsLanguage(lang: string): boolean {
    return IOT_LANGS.has(lang.trim().toLowerCase());
  },
};
