// Inspecciona el build de la extensión (T075): sin secretos ni variables de servidor y con el manifest
// mínimo esperado. Se ejecuta tras cada `wxt build`; falla el build si algo no cuadra.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SECRET_PATTERNS = [
  [/sk-ant-[\w-]{10,}/, 'Anthropic API key'],
  [/AIza[\w-]{35}/, 'Google API key'],
  [/-----BEGIN [A-Z ]*PRIVATE KEY-----/, 'private key'],
  [/ANTHROPIC_API_KEY|FACTCHECK_API_KEY|DATABASE_URL|LLM_MODEL_/, 'server env var name'],
  [/postgres(ql)?:\/\/\w+:[^@\s'"]+@/, 'database URL with credentials'],
];
const PERMISSIONS = ['sidePanel', 'storage'];
const CSP = "script-src 'self'; object-src 'self'";

const files = (dir) =>
  readdirSync(dir).flatMap((f) =>
    statSync(join(dir, f)).isDirectory() ? files(join(dir, f)) : [join(dir, f)],
  );

export function checkBundle(dir) {
  const problems = [];
  for (const file of files(dir)) {
    if (!/\.(js|html|json|css|map)$/.test(file)) continue;
    const text = readFileSync(file, 'utf8');
    for (const [re, what] of SECRET_PATTERNS) if (re.test(text)) problems.push(`${what} in ${file}`);
  }
  const m = JSON.parse(readFileSync(join(dir, 'manifest.json'), 'utf8'));
  const perms = [...(m.permissions ?? [])].sort();
  if (JSON.stringify(perms) !== JSON.stringify([...PERMISSIONS].sort()))
    problems.push(`unexpected permissions: ${perms.join(', ')}`);
  const hosts = m.host_permissions ?? [];
  const otherHosts = hosts.filter((h) => h !== '*://*.youtube.com/*');
  if (
    !hosts.includes('*://*.youtube.com/*') ||
    otherHosts.length !== 1 ||
    !/^https?:\/\/[^*/]+\/\*$/.test(otherHosts[0])
  )
    problems.push(`host_permissions must be YouTube + one API origin: ${hosts.join(', ')}`);
  if (m.content_security_policy?.extension_pages !== CSP) problems.push('missing or relaxed extension CSP');
  for (const cs of m.content_scripts ?? [])
    if (cs.matches.some((u) => !u.includes('youtube.com')))
      problems.push(`content script outside YouTube: ${cs.matches}`);
  if (m.externally_connectable) problems.push('externally_connectable must not be set');
  return problems;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const dir = process.argv[2] ?? '.output/chrome-mv3';
  const problems = checkBundle(dir);
  if (problems.length) {
    console.error(`✗ bundle check failed (${dir}):\n  ${problems.join('\n  ')}`);
    process.exit(1);
  }
  console.log(`✓ bundle check: ${dir} sin secretos; manifest mínimo`);
}
