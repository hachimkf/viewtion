import {
  Project,
  Track,
  Clip,
  Asset,
  MotionComposition,
  MotionLayer,
  Keyframe,
  createEmptyProject,
  validateProject,
} from '@viewtion/project-schema';

export interface ICommand {
  readonly id: string;
  readonly name: string;
  execute(project: Project): Project;
  undo(project: Project): Project;
  serialize(): { id: string; name: string; data?: any };
}

export type Listener<T> = (state: T) => void;

export class CommandHistory {
  private undoStack: ICommand[] = [];
  private redoStack: ICommand[] = [];
  private maxHistory: number = 100;

  constructor(maxHistory = 100) {
    this.maxHistory = maxHistory;
  }

  push(command: ICommand) {
    this.undoStack.push(command);
    if (this.undoStack.length > this.maxHistory) {
      this.undoStack.shift();
    }
    this.redoStack = [];
  }

  canUndo(): boolean {
    return this.undoStack.length > 0;
  }

  canRedo(): boolean {
    return this.redoStack.length > 0;
  }

  undo(project: Project): { project: Project; command?: ICommand } {
    const cmd = this.undoStack.pop();
    if (!cmd) return { project };
    const reverted = cmd.undo(project);
    this.redoStack.push(cmd);
    return { project: reverted, command: cmd };
  }

  redo(project: Project): { project: Project; command?: ICommand } {
    const cmd = this.redoStack.pop();
    if (!cmd) return { project };
    const executed = cmd.execute(project);
    this.undoStack.push(cmd);
    return { project: executed, command: cmd };
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }

  getUndoList(): string[] {
    return this.undoStack.map((c) => c.name);
  }

  getRedoList(): string[] {
    return this.redoStack.map((c) => c.name);
  }
}

// -------------------------------------------------------------
// Concrete Commands
// -------------------------------------------------------------

export class GroupedCommand implements ICommand {
  readonly id: string;
  readonly name: string;
  private commands: ICommand[];

  constructor(name: string, commands: ICommand[]) {
    this.id = `grp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    this.name = name;
    this.commands = commands;
  }

  execute(project: Project): Project {
    let current = project;
    for (const cmd of this.commands) {
      current = cmd.execute(current);
    }
    return current;
  }

  undo(project: Project): Project {
    let current = project;
    for (let i = this.commands.length - 1; i >= 0; i--) {
      current = this.commands[i].undo(current);
    }
    return current;
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      data: this.commands.map((c) => c.serialize()),
    };
  }
}

export class AddAssetCommand implements ICommand {
  readonly id = `add_asset_${Date.now()}`;
  readonly name: string;
  constructor(private asset: Asset) {
    this.name = `Add Asset "${asset.name}"`;
  }

  execute(project: Project): Project {
    return {
      ...project,
      updatedAt: new Date().toISOString(),
      assets: {
        ...project.assets,
        [this.asset.id]: this.asset,
      },
    };
  }

  undo(project: Project): Project {
    const newAssets = { ...project.assets };
    delete newAssets[this.asset.id];
    return {
      ...project,
      updatedAt: new Date().toISOString(),
      assets: newAssets,
    };
  }

  serialize() {
    return { id: this.id, name: this.name, data: this.asset };
  }
}

export class AddClipCommand implements ICommand {
  readonly id = `add_clip_${Date.now()}`;
  readonly name: string;
  constructor(private trackId: string, private clip: Clip) {
    this.name = `Add Clip "${clip.name}"`;
  }

  execute(project: Project): Project {
    return {
      ...project,
      updatedAt: new Date().toISOString(),
      timeline: {
        ...project.timeline,
        tracks: project.timeline.tracks.map((t) => {
          if (t.id === this.trackId) {
            return { ...t, clips: [...t.clips, this.clip] };
          }
          return t;
        }),
      },
    };
  }

  undo(project: Project): Project {
    return {
      ...project,
      updatedAt: new Date().toISOString(),
      timeline: {
        ...project.timeline,
        tracks: project.timeline.tracks.map((t) => {
          if (t.id === this.trackId) {
            return { ...t, clips: t.clips.filter((c) => c.id !== this.clip.id) };
          }
          return t;
        }),
      },
    };
  }

  serialize() {
    return { id: this.id, name: this.name, data: { trackId: this.trackId, clip: this.clip } };
  }
}

export class RemoveClipCommand implements ICommand {
  readonly id = `rem_clip_${Date.now()}`;
  readonly name = 'Remove Clip';
  private removedClip?: Clip;
  private trackId?: string;

  constructor(private clipId: string) {}

  execute(project: Project): Project {
    let foundTrack: Track | undefined;
    let foundClip: Clip | undefined;

    for (const t of project.timeline.tracks) {
      const c = t.clips.find((item) => item.id === this.clipId);
      if (c) {
        foundTrack = t;
        foundClip = c;
        break;
      }
    }

    if (!foundTrack || !foundClip) return project;
    this.removedClip = foundClip;
    this.trackId = foundTrack.id;

    return {
      ...project,
      updatedAt: new Date().toISOString(),
      timeline: {
        ...project.timeline,
        tracks: project.timeline.tracks.map((t) => {
          if (t.id === this.trackId) {
            return { ...t, clips: t.clips.filter((c) => c.id !== this.clipId) };
          }
          return t;
        }),
      },
    };
  }

  undo(project: Project): Project {
    if (!this.removedClip || !this.trackId) return project;
    return {
      ...project,
      updatedAt: new Date().toISOString(),
      timeline: {
        ...project.timeline,
        tracks: project.timeline.tracks.map((t) => {
          if (t.id === this.trackId) {
            return { ...t, clips: [...t.clips, this.removedClip!] };
          }
          return t;
        }),
      },
    };
  }

  serialize() {
    return { id: this.id, name: this.name, data: { clipId: this.clipId } };
  }
}

export class MoveClipCommand implements ICommand {
  readonly id = `move_clip_${Date.now()}`;
  readonly name = 'Move Clip';
  private prevStart: number = 0;
  private prevTrackId: string = '';

  constructor(
    private clipId: string,
    private newStart: number,
    private targetTrackId?: string
  ) {}

  execute(project: Project): Project {
    let clip: Clip | undefined;
    let srcTrack: Track | undefined;

    for (const t of project.timeline.tracks) {
      const found = t.clips.find((c) => c.id === this.clipId);
      if (found) {
        clip = found;
        srcTrack = t;
        break;
      }
    }

    if (!clip || !srcTrack) return project;
    this.prevStart = clip.start;
    this.prevTrackId = srcTrack.id;

    const destTrackId = this.targetTrackId || srcTrack.id;
    const updatedClip = { ...clip, start: Math.max(0, this.newStart) };

    if (destTrackId === srcTrack.id) {
      return {
        ...project,
        updatedAt: new Date().toISOString(),
        timeline: {
          ...project.timeline,
          tracks: project.timeline.tracks.map((t) => {
            if (t.id === destTrackId) {
              return {
                ...t,
                clips: t.clips.map((c) => (c.id === this.clipId ? updatedClip : c)),
              };
            }
            return t;
          }),
        },
      };
    } else {
      return {
        ...project,
        updatedAt: new Date().toISOString(),
        timeline: {
          ...project.timeline,
          tracks: project.timeline.tracks.map((t) => {
            if (t.id === srcTrack!.id) {
              return { ...t, clips: t.clips.filter((c) => c.id !== this.clipId) };
            }
            if (t.id === destTrackId) {
              return { ...t, clips: [...t.clips, updatedClip] };
            }
            return t;
          }),
        },
      };
    }
  }

  undo(project: Project): Project {
    const revert = new MoveClipCommand(this.clipId, this.prevStart, this.prevTrackId);
    return revert.execute(project);
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      data: { clipId: this.clipId, newStart: this.newStart, targetTrackId: this.targetTrackId },
    };
  }
}

export class TrimClipCommand implements ICommand {
  readonly id = `trim_clip_${Date.now()}`;
  readonly name = 'Trim Clip';
  private prevIn: number = 0;
  private prevOut: number = 0;
  private prevDuration: number = 0;
  private prevStart: number = 0;

  constructor(
    private clipId: string,
    private newStart: number,
    private newDuration: number,
    private newIn?: number,
    private newOut?: number
  ) {}

  execute(project: Project): Project {
    let targetClip: Clip | undefined;

    for (const t of project.timeline.tracks) {
      const c = t.clips.find((item) => item.id === this.clipId);
      if (c) {
        targetClip = c;
        break;
      }
    }

    if (!targetClip) return project;
    this.prevStart = targetClip.start;
    this.prevDuration = targetClip.duration;
    this.prevIn = targetClip.in;
    this.prevOut = targetClip.out;

    return {
      ...project,
      updatedAt: new Date().toISOString(),
      timeline: {
        ...project.timeline,
        tracks: project.timeline.tracks.map((t) => ({
          ...t,
          clips: t.clips.map((c) => {
            if (c.id === this.clipId) {
              return {
                ...c,
                start: Math.max(0, this.newStart),
                duration: Math.max(0.05, this.newDuration),
                in: this.newIn !== undefined ? this.newIn : c.in,
                out: this.newOut !== undefined ? this.newOut : c.out,
              };
            }
            return c;
          }),
        })),
      },
    };
  }

  undo(project: Project): Project {
    return new TrimClipCommand(
      this.clipId,
      this.prevStart,
      this.prevDuration,
      this.prevIn,
      this.prevOut
    ).execute(project);
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      data: {
        clipId: this.clipId,
        newStart: this.newStart,
        newDuration: this.newDuration,
        newIn: this.newIn,
        newOut: this.newOut,
      },
    };
  }
}

export class SplitClipCommand implements ICommand {
  readonly id = `split_clip_${Date.now()}`;
  readonly name = 'Split Clip';
  private createdClipId?: string;

  constructor(private clipId: string, private splitTime: number) {}

  execute(project: Project): Project {
    let foundTrack: Track | undefined;
    let originalClip: Clip | undefined;

    for (const t of project.timeline.tracks) {
      const c = t.clips.find((item) => item.id === this.clipId);
      if (c) {
        foundTrack = t;
        originalClip = c;
        break;
      }
    }

    if (!foundTrack || !originalClip) return project;
    const clipEnd = originalClip.start + originalClip.duration;
    if (this.splitTime <= originalClip.start || this.splitTime >= clipEnd) {
      return project; // Split outside bounds
    }

    const firstDuration = this.splitTime - originalClip.start;
    const secondDuration = originalClip.duration - firstDuration;

    this.createdClipId = `${originalClip.id}_split_${Date.now()}`;
    const secondClip: Clip = {
      ...originalClip,
      id: this.createdClipId,
      name: `${originalClip.name} (Part 2)`,
      start: this.splitTime,
      duration: secondDuration,
      in: originalClip.in + firstDuration * originalClip.speed,
    };

    return {
      ...project,
      updatedAt: new Date().toISOString(),
      timeline: {
        ...project.timeline,
        tracks: project.timeline.tracks.map((t) => {
          if (t.id === foundTrack!.id) {
            return {
              ...t,
              clips: t.clips.flatMap((c) => {
                if (c.id === this.clipId) {
                  const firstPart: Clip = {
                    ...c,
                    duration: firstDuration,
                    out: c.in + firstDuration * c.speed,
                  };
                  return [firstPart, secondClip];
                }
                return [c];
              }),
            };
          }
          return t;
        }),
      },
    };
  }

  undo(project: Project): Project {
    if (!this.createdClipId) return project;
    return {
      ...project,
      updatedAt: new Date().toISOString(),
      timeline: {
        ...project.timeline,
        tracks: project.timeline.tracks.map((t) => {
          const hasCreated = t.clips.some((c) => c.id === this.createdClipId);
          if (hasCreated) {
            const original = t.clips.find((c) => c.id === this.clipId);
            const created = t.clips.find((c) => c.id === this.createdClipId);
            const combinedDuration = (original?.duration || 0) + (created?.duration || 0);

            return {
              ...t,
              clips: t.clips
                .filter((c) => c.id !== this.createdClipId)
                .map((c) => {
                  if (c.id === this.clipId) {
                    return {
                      ...c,
                      duration: combinedDuration,
                      out: c.in + combinedDuration * c.speed,
                    };
                  }
                  return c;
                }),
            };
          }
          return t;
        }),
      },
    };
  }

  serialize() {
    return { id: this.id, name: this.name, data: { clipId: this.clipId, splitTime: this.splitTime } };
  }
}

// -------------------------------------------------------------
// Motion Composition Commands
// -------------------------------------------------------------

export class CreateMotionCompositionCommand implements ICommand {
  readonly id = `create_motion_comp_${Date.now()}`;
  readonly name: string;

  constructor(private composition: MotionComposition) {
    this.name = `Create Motion Comp "${composition.name}"`;
  }

  execute(project: Project): Project {
    return {
      ...project,
      updatedAt: new Date().toISOString(),
      motionCompositions: {
        ...project.motionCompositions,
        [this.composition.id]: this.composition,
      },
    };
  }

  undo(project: Project): Project {
    const updated = { ...project.motionCompositions };
    delete updated[this.composition.id];
    return {
      ...project,
      updatedAt: new Date().toISOString(),
      motionCompositions: updated,
    };
  }

  serialize() {
    return { id: this.id, name: this.name, data: this.composition };
  }
}

export class AddLayerCommand implements ICommand {
  readonly id = `add_layer_${Date.now()}`;
  readonly name: string;

  constructor(private compositionId: string, private layer: MotionLayer) {
    this.name = `Add Layer "${layer.name}"`;
  }

  execute(project: Project): Project {
    const comp = project.motionCompositions[this.compositionId];
    if (!comp) return project;

    return {
      ...project,
      updatedAt: new Date().toISOString(),
      motionCompositions: {
        ...project.motionCompositions,
        [this.compositionId]: {
          ...comp,
          layers: [...comp.layers, this.layer],
        },
      },
    };
  }

  undo(project: Project): Project {
    const comp = project.motionCompositions[this.compositionId];
    if (!comp) return project;

    return {
      ...project,
      updatedAt: new Date().toISOString(),
      motionCompositions: {
        ...project.motionCompositions,
        [this.compositionId]: {
          ...comp,
          layers: comp.layers.filter((l) => l.id !== this.layer.id),
        },
      },
    };
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      data: { compositionId: this.compositionId, layer: this.layer },
    };
  }
}

export class SetLayerPropertyCommand implements ICommand {
  readonly id = `set_layer_prop_${Date.now()}`;
  readonly name: string;
  private prevValue: any;

  constructor(
    private compositionId: string,
    private layerId: string,
    private propertyPath: string,
    private newValue: any
  ) {
    this.name = `Set ${propertyPath} on Layer`;
  }

  execute(project: Project): Project {
    const comp = project.motionCompositions[this.compositionId];
    if (!comp) return project;

    const layer = comp.layers.find((l) => l.id === this.layerId);
    if (!layer) return project;

    // Save previous value for undo
    this.prevValue = this.getValueByPath(layer, this.propertyPath);
    const updatedLayer = this.setValueByPath(JSON.parse(JSON.stringify(layer)), this.propertyPath, this.newValue);

    return {
      ...project,
      updatedAt: new Date().toISOString(),
      motionCompositions: {
        ...project.motionCompositions,
        [this.compositionId]: {
          ...comp,
          layers: comp.layers.map((l) => (l.id === this.layerId ? updatedLayer : l)),
        },
      },
    };
  }

  undo(project: Project): Project {
    if (this.prevValue === undefined) return project;
    return new SetLayerPropertyCommand(
      this.compositionId,
      this.layerId,
      this.propertyPath,
      this.prevValue
    ).execute(project);
  }

  private getValueByPath(obj: any, path: string): any {
    const parts = path.split('.');
    let curr = obj;
    for (const p of parts) {
      if (curr === undefined || curr === null) return undefined;
      curr = curr[p];
    }
    return curr;
  }

  private setValueByPath(obj: any, path: string, val: any): any {
    const parts = path.split('.');
    let curr = obj;
    for (let i = 0; i < parts.length - 1; i++) {
      if (!curr[parts[i]]) curr[parts[i]] = {};
      curr = curr[parts[i]];
    }
    curr[parts[parts.length - 1]] = val;
    return obj;
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      data: {
        compositionId: this.compositionId,
        layerId: this.layerId,
        propertyPath: this.propertyPath,
        newValue: this.newValue,
      },
    };
  }
}

export class AddKeyframeCommand implements ICommand {
  readonly id = `add_kf_${Date.now()}`;
  readonly name: string;
  private prevKeyframes?: Keyframe[];

  constructor(
    private compositionId: string,
    private layerId: string,
    private propertyName: string,
    private keyframe: Keyframe
  ) {
    this.name = `Add Keyframe at ${keyframe.time}s`;
  }

  execute(project: Project): Project {
    const comp = project.motionCompositions[this.compositionId];
    if (!comp) return project;
    const layer = comp.layers.find((l) => l.id === this.layerId);
    if (!layer) return project;

    const existingKfs = layer.keyframes?.[this.propertyName] || [];
    this.prevKeyframes = [...existingKfs];

    // Filter out keyframe at exact same time if exists, then sort
    const filtered = existingKfs.filter((k) => Math.abs(k.time - this.keyframe.time) > 0.001);
    const updated = [...filtered, this.keyframe].sort((a, b) => a.time - b.time);

    return {
      ...project,
      updatedAt: new Date().toISOString(),
      motionCompositions: {
        ...project.motionCompositions,
        [this.compositionId]: {
          ...comp,
          layers: comp.layers.map((l) => {
            if (l.id === this.layerId) {
              return {
                ...l,
                keyframes: {
                  ...(l.keyframes || {}),
                  [this.propertyName]: updated,
                },
              };
            }
            return l;
          }),
        },
      },
    };
  }

  undo(project: Project): Project {
    if (!this.prevKeyframes) return project;
    const comp = project.motionCompositions[this.compositionId];
    if (!comp) return project;

    return {
      ...project,
      updatedAt: new Date().toISOString(),
      motionCompositions: {
        ...project.motionCompositions,
        [this.compositionId]: {
          ...comp,
          layers: comp.layers.map((l) => {
            if (l.id === this.layerId) {
              return {
                ...l,
                keyframes: {
                  ...(l.keyframes || {}),
                  [this.propertyName]: this.prevKeyframes!,
                },
              };
            }
            return l;
          }),
        },
      },
    };
  }

  serialize() {
    return {
      id: this.id,
      name: this.name,
      data: {
        compositionId: this.compositionId,
        layerId: this.layerId,
        propertyName: this.propertyName,
        keyframe: this.keyframe,
      },
    };
  }
}

// -------------------------------------------------------------
// Editor Core Store
// -------------------------------------------------------------

export class ProjectStore {
  private project: Project;
  private history: CommandHistory;
  private listeners: Set<Listener<Project>> = new Set();
  private currentTime: number = 0; // seconds
  private isPlaying: boolean = false;
  private timeListeners: Set<Listener<number>> = new Set();

  constructor(initialProject?: Project) {
    this.project = initialProject || createEmptyProject();
    this.history = new CommandHistory();
  }

  getProject(): Project {
    return this.project;
  }

  setProject(newProject: Project) {
    const validated = validateProject(newProject);
    if (!validated.success) {
      throw new Error(`Invalid project schema: ${validated.error}`);
    }
    this.project = validated.data;
    this.history.clear();
    this.notify();
  }

  dispatch(command: ICommand): void {
    this.project = command.execute(this.project);
    this.history.push(command);
    this.notify();
  }

  undo(): boolean {
    if (!this.history.canUndo()) return false;
    const result = this.history.undo(this.project);
    this.project = result.project;
    this.notify();
    return true;
  }

  redo(): boolean {
    if (!this.history.canRedo()) return false;
    const result = this.history.redo(this.project);
    this.project = result.project;
    this.notify();
    return true;
  }

  canUndo(): boolean {
    return this.history.canUndo();
  }

  canRedo(): boolean {
    return this.history.canRedo();
  }

  subscribe(listener: Listener<Project>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    for (const listener of this.listeners) {
      listener(this.project);
    }
  }

  // Playhead & Playback controls
  getCurrentTime(): number {
    return this.currentTime;
  }

  setCurrentTime(time: number) {
    const clamped = Math.max(0, Math.min(this.project.settings.duration, time));
    this.currentTime = clamped;
    for (const l of this.timeListeners) {
      l(this.currentTime);
    }
  }

  subscribeTime(listener: Listener<number>): () => void {
    this.timeListeners.add(listener);
    return () => this.timeListeners.delete(listener);
  }

  toJSON(): string {
    return JSON.stringify(this.project, null, 2);
  }

  fromJSON(jsonString: string): boolean {
    try {
      const parsed = JSON.parse(jsonString);
      const validated = validateProject(parsed);
      if (validated.success) {
        this.setProject(validated.data);
        return true;
      }
      console.error('Project validation error:', validated.error);
      return false;
    } catch (e) {
      console.error('Failed to parse project JSON:', e);
      return false;
    }
  }
}

// -------------------------------------------------------------
// Contextual Selection Manager
// -------------------------------------------------------------

export interface SelectionState {
  type: 'none' | 'clip' | 'layer' | 'asset' | 'composition';
  id?: string;
  secondaryId?: string; // e.g. compositionId when a layer is selected
}

export class SelectionStore {
  private selection: SelectionState = { type: 'none' };
  private listeners: Set<Listener<SelectionState>> = new Set();

  getSelection(): SelectionState {
    return this.selection;
  }

  select(state: SelectionState) {
    this.selection = state;
    for (const l of this.listeners) {
      l(this.selection);
    }
  }

  clear() {
    this.select({ type: 'none' });
  }

  subscribe(listener: Listener<SelectionState>): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
}
