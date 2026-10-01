import { desktopFacts } from './runtime.js'
import { rewriteAssembly } from './prompt.js'
import { createDiagnostics } from './diagnostics.js'

export const name = 'dsh-desktop-context'
export const inject = ['systemPrompt']

function localTransport(ctx) {
  try {
    const port = ctx.get?.('webServer')?.port
    return Number.isInteger(port) && port > 0 && port <= 65535 ? `http://127.0.0.1:${port}` : undefined
  } catch { return undefined } // An optional service is not a boot requirement.
}

/**
 * One supported assembly waterfall with explicit Cordis effect ownership.
 * No routes, client bundle, process control, sessions, permissions, or service
 * replacement. A function apply remains constructible by the official loader.
 */
export function apply(ctx) {
  const facts = desktopFacts()
  if (!facts) return // Genuine Web/CLI hosts have no hooks or diagnostic writes.
  const diagnostics = createDiagnostics({
    facts,
    dshHomePath: () => ctx.get?.('dshHomePath')?.(),
  })
  ctx.effect(() => {
    const off = ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
      const original = await next() // Keep downstream errors and waterfall ordering intact.
      const result = rewriteAssembly(original, facts, localTransport(ctx))
      diagnostics.assembled(original, result, context)
      return result
    }, { global: true, prepend: true })
    ctx.emit('system-prompt/change')
    diagnostics.active()
    return () => {
      off()
      ctx.emit('system-prompt/change')
      diagnostics.disposed()
    }
  }, 'dsh-desktop-context: desktop environment prompt correction')
}
