# AGENTS.md

Offline Draw.io editor plugin for Orca desktop (`sandboxed-ui` / `customEditors`).

## Critical Rules

- **Source of Truth**: Edit code under `build/src/` (`bootstrap.js`, `editor.js`), not generated files in `editor/`.
- **Zero External Network**: All resources, fonts, and stencils must load locally from relative paths. No remote CDNs, blob scripts, or external API calls.
- **Isolated Frame Architecture**: The editor executes inside an isolated Chromium frame (`frame: isolated`). Host communication occurs strictly through the Orca document bridge.
- **No Direct Dependency Bloat**: Maintain zero-dependency builds using standard Node.js built-in modules (`node:fs`, `node:path`, etc.).

## Project Structure

- `orca-plugin.json`: Plugin manifest registering custom editor and templates.
- `build/src/`: Source code for the editor integration and bootstrapping.
  - `bootstrap.js`: Environment initialization and theme listener.
  - `editor.js`: Bridge between Orca editor APIs and draw.io graph model.
- `build/build.mjs`: Build script packaging upstream draw.io assets into `editor/`.
- `build/tests/`: End-to-end and integration tests run via Playwright.
- `editor/`: Generated distribution bundle (do not edit manually).

## Workflow Commands

- **Build**:
  ```sh
  DRAWIO_DIR=/path/to/drawio node build/build.mjs
  ```
- **Local Preview**:
  ```sh
  node build/preview.mjs
  ```
- **Run Tests**:
  ```sh
  node build/tests/editor.test.mjs
  ```

## Code Guidelines

- **Vanilla JavaScript**: Use clean, modern vanilla JS (ES modules). Do not introduce UI frameworks (React, Vue, etc.).
- **Debounced Sync**: Synchronize document changes to Orca with debounce (~200ms) and always await `editor.flush` before saves.
- **Safety Boundaries**: Respect hard limits on diagram sizes (max 16 MB uncompressed, 8 MB compressed, 100 pages, 100k XML elements). Never overwrite corrupt XML with empty graphs.

## Agent skills

### Issue tracker

GitHub Issues via `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Canonical 5-role triage vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout (`CONTEXT.md` + `docs/adr/`). See `docs/agents/domain.md`.

