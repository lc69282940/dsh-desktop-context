# dsh-desktop-context

[中文说明](<README.zh.md>) · [Changelog](<CHANGELOG.md>)

A host-only plugin that corrects inherited Web environment instructions in the **actual DeepSeek Harness Desktop system-prompt assembly**. It does not just append a reminder to the conversation.

**Release:** 0.1.0 · **Verified host:** Windows Desktop DSH 0.2.0-rc.2 · **Runtime:** Node 24+ · **License:** MIT

Independent community software, not an official DeepSeek product. It has no UI buttons, HTTP endpoint, bundled browser, or renderer script. It does not edit the application archive or replace core services.

## What it corrects

The verified Desktop build starts through shared Web application infrastructure. Its inherited `app:web-surface` section calls the native Electron window a Web GUI; `harness:source` calls an ASAR virtual path an on-disk checkout. This plugin replaces those **known exact templates** through the supported `system-prompt/assemble` waterfall.

The replacement explains:

- “This app/page/GUI” normally means the existing Electron window, not an Edge/Chrome tab. A loopback transport URL is not a request to open a browser.
- ASAR members are virtual paths. Extracted mirrors are not guaranteed current and editing them does not change packed application code.
- Refreshing the renderer can interrupt agents/jobs. Persist state and agree on an idle point before any necessary restart; do not refresh during the repair itself.
- Profile reconciliation, delivered client bundles, source builds, and host module caches are different update paths.
- Prefer actual native-window, configuration, log, and current-contract evidence over assumptions or idealized DOM tests.
- Check the code-work-view preference before diagnosing a missing Trajectory tab as a missing plugin.

The editable source text is [the desktop-surface prompt](<prompts/desktop-surface.md>). Host paths and transport facts are derived at runtime, not copied from the developer's machine.

## Scope and non-goals

- Activates only when the real process entry identifies `dsh-desktop-host`; a profile called desktop or a `DSH_WEB_URL` value alone is not evidence.
- Leaves genuine Web/CLI processes unchanged.
- Preserves tools, runtime policy/context, model variables, persona, and unrelated prompt sections.
- Does not replace unknown future templates or custom same-name text that differs from the verified template.
- A deliberate **complete prompt** still wins after the waterfall. This plugin will not force extra instructions into it.
- Makes no independent claim that a model will always follow the guidance; it corrects what is supplied, not model behavior.

This distributable was verified in isolated integration tests against the Windows Desktop 0.2.0-rc.2 runtime; it was not reinstalled into a live desktop for this release. Cross-platform path parsing has unit coverage, not a native macOS/Linux acceptance claim. The exact DSH peer range intentionally requires re-verification for future releases; optional peers prevent installing a separate host runtime.

## Install

Wait for active tasks to finish. In the **existing Desktop app → Plugins → Add plugin**, supply the absolute path of `dsh-desktop-context-0.1.0.tgz` (or its unpacked package directory if needed). Keep local package files at a durable path because the profile may retain its file dependency.

Alternatively, enable the **Desktop installation's bundled `dsh` command** through the native menu's command management and run:

```powershell
dsh plugin --profile desktop add "<absolute-path-to-dsh-desktop-context-0.1.0.tgz>"
```

An unrelated npm-installed `dsh` command may reject management of Electron's reserved desktop profile. Use the bundled command or native plugin manager, not a new Web/Vite server. Installation needs no compilation or lifecycle scripts. A supported installer enables the bundle and its host row together.

Once active, the correction participates in subsequent normal prompt assemblies, including ordinary new and child sessions. Previously sent prompts are not rewritten. If your host requires a later startup, wait for an idle point; this plugin never reloads or restarts anything for you.

For a local development installation with the same package name, back up the old files and uninstall that copy at an idle point before installing the archive. Do not mount two copies.

## Diagnostics

Best-effort diagnostics default to `$DSH_HOME/diagnostics/dsh-desktop-context/`; absent an explicit DSH home, the normal user `.dsh` directory is used. The installed package can remain read-only.

- `events.jsonl` appends metadata-only activation/assembly records and deduplicates unchanged assembly states. It has no total-file rotation; remove old diagnostics at an idle point if needed.
- `last-assembly.json` reports sanitized template states and fingerprint metadata, not prompt text or private paths.
- `DSH_DESKTOP_CONTEXT_DIAGNOSTICS` and `DSH_DESKTOP_CONTEXT_EVIDENCE` can select explicit complete file paths.

An assembly event is evidence that the hook ran. `agentContextPresent` means only that an agent field was supplied; it is **not proof of a provider request or a persisted system message**, and a complete prompt can override the result later. Verify final output independently when that distinction matters. No production logs or session dumps are bundled.

## Upgrade and uninstall

Use Desktop's plugin manager, or:

```powershell
dsh plugin --profile desktop remove dsh-desktop-context
```

Unload removes the hook; original official prompt assembly resumes on later steps. It does not delete conversations or revert saved profile settings. The plugin does not change those settings in the first place. If a future official build fixes its own text, re-check this plugin before widening its compatibility range.

## Develop and package

The runtime consists only of JavaScript and the prompt file, with no runtime npm dependencies or compilation. Full tests live in the source release.

```powershell
pnpm check
pnpm test
$env:DSH_TEST_RUNTIME_ROOT = '<verified-readable-DSH-runtime-directory>'
pnpm test:runtime
pnpm test:all
pnpm pack --pack-destination ../../dist
```

Pure tests need only Node. Runtime integration must explicitly point at a readable DSH root containing `node_modules`; an ASAR virtual path is not a regular directory. Compare an extracted mirror with the current archive before relying on it. Tests use real Cordis/SystemPrompt implementations in an isolated process and do not send model requests or write real conversations.
