# AGENTS.md — Guidance for AI & Human Engineers

> **CRITICAL RULE:** All future coding agents and developers MUST read this document and `docs/ARCHITECTURE.md` before making architectural modifications.

---

## 1. What is Viewtion?
Viewtion is an AI-native desktop application that unifies **Video Editing** and **Motion Design** into one continuous creative environment with zero friction.
It is built with **Tauri 2**, **React**, **TypeScript**, and **Vite**.

## 2. Architectural Boundaries & Invariants
1. **The UI Never Owns Editing State Directly:**
   UI components do not manipulate project arrays or clip durations directly. All project mutations MUST go through `CommandBus.dispatch(new SomeCommand(...))`.
2. **Commands Are Sovereign:**
   Every command implements:
   - `execute()`: Mutates project state predictably.
   - `undo()`: Reverts the mutation exactly.
   - `redo()`: Re-applies the mutation.
   - `serialize()`: Converts the action into structured JSON for undo stacks and AI transaction logs.
3. **AI Uses the Exact Same API as Humans:**
   Never write a "backdoor" AI editing function that circumvents commands. AI tools MUST construct and execute typed commands so that human undo/redo works seamlessly.
4. **Non-Destructive Editing:**
   Never overwrite or alter source media files. All trim, cut, speed, transform, and effect values are instructions in the project schema.
5. **Universal Object Model:**
   Both Video clips and Motion layers share standard transforms (`position`, `scale`, `rotation`, `opacity`, `anchor`).

## 3. Project Format Rules (`.viewtion`)
- All projects are versioned with a top-level `schemaVersion`.
- Media files are referenced externally by relative or absolute paths (or asset IDs) — large binaries are never embedded in the project JSON.
- Motion Compositions are stored in `project.motionCompositions` and referenced in video tracks via `MotionCompositionClip`.

## 4. How to Add New Capabilities
- **Adding an AI Tool:**
  1. Define the tool schema with Zod in `packages/ai-tools`.
  2. Implement the tool handler by creating and dispatching commands via `editor-core`.
  3. Register the tool in `ToolRegistry` so both the internal AI Assistant and MCP server automatically gain access.
- **Adding an Effect / Transition:**
  1. Define effect parameters in `packages/project-schema`.
  2. Register the shader/compositor hook in `packages/render-engine` via `EffectRegistry`.
  3. Expose inspector controls in `packages/ui`.
- **Adding a Motion Template:**
  1. Define the procedural layer tree and parameter mappings in `packages/templates`.
  2. Register in `TemplateRegistry`.

## 5. Verification & Testing
Before committing:
```bash
npm run typecheck
npm run test
npm run build
```
Never leave the project in a broken or unbuildable state.
