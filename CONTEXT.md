# Draw.io Orca Plugin

An offline Draw.io diagram editor plugin for Orca desktop that runs inside a sandboxed Chromium frame.

## Language

**Isolated Frame**:
A sandboxed Chromium iframe with an opaque origin and strict Content Security Policy where the Draw.io editor runs offline without external network or storage access.
_Avoid_: Webview, popup, sandbox tab

**Document Bridge**:
The communication API (`window.orca.document` and `editor.flush`) linking the editor state to Orca's text buffer.
_Avoid_: Sync engine, host API

**Resource Bundle**:
The pre-packaged collection of offline XML stylesheets, UI stencils, and localization text loaded by the editor at runtime.
_Avoid_: Asset pack, locale pack

**Diagram Model**:
The in-memory and serialized XML graph representation (`mxGraphModel` / `mxfile`) of the active drawing.
_Avoid_: Canvas data, project file
