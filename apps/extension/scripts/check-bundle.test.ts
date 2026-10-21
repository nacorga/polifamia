import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
// @ts-expect-error módulo JS sin tipos
import { checkBundle } from './check-bundle.mjs';

const manifest = {
  permissions: ['sidePanel', 'storage'],
  host_permissions: ['*://*.youtube.com/*', 'http://localhost:3100/*'],
  content_security_policy: { extension_pages: "script-src 'self'; object-src 'self'" },
  content_scripts: [{ matches: ['*://*.youtube.com/*'] }],
};
const bundle = (files: Record<string, string>) => {
  const dir = mkdtempSync(join(tmpdir(), 'bundle-'));
  for (const [f, c] of Object.entries(files)) writeFileSync(join(dir, f), c);
  return dir;
};

describe('checkBundle', () => {
  it('accepts a clean bundle with the minimal manifest', () => {
    expect(checkBundle(bundle({ 'manifest.json': JSON.stringify(manifest), 'a.js': 'fetch(API)' }))).toEqual(
      [],
    );
  });
  it('flags secrets, server env names and extra permissions', () => {
    const problems: string[] = checkBundle(
      bundle({
        'manifest.json': JSON.stringify({ ...manifest, permissions: ['sidePanel', 'storage', 'tabs'] }),
        'a.js': 'const k="sk-ant-api03-abcdefghijklmnop"; process.env.FACTCHECK_API_KEY',
      }),
    );
    expect(problems.join('\n')).toMatch(/Anthropic API key/);
    expect(problems.join('\n')).toMatch(/server env var name/);
    expect(problems.join('\n')).toMatch(/unexpected permissions/);
  });
  it('flags a relaxed CSP and extra host permissions', () => {
    const problems: string[] = checkBundle(
      bundle({
        'manifest.json': JSON.stringify({
          ...manifest,
          host_permissions: [...manifest.host_permissions, '<all_urls>'],
          content_security_policy: { extension_pages: "script-src 'self' 'unsafe-eval'" },
        }),
      }),
    );
    expect(problems).toHaveLength(2);
  });
});
