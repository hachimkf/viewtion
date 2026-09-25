# Viewtion — Phase 0: Research & Reference Analysis

This document details the architectural evaluation of primary references and core libraries for **Viewtion**:
- **OpenReel Video** (Video Editor Reference)
- **Motion Canvas** (Motion Engine Reference)
- **MediaBunny** (Media Demuxing/Muxing & Codec Reference)
- **Tauri 2** (Desktop Shell & Native Services)

---

## 1. Upstream Projects & Licenses

| Project | License | Primary Capabilities | Architectural Fit |
| :--- | :--- | :--- | :--- |
| **OpenReel Video** (`Augani/openreel-video`) | MIT | In-browser multi-track video timeline, WebCodecs decoding, WebGPU preview, clip/track data model, audio waveform visualization, export pipeline | High reference value for timeline virtualization, track data structures, and WebCodecs playback synchronization. |
| **Motion Canvas** (`motion-canvas/motion-canvas`) | MIT | 2D vector animation runtime, declarative scene graph, keyframing, Bezier curve evaluation, spring physics, easing presets, canvas rendering | Excellent engine reference for procedural keyframing, property interpolation, bezier handles, and vector graph rendering. |
| **MediaBunny** (`Vanilagy/mediabunny`) | MPL-2.0 | Pure TypeScript media container demuxer & muxer (MP4, WebM, MOV, WAV, etc.), WebCodecs acceleration, streaming zero-dependency pipeline | Ideal browser-native media container toolkit. Clean API for timeline frame seeking, audio extraction, and final mp4 export. |
| **Tauri 2** (`tauri-apps/tauri`) | MIT / Apache 2.0 | Lightweight desktop shell with multi-window capabilities, native file dialogs, secure file system access, hardware bridge | Industry standard for lightweight, low-RAM desktop applications. Avoids Electron memory overhead. |

---

## 2. Component Evaluation: Reuse vs. Adapt vs. Rewrite vs. Exclude

### A. Video Timeline & Clip Engine (OpenReel Reference)
- **What to Adapt:**
  - Multi-track timeline time-scale calculations (seconds to pixels, zoom levels, snapping grid).
  - WebCodecs video frame caching and scrubbing strategy.
  - Audio waveform peak generation logic using Web Audio API (`OfflineAudioContext`).
- **What to Rewrite (Viewtion-Owned):**
  - **Project & Track State:** OpenReel couples timeline state tightly to monolithic Zustand web stores. Viewtion requires a strictly decoupled command-based core (`execute()`, `undo()`, `redo()`) that both human UI and AI tools call identically.
  - **Non-destructive Clip Model:** Clips in Viewtion must support standard transformations, trim ranges (`in`, `out`), dynamic linking to Motion Compositions, and universal transform properties.
- **What to Exclude:**
  - OpenReel's web-hosting wrapper, full website UI, cloud-sync assumptions, and direct DOM mutations.

### B. Motion Engine & Animation Graph (Motion Canvas Reference)
- **What to Adapt:**
  - Keyframe interpolation algorithms: Linear, Ease In/Out, Cubic, Exponential, Back, Elastic, and Spring dynamics.
  - Cubic Bezier curve math (`solveCubicBezier(t, p1x, p1y, p2x, p2y)`) for professional graph editor curves.
  - 2D canvas transform hierarchy (parenting, anchor points, scale/rotation matrices).
- **What to Rewrite (Viewtion-Owned):**
  - Interactive layer rendering pipeline: Motion Canvas uses code-first TypeScript generator functions (`yield* all(...)`), whereas Viewtion Motion Editor requires an interactive, keyframe-driven visual timeline with real-time UI manipulation and AI tool execution.
  - Unified layer model: Shapes (rectangles, circles, paths), Text layers, SVG layers, and nested Motion Compositions.
- **What to Exclude:**
  - Generator-based code-only runtime as the primary editing interface. Viewtion requires keyframe arrays and bezier handles that can be visually tweaked in the inspector and curve editor or manipulated via AI commands.

### C. Media Demuxing & Export (MediaBunny Reference)
- **What to Reuse & Integrate:**
  - MediaBunny container demuxing and muxing for MP4, WebM, and WAV.
  - WebCodecs `VideoDecoder` and `VideoEncoder` pipeline for lightning-fast hardware-accelerated processing without shipping heavy FFmpeg binaries into the primary interactive loop.
- **Fallback / Native Strategy:**
  - Rust/Tauri handles native file streaming and OS file system calls.
  - Optional native FFmpeg sidecar can be invoked only for esoteric formats or complex container remuxing, keeping standard editing 100% lightweight and fast.

### D. Desktop Shell (Tauri 2)
- **What to Reuse:**
  - Tauri 2 Core, Window management (`video` window, `motion` window, or integrated dual-mode workspace), native menus, and native open/save dialogs.
- **Design Decision:**
  - Desktop windowing: Support both single unified dual-workspace switching (tabbed/split) and dedicated multi-window detachment. The initial v0.1 provides seamless mode switching (Home / Video Editor / Motion Editor / AI Assistant) with instantaneous state sharing in the same runtime memory space.

---

## 3. License Compliance & Attribution

1. **OpenReel Video:** MIT License. Requires preserving the copyright notice and license text in `THIRD_PARTY_NOTICES.md`.
2. **Motion Canvas:** MIT License. Reused math/algorithms and concepts will retain MIT notices.
3. **MediaBunny:** MPL-2.0. If unmodified and consumed as a library, commercial distribution is fully permitted without copyleft viral effect on the surrounding Viewtion codebase. Any direct modifications to MediaBunny core files will be maintained under MPL-2.0.
4. **Tauri:** MIT / Apache-2.0. Standard permissive notice.

---

## 4. Key Architectural Takeaways

1. **Unified Command Pattern:** Everything originates from a single `CommandBus` (`packages/editor-core`).
2. **Universal Object Model:** Video clips, audio tracks, text overlays, and Motion Compositions all implement `BaseClip` / `BaseLayer` with shared transform attributes (`position`, `scale`, `rotation`, `opacity`, `anchor`).
3. **Motion Composition as a First-Class Clip:** In the Video timeline, a Motion Composition is simply a `MotionCompositionClip` with a referenced `compositionId`. The video preview canvas renders the motion composition at current relative time `t = (timelineTime - clip.start) * speed`.
4. **AI-Native Tool Layer:** AI agents (both internal assistant and external MCP clients) invoke the exact same typed commands as the UI buttons, guaranteeing safety, schema validation, and instant undo/redo.
