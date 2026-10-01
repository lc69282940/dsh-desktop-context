import { readFileSync } from 'node:fs'
import { platformPath } from './runtime.js'

// Keep the process detector separately testable without any installed DSH code.
export { desktopFacts } from './runtime.js'
export const SOURCE_SECTION = 'harness:source'
export const SURFACE_SECTION = 'app:web-surface'

function loadDesktopText() {
  try { return readFileSync(new URL('../prompts/desktop-surface.md', import.meta.url), 'utf8').trim() }
  catch { return null } // A damaged/read-protected installation must not prevent host boot.
}
const desktopText = loadDesktopText()

// Exact legacy templates verified in desktop 0.2.0-rc.2. Only the variable
// path/URL slot is dynamic. Prefix-only matching would overwrite future/custom
// text which happens to retain the same opening sentence.
const SOURCE_PREFIX = 'The DeepSeek Harness implementation checkout is at '
const SOURCE_SUFFIX = '. The checkout location and current working directory are separate values and may differ; never infer the working directory from this path. Use pwd to determine the current working directory. Use this checkout only to inspect or extend DSH itself.'
const WEB_PREFIX = 'You are interacting with the user through the DeepSeek Harness Web GUI at '
const WEB_SUFFIX = '. When the user refers to "this page", "this GUI", or "this app" without naming another target, they mean this GUI. The browser provides no implicit DOM, route, or screenshot context. The client-plugin HMR receiver is active, but client-plugin changes reload without a refresh only while `pnpm run dev:web` is also running from this same checkout to rebuild their bundles; verify that watcher before promising automatic updates. Every other change — the apps/web shell and plain packages — requires rebuilding the affected Web artifacts and verifying this existing URL after a page refresh. Starting another server does not update this GUI. The apps/web Vite entry builds the shell but is not a standalone application because only dsh web injects window.__DSH_BOOT__. Do not start a replacement server unless the user asks; if one is needed, use a managed background job and verify its exact URL.'

function templateSlot(text, prefix, suffix) {
  if (typeof text !== 'string' || !text.startsWith(prefix) || !text.endsWith(suffix)) return null
  const slot = text.slice(prefix.length, -suffix.length)
  return slot.length > 0 && !/[\u0000-\u001f\u007f]/u.test(slot) ? slot : null
}

function knownSource(text, facts) {
  const slot = templateSlot(text, SOURCE_PREFIX, SOURCE_SUFFIX)
  const p = platformPath(facts.platform)
  if (slot === null || !p || !p.isAbsolute(slot) || typeof facts.runtimeRoot !== 'string') return false
  // A custom source root or a new sentence in the path slot is not the known
  // first-party runtime-root template. Do not overwrite it by prefix alone.
  const actual = p.resolve(slot)
  const expected = p.resolve(facts.runtimeRoot)
  return facts.platform === 'win32' ? actual.toLowerCase() === expected.toLowerCase() : actual === expected
}

export function loopbackTransport(value) {
  if (typeof value !== 'string') return null
  const match = /^http:\/\/127\.0\.0\.1:([1-9]\d{0,4})$/.exec(value)
  return match && match[0] === value && Number(match[1]) <= 65535 ? value : null
}

export function sourcePrompt(facts) {
  const lines = [
    '## DeepSeek Harness desktop installation and source paths',
    `Desktop host version: ${facts.version}. Host entry: ${facts.entry}.`,
    `Runtime package root inferred from that entry: ${facts.runtimeRoot}. Version metadata is ${facts.versionSource === 'runtime-package' ? 'read from the runtime package itself, not a source mirror' : 'unavailable; do not infer a version from a candidate mirror'}.`,
  ]
  if (facts.archivePath) {
    lines.push(
      `This root is inside the Electron ASAR file ${facts.archivePath}; it is a virtual runtime path, NOT an ordinary on-disk source checkout. Normal filesystem tools (including read/glob and platform shells) cannot traverse an ASAR file as a directory. A path-not-found here is not evidence of an ACL/sandbox problem.`,
      `Candidate source mirror: ${facts.mirrorRoot}. ${facts.mirrorExists ? 'Directory metadata reports that this location exists, but readability, completeness, and correspondence to the active archive have NOT been verified.' : 'Its existence, readability, completeness, and correspondence to the active archive have NOT been verified.'} Treat it only as an inspection candidate, never as a verified checkout or a write target. Compare relevant member bytes or version with the current archive before relying on it, especially after upgrades. If extraction is needed, use a separate inspection directory.`,
      'For packed archive members, editing a separately extracted mirror does not update the running application. Some officially unpacked native resources are runtime-owned; inspect archive metadata and actual module resolution before any user-authorized change. Prefer a supported profile/local-plugin correction over repacking or overwriting the running ASAR. Never delete the app.asar.unpacked tree as if it were all disposable diagnostics.',
    )
  } else {
    lines.push('This desktop host is not running from an ASAR path. Verify the actual directory, source/build layout, and module resolution before making changes; do not assume a packaged mirror or a development server.')
  }
  lines.push('The installation root and the task workspace are different. Run pwd to determine the actual working directory; do not infer it from an installation path. Inspect or extend this installation only when the user asks to work on Harness itself. Discover the current runtime/dependency executables rather than copying stale hard-coded paths.')
  return lines.join('\n\n')
}

export function surfacePrompt(transportUrl) {
  if (!desktopText || !desktopText.includes('{{transport_url}}')) return null
  const url = loopbackTransport(transportUrl)
    ?? 'the current DSH_WEB_URL (inspect only its credential-free loopback origin if transport diagnostics are needed)'
  return desktopText.replace('{{transport_url}}', () => url)
}

/** Replace only the two known legacy templates, never tools/policy/persona. */
export function rewriteAssembly(assembly, facts, transportUrl) {
  if (!facts || !Array.isArray(assembly?.sections)) return assembly
  let changed = false
  const sections = assembly.sections.map((section) => {
    if (section?.name === SURFACE_SECTION && loopbackTransport(templateSlot(section.text, WEB_PREFIX, WEB_SUFFIX))) {
      const text = surfacePrompt(transportUrl)
      if (text === null) return section
      changed = true
      return { ...section, text, interpolate: false }
    }
    if (section?.name === SOURCE_SECTION && knownSource(section.text, facts)) {
      changed = true
      return { ...section, text: sourcePrompt(facts), interpolate: false }
    }
    return section
  })
  return changed ? { ...assembly, sections } : assembly
}
