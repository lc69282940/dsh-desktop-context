import { readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

export const PLUGIN_VERSION = '0.1.0'
export const VERIFIED_DESKTOP_VERSION = '0.2.0-rc.2'
const HOST_PACKAGE = '@deepseek-ai/dsh-desktop-host'
const ENTRY_SUFFIX = `/node_modules/${HOST_PACKAGE}/lib/index.js`
const CONTROL = /[\u0000-\u001f\u007f]/u

/** Path-shape support is not a claim of native desktop verification. */
export function platformPath(platform) {
  if (platform === 'win32') return path.win32
  if (platform === 'linux' || platform === 'darwin') return path.posix
  return null
}

function nativeEntry(value, platform, p) {
  if (typeof value !== 'string' || value.length === 0 || CONTROL.test(value)) return null
  try {
    if (/^file:/i.test(value)) {
      const url = new URL(value)
      if (url.search || url.hash) return null
      // Explicit path rules also let isolated tests exercise foreign OS shapes.
      value = fileURLToPath(url, { windows: platform === 'win32' })
    }
    if (CONTROL.test(value) || !p.isAbsolute(value)) return null
    // A drive-relative/root-relative Windows spelling is not an absolute host.
    if (platform === 'win32' && p.parse(value).root.length <= 1) return null
    return p.normalize(value)
  } catch { return null }
}

/** Accept only bounded release identifiers, never arbitrary manifest prose. */
export function releaseVersion(value) {
  return typeof value === 'string' && value.length <= 80 && !CONTROL.test(value)
    && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(value)
    ? value : 'unknown'
}

/**
 * Affirmative process-entry evidence only: no profile, port, executable-name or
 * DSH_WEB_URL heuristics. Reads are best-effort; nothing is extracted or written.
 * A mirror directory is ALWAYS an unverified candidate, including when it exists.
 */
export function desktopFacts({
  argv = process.argv, execPath = process.execPath, platform = process.platform,
  readFile = readFileSync, stat = statSync,
} = {}) {
  const p = platformPath(platform)
  if (!p || !Array.isArray(argv)) return null
  const entry = nativeEntry(argv[1], platform, p)
  if (!entry) return null
  const normalized = platform === 'win32' ? entry.replaceAll('\\', '/') : entry
  const matches = platform === 'win32'
    ? normalized.toLowerCase().endsWith(ENTRY_SUFFIX.toLowerCase())
    : normalized.endsWith(ENTRY_SUFFIX)
  if (!matches) return null

  // Walking parents preserves filesystem roots and UNC shares without relying
  // on drive-letter heuristics or the platform of the machine running a test.
  let runtimeRoot = entry
  for (let i = 0; i < 5; i++) runtimeRoot = p.dirname(runtimeRoot)
  const normalizedRoot = platform === 'win32' ? runtimeRoot.replaceAll('\\', '/') : runtimeRoot
  const archive = (platform === 'win32' ? /^(.*?\.asar)(\/.*)?$/i : /^(.*?\.asar)(\/.*)?$/).exec(normalizedRoot)
  const archivePath = archive ? p.normalize(archive[1]) : null
  const mirrorRoot = archive ? p.normalize(`${archive[1]}.unpacked${archive[2] ?? ''}`) : null
  let version = 'unknown'
  let versionSource = 'unavailable'
  try {
    // Deliberately never read version metadata from the unverified mirror.
    const pkg = JSON.parse(readFile(p.join(runtimeRoot, 'node_modules', HOST_PACKAGE, 'package.json'), 'utf8'))
    if (pkg.name === HOST_PACKAGE) {
      version = releaseVersion(pkg.version)
      if (version !== 'unknown') versionSource = 'runtime-package'
    }
  } catch { /* ASAR virtual reads and optional metadata may be unavailable. */ }
  let mirrorExists = false
  try { mirrorExists = mirrorRoot !== null && stat(mirrorRoot).isDirectory() } catch { /* candidate only */ }
  return Object.freeze({
    entry, execPath, platform, version, versionSource, runtimeRoot, archivePath,
    mirrorRoot, mirrorExists, mirrorVerified: false,
  })
}
