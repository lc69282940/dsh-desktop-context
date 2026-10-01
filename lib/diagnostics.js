import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { homedir } from 'node:os'
import path from 'node:path'
import { PLUGIN_VERSION, VERIFIED_DESKTOP_VERSION, platformPath } from './runtime.js'
import { SOURCE_SECTION, SURFACE_SECTION } from './prompt.js'

const IO = { appendFileSync, mkdirSync, writeFileSync }
const hasText = (value) => typeof value === 'string' && value.trim().length > 0

/** Same default-home/tilde rules as dsh-home-paths, without a runtime dependency. */
export function diagnosticPaths({
  env = process.env, platform = process.platform, home = homedir(), cwd = process.cwd(), dshHomePath,
} = {}) {
  const p = platformPath(platform) ?? path
  const expand = (value) => value === '~' ? home
    : value.startsWith('~/') || value.startsWith('~\\') ? p.join(home, value.slice(2)) : value
  let resolvedHome
  try {
    const provided = dshHomePath?.()
    if (hasText(provided) && p.isAbsolute(provided)) resolvedHome = provided
  } catch { /* A missing optional host helper does not disable the env fallback. */ }
  resolvedHome ??= p.resolve(cwd, expand(hasText(env.DSH_HOME) ? env.DSH_HOME : p.join(home, '.dsh')))
  const base = p.join(resolvedHome, 'diagnostics', 'dsh-desktop-context')
  const target = (key, fallback) => hasText(env[key]) ? p.resolve(cwd, expand(env[key])) : p.join(base, fallback)
  return Object.freeze({
    events: target('DSH_DESKTOP_CONTEXT_DIAGNOSTICS', 'events.jsonl'),
    evidence: target('DSH_DESKTOP_CONTEXT_EVIDENCE', 'last-assembly.json'),
  })
}

/**
 * Only a fixed allowlist of status fields is persisted. No text, text hashes,
 * paths, ports, profile names, process identifiers, agent identifiers, variables,
 * credentials or prompt/context/tool contents enter these records.
 */
export function assemblySummary(original, result, context) {
  const before = Array.isArray(original?.sections) ? original.sections : []
  const after = Array.isArray(result?.sections) ? result.sections : []
  const sections = [SOURCE_SECTION, SURFACE_SECTION].map((name) => ({
    name,
    present: before.some((section) => section?.name === name),
    rewritten: before.some((section, i) => section?.name === name
      && after[i]?.name === name && after[i] !== section && after[i].text !== section.text),
  }))
  return {
    stage: 'system-prompt/assemble',
    agentContextPresent: Boolean(context?.agent),
    assemblyShape: Array.isArray(original?.sections) ? 'sections' : 'unrecognized',
    rewrittenKnownSections: sections.some((section) => section.rewritten),
    sections,
  }
}

/**
 * Best-effort, user-home-only by default; never fall back to the package tree.
 * Fingerprints deduplicate ONLY the small redacted metadata object below.
 * This waterfall runs before SystemPrompt's complete-prompt enforcement; these
 * records do not prove model submission, final rendering or session persistence.
 */
export function createDiagnostics({ facts, io = IO, ...options } = {}) {
  let files
  try { files = diagnosticPaths(options) } catch { /* Disable unavailable diagnostic paths. */ }
  const metadata = {
    schemaVersion: 1,
    pluginVersion: PLUGIN_VERSION,
    desktopPlatform: ['win32', 'linux', 'darwin'].includes(facts?.platform) ? facts.platform : 'unknown',
    // Avoid persisting arbitrary prerelease/build metadata from a local manifest.
    desktopVersion: facts?.version === VERIFIED_DESKTOP_VERSION ? VERIFIED_DESKTOP_VERSION
      : facts?.version && facts.version !== 'unknown' ? 'other' : 'unknown',
    desktopVersionSource: facts?.versionSource === 'runtime-package' ? 'runtime-package' : 'unavailable',
    layout: facts?.archivePath ? 'asar' : 'directory',
    mirror: facts?.mirrorRoot ? facts.mirrorExists ? 'candidate-directory' : 'candidate-unconfirmed' : 'not-applicable',
    mirrorVerified: false,
  }
  let previous = ''
  function write(kind, value, append = false) {
    try {
      if (!files?.[kind]) return false
      const file = files[kind]
      io.mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
      const text = JSON.stringify(value, null, append ? undefined : 2) + '\n'
      const settings = { encoding: 'utf8', mode: 0o600 }
      if (append) io.appendFileSync(file, text, settings)
      else io.writeFileSync(file, text, settings)
      return true
    } catch { return false } // Read-only home/override, EACCES, ENOSPC, etc. are non-fatal.
  }
  function event(name) {
    try { write('events', { ...metadata, time: new Date().toISOString(), event: name }, true) }
    catch { /* Diagnostics must never become a lifecycle failure. */ }
  }
  return Object.freeze({
    active() { event('active') },
    disposed() { event('disposed') },
    assembled(original, result, context) {
      try {
        const summary = assemblySummary(original, result, context)
        const fingerprint = createHash('sha256').update(JSON.stringify({ ...metadata, ...summary })).digest('hex')
        if (fingerprint === previous) return
        const value = { ...metadata, ...summary, time: new Date().toISOString(), fingerprint }
        const eventWritten = write('events', { ...value, event: 'assembled' }, true)
        const evidenceWritten = write('evidence', value)
        // A temporarily unwritable destination may recover on the next assembly.
        if (eventWritten && evidenceWritten) previous = fingerprint
      } catch { /* Even malformed optional diagnostic input cannot break assembly. */ }
    },
  })
}
