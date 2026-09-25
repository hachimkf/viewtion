import { describe, it, expect } from 'vitest';
import { createEmptyProject, validateProject, VideoClip, MotionCompositionClip } from '../packages/project-schema/src';
import {
  ProjectStore,
  AddClipCommand,
  TrimClipCommand,
  SplitClipCommand,
  DuplicateClipCommand,
  RippleDeleteClipCommand,
  SetClipPropertyCommand,
  AddTrackCommand,
  CreateMotionCompositionCommand,
} from '../packages/editor-core/src';
import { solveCubicBezier, evaluateEasing, interpolateValue } from '../packages/motion-engine/src';
import { AIRouter, LocalHeuristicProvider } from '../packages/ai-core/src';
import { ToolDispatcher } from '../packages/ai-tools/src';

describe('Project Schema & Serialization', () => {
  it('creates valid empty project with schemaVersion', () => {
    const p = createEmptyProject('Test Project');
    expect(p.schemaVersion).toBe('1.0.0');
    expect(p.name).toBe('Test Project');
    expect(p.timeline.tracks.length).toBe(3);

    const validation = validateProject(p);
    expect(validation.success).toBe(true);
  });
});

describe('Command Bus & Undo/Redo System', () => {
  it('adds a clip and successfully undoes and redoes', () => {
    const store = new ProjectStore();
    const clip: VideoClip = {
      id: 'clip_test_1',
      name: 'Test Clip',
      type: 'video',
      assetId: 'asset_1',
      start: 2,
      duration: 5,
      in: 0,
      out: 5,
      speed: 1,
      opacity: 1,
      locked: false,
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
      },
    };

    store.dispatch(new AddClipCommand('track_video_1', clip));
    expect(store.getProject().timeline.tracks[1].clips.length).toBe(1);

    // Undo
    expect(store.canUndo()).toBe(true);
    store.undo();
    expect(store.getProject().timeline.tracks[1].clips.length).toBe(0);

    // Redo
    expect(store.canRedo()).toBe(true);
    store.redo();
    expect(store.getProject().timeline.tracks[1].clips.length).toBe(1);
  });

  it('correctly splits a clip at a given timestamp non-destructively', () => {
    const store = new ProjectStore();
    const clip: VideoClip = {
      id: 'clip_to_split',
      name: 'Footage',
      type: 'video',
      assetId: 'asset_1',
      start: 0,
      duration: 10,
      in: 0,
      out: 10,
      speed: 1,
      opacity: 1,
      locked: false,
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
      },
    };

    store.dispatch(new AddClipCommand('track_video_1', clip));
    store.dispatch(new SplitClipCommand('clip_to_split', 4));

    const clips = store.getProject().timeline.tracks[1].clips;
    expect(clips.length).toBe(2);
    expect(clips[0].duration).toBe(4);
    expect(clips[1].start).toBe(4);
    expect(clips[1].duration).toBe(6);

    // Undo restores single unified clip
    store.undo();
    const reverted = store.getProject().timeline.tracks[1].clips;
    expect(reverted.length).toBe(1);
    expect(reverted[0].duration).toBe(10);
  });

  it('duplicates a clip with fresh ID at clip end', () => {
    const store = new ProjectStore();
    const clip: VideoClip = {
      id: 'clip_dup',
      name: 'Original',
      type: 'video',
      assetId: 'asset_1',
      start: 2,
      duration: 5,
      in: 0,
      out: 5,
      speed: 1,
      opacity: 1,
      locked: false,
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
      },
    };

    store.dispatch(new AddClipCommand('track_video_1', clip));
    store.dispatch(new DuplicateClipCommand('clip_dup'));

    const clips = store.getProject().timeline.tracks[1].clips;
    expect(clips.length).toBe(2);
    expect(clips[1].start).toBe(7); // starts at 2 + 5

    store.undo();
    expect(store.getProject().timeline.tracks[1].clips.length).toBe(1);
  });

  it('performs ripple delete shifting following clips left', () => {
    const store = new ProjectStore();
    const c1: VideoClip = {
      id: 'c1',
      name: 'Clip 1',
      type: 'video',
      assetId: 'a1',
      start: 0,
      duration: 4,
      in: 0,
      out: 4,
      speed: 1,
      opacity: 1,
      locked: false,
      transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, anchor: { x: 0.5, y: 0.5 } },
    };
    const c2: VideoClip = {
      id: 'c2',
      name: 'Clip 2',
      type: 'video',
      assetId: 'a2',
      start: 4,
      duration: 6,
      in: 0,
      out: 6,
      speed: 1,
      opacity: 1,
      locked: false,
      transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, anchor: { x: 0.5, y: 0.5 } },
    };

    store.dispatch(new AddClipCommand('track_video_1', c1));
    store.dispatch(new AddClipCommand('track_video_1', c2));

    // Ripple delete c1 (duration 4)
    store.dispatch(new RippleDeleteClipCommand('c1'));

    const clips = store.getProject().timeline.tracks[1].clips;
    expect(clips.length).toBe(1);
    expect(clips[0].id).toBe('c2');
    expect(clips[0].start).toBe(0); // shifted from 4 to 0

    // Undo restores c1 and original c2 position
    store.undo();
    const restored = store.getProject().timeline.tracks[1].clips;
    expect(restored.length).toBe(2);
    expect(restored[1].start).toBe(4);
  });

  it('updates clip properties and supports undo', () => {
    const store = new ProjectStore();
    const clip: VideoClip = {
      id: 'c_prop',
      name: 'Test',
      type: 'video',
      assetId: 'a1',
      start: 0,
      duration: 5,
      in: 0,
      out: 5,
      speed: 1,
      opacity: 1,
      locked: false,
      transform: { position: { x: 0, y: 0 }, scale: { x: 1, y: 1 }, rotation: 0, anchor: { x: 0.5, y: 0.5 } },
    };

    store.dispatch(new AddClipCommand('track_video_1', clip));
    store.dispatch(new SetClipPropertyCommand('c_prop', 'speed', 2));

    const updated = store.getProject().timeline.tracks[1].clips[0];
    expect(updated.speed).toBe(2);

    store.undo();
    expect(store.getProject().timeline.tracks[1].clips[0].speed).toBe(1);
  });

  it('adds a new track and undoes correctly', () => {
    const store = new ProjectStore();
    const initialTracks = store.getProject().timeline.tracks.length;

    store.dispatch(new AddTrackCommand('video', 'Video 2'));
    expect(store.getProject().timeline.tracks.length).toBe(initialTracks + 1);

    store.undo();
    expect(store.getProject().timeline.tracks.length).toBe(initialTracks);
  });
});

describe('Motion Engine Mathematics', () => {
  it('evaluates cubic bezier curve correctly', () => {
    const val0 = solveCubicBezier(0, 0.42, 0, 0.58, 1);
    const val1 = solveCubicBezier(1, 0.42, 0, 0.58, 1);
    expect(val0).toBeCloseTo(0, 3);
    expect(val1).toBeCloseTo(1, 3);

    const mid = solveCubicBezier(0.5, 0.42, 0, 0.58, 1);
    expect(mid).toBeGreaterThan(0.2);
    expect(mid).toBeLessThan(0.8);
  });

  it('interpolates numeric keyframes with easing', () => {
    const keyframes = [
      { id: '1', time: 0, value: 100, easing: 'linear' as const },
      { id: '2', time: 2, value: 200, easing: 'linear' as const },
    ];

    expect(interpolateValue(keyframes, 0, 0)).toBe(100);
    expect(interpolateValue(keyframes, 1, 0)).toBe(150);
    expect(interpolateValue(keyframes, 2, 0)).toBe(200);
  });
});

describe('AI Intent Router & Tool Bus', () => {
  it('classifies motion prompts correctly', () => {
    expect(AIRouter.classify('Animate this logo with a smooth reveal')).toBe('MOTION');
  });

  it('classifies video prompts correctly', () => {
    expect(AIRouter.classify('Cut the silences and trim the clip')).toBe('VIDEO');
  });

  it('generates an AI plan and executes as undoable grouped command', async () => {
    const store = new ProjectStore();
    const provider = new LocalHeuristicProvider();

    const plan = await provider.generatePlan(
      'Animate this logo with a smooth reveal',
      store.getProject(),
      { type: 'none' }
    );

    expect(plan.steps.length).toBeGreaterThan(0);
    ToolDispatcher.applyPlan(store, plan);

    // Verify composition was created
    const comps = Object.values(store.getProject().motionCompositions);
    expect(comps.length).toBeGreaterThan(0);

    // Verify it is completely undoable in one step
    expect(store.canUndo()).toBe(true);
    store.undo();
    expect(Object.values(store.getProject().motionCompositions).length).toBe(0);
  });
});
