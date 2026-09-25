# Viewtion — Functional Gap Audit

This audit evaluates the current state of Viewtion against the requirements of a production-grade Video Editor + Motion Designer + AI Creative Agent.

---

## 1. Timeline System

| Feature | Status | Details & Gap Analysis |
| :--- | :--- | :--- |
| **Clip Dragging (Horizontal)** | `MISSING` | Clips are statically rendered at `left = clip.start * zoom`. Pointer down/move/up dragging is missing. Must update `clip.start` in real-time with ghost preview, drop with `MoveClipCommand`, and respect undo/redo. |
| **Track Dragging (Vertical)** | `MISSING` | Clips cannot be dragged between tracks. Must allow moving clips between compatible tracks (video/graphics or audio). |
| **Edge Trimming** | `MISSING` | Left/right edge hover cursors and resize dragging are missing. Must update `in`/`start` or `out`/`duration` with immediate preview updates. |
| **Split / Blade Tool** | `PARTIAL` | `SplitClipCommand` exists in core, but shortcut (Cmd+B/B) and blade mode on timeline need smooth interactive cursor support. |
| **Multi-Selection & Box Select** | `MISSING` | Only single `clipId` is selected. Multi-selection via Cmd/Shift click and box drag selection marquee are needed. |
| **Magnetic Snapping** | `PARTIAL` | Math exists in `packages/video-engine`, but needs visual vertical snap line rendering on timeline canvas/DOM during drag. |
| **Playhead Dragging & Scrubbing** | `PARTIAL` | Clicking ruler moves playhead, but dragging/scrubbing across timeline with audio scrubbing and video frame synchronization needs continuous pointer capture. |
| **Ripple Delete** | `MISSING` | Delete exists, but ripple delete (deleting clip and shifting subsequent clips left to fill the gap) is missing. |
| **Copy / Paste / Duplicate** | `MISSING` | Cmd+C, Cmd+V, Cmd+D clip duplication on timeline with fresh IDs. |
| **Zoom & Pan** | `PARTIAL` | Slider zoom works, but mouse wheel (Cmd + wheel) and trackpad smooth horizontal panning need integration. |
| **Track Management** | `PARTIAL` | Track lock and visibility toggles exist in schema; Add Track (Video, Audio, Graphics) and track reordering are needed. |

---

## 2. Video Preview & Media Processing

| Feature | Status | Details & Gap Analysis |
| :--- | :--- | :--- |
| **Real Video Playback** | `PARTIAL` | Canvas renders placeholder video cards or static frames. Must support live HTMLVideoElement / WebCodecs playback with video frame seeking synchronized to the timeline clock. |
| **Audio-Video Synchronization** | `PARTIAL` | Timeline timer ticks, but audio playback via Web Audio API needs to be synchronized in lockstep with the video playhead. |
| **Media Drag-and-Drop to Timeline**| `MISSING` | Clicking asset adds to timeline, but dragging an asset directly from the Media Browser onto a timeline track with insertion ghost is missing. |
| **Finder / Desktop Drag-and-Drop** | `MISSING` | Need HTML5 Drag & Drop on the Media panel to import MP4, MOV, WebM, MP3, WAV, PNG, JPEG, SVG directly from file explorer. |
| **Direct Canvas Transform Gizmo** | `MISSING` | Selected video/image clip on canvas needs interactive bounding box with corner scaling handles and center translation. |
| **Speed Control** | `MISSING` | Speed multiplier in `BaseClip` exists in schema, but speed UI selector (0.25x to 4x) and timeline duration recalculation are needed. |
| **Crop Tool** | `MISSING` | Left/right/top/bottom crop properties on video clips with canvas mask/crop handles. |

---

## 3. Motion Editor

| Feature | Status | Details & Gap Analysis |
| :--- | :--- | :--- |
| **Interactive Canvas Manipulation** | `PARTIAL` | Canvas displays elements, but pointer dragging, corner scale handles, and rotation on the canvas need full interactive manipulation. |
| **Stopwatch & Keyframe Insertion** | `PARTIAL` | Command exists, but Inspector animatable properties need stopwatch icons that toggle keyframing at current playhead time. |
| **Timeline Keyframe Diamonds** | `PARTIAL` | Diamonds render statically; selecting, dragging keyframes along the timeline to adjust timing, and deleting keyframes are needed. |
| **Bezier Graph / Curve Editor** | `UI ONLY` | SVG curve renders decorative bezier path; dragging control handles to adjust cubic bezier points and easing needs interactivity. |
| **Layer Parenting & Groups** | `MISSING` | Hierarchical transform matrices where child layer inherits parent position/scale/rotation. |
| **Motion Presets** | `PARTIAL` | Hardcoded initial presets; need structured preset registry (Fade Up, Scale In, Pop, Elastic Reveal, Slide) applying typed keyframes. |
| **Vector Shapes & SVG** | `PARTIAL` | Rectangles and text render; circles, stroke styling, corner radius, and SVG vector rendering need complete controls. |

---

## 4. Audio Engine

| Feature | Status | Details & Gap Analysis |
| :--- | :--- | :--- |
| **Web Audio API Playback** | `MISSING` | Audio clips are silent; need Web Audio `AudioContext` connected to gain nodes for real audio output during playback. |
| **Real Audio Waveforms** | `PARTIAL` | Waveforms are procedurally generated peaks; need `AudioContext.decodeAudioData` to extract actual peak buffers from real audio files. |
| **Volume, Pan, Fade In/Out** | `PARTIAL` | Schema has `volume`, `fadeIn`, `fadeOut`, but Web Audio linear/exponential gain curves and Inspector slider controls need implementation. |
| **Beat Detection** | `MISSING` | Automatic beat marker generation on audio peaks to snap video cuts to rhythm. |

---

## 5. Effects & Transitions Pipeline

| Feature | Status | Details & Gap Analysis |
| :--- | :--- | :--- |
| **Real-time Color Grading** | `MISSING` | Brightness, Contrast, Saturation, Exposure, Temperature, Tint filters need real-time canvas 2D / WebGL shader filter application. |
| **Video Effects Stack** | `MISSING` | Blur, Sharpen, Vignette, Grayscale, Sepia, Glow in an editable stack on each clip with inspector parameter sliders. |
| **Transitions Pipeline** | `MISSING` | Cross Dissolve, Dip to Black, Dip to White, Slide, Push, Wipe between adjacent clips on the same track with visual duration handles. |

---

## 6. Rendering & Export

| Feature | Status | Details & Gap Analysis |
| :--- | :--- | :--- |
| **Live Composite Playback** | `WORKING` | Unified Compositor renders video tracks, text overlays, and dynamic motion compositions at matching timestamps. |
| **Dynamic Motion Linking** | `WORKING` | Motion compositions update live in video preview without intermediate flattening or raster export. |
| **Video Export** | `PARTIAL` | MediaRecorder canvas stream recorder exports WebM/MP4, but requires audio track mixdown and progress reporting. |

---

## 7. AI Control & Tools

| Feature | Status | Details & Gap Analysis |
| :--- | :--- | :--- |
| **AI Intent Router** | `WORKING` | Classifies VIDEO, MOTION, HYBRID, QUESTION accurately. |
| **Tool Dispatcher** | `WORKING` | Compiles AI plans to atomic `GroupedCommand`s with 100% single-step undo/redo. |
| **AI Editing Tool Coverage** | `PARTIAL` | Need complete coverage for clip speed, color grading, effects stack, transitions, and audio ducking. |

---

## 8. Project Management & Persistence

| Feature | Status | Details & Gap Analysis |
| :--- | :--- | :--- |
| **JSON Serialization & Validation**| `WORKING` | Strict Zod validation and `.viewtion` project import/export. |
| **Autosave & LocalStorage Cache** | `MISSING` | Debounced autosave to LocalStorage/IndexedDB so browser refreshes or desktop restarts restore work seamlessly. |
| **Recent Projects** | `PARTIAL` | Static mock cards in UI; needs dynamic recent-project list persisted in storage. |
