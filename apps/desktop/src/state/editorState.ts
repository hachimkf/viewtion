import { useState, useEffect } from 'react';
import { Project, createEmptyProject, MotionComposition, VideoClip, MotionCompositionClip, AudioClip } from '@viewtion/project-schema';
import { ProjectStore, SelectionStore, AddClipCommand, AddAssetCommand, CreateMotionCompositionCommand, AddLayerCommand } from '@viewtion/editor-core';
import { UnifiedCompositor } from '@viewtion/render-engine';
import { generateWaveformPeaks } from '@viewtion/video-engine';

export type ActiveWorkspace = 'home' | 'video' | 'motion' | 'ai';

// Initialize default sample project matching the user's mockup ("Brink's Event Reel")
function initStarterProject(): Project {
  const p = createEmptyProject("Brink's Event Reel");

  // Sample Assets
  p.assets['asset_c001'] = {
    id: 'asset_c001',
    name: 'C001.mov',
    type: 'video',
    src: '',
    duration: 12.0,
    width: 1080,
    height: 1350,
    thumbnail: 'https://images.unsplash.com/photo-1579783900882-c0d3dad7b119?w=300&q=80',
  };
  p.assets['asset_c002'] = {
    id: 'asset_c002',
    name: 'C002.mov',
    type: 'video',
    src: '',
    duration: 8.5,
    width: 1080,
    height: 1350,
    thumbnail: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=300&q=80',
  };
  p.assets['asset_music'] = {
    id: 'asset_music',
    name: 'Upbeat_Vibe.mp3',
    type: 'audio',
    src: '',
    duration: 90.0,
    waveform: generateWaveformPeaks(120),
  };

  // Sample Motion Composition ("Logo Reveal" & "Title 01")
  const logoRevealComp: MotionComposition = {
    id: 'comp_logo_reveal',
    name: 'Logo Reveal',
    width: 1080,
    height: 1350,
    fps: 30,
    duration: 6.0,
    backgroundColor: '#0D0D10',
    layers: [
      {
        id: 'layer_bg',
        name: 'Background',
        type: 'shape',
        shapeType: 'rect',
        width: 1080,
        height: 1350,
        fill: '#121217',
        start: 0,
        duration: 6,
        visible: true,
        locked: true,
        transform: {
          position: { x: 540, y: 675 },
          scale: { x: 1, y: 1 },
          rotation: 0,
          anchor: { x: 0.5, y: 0.5 },
        },
        opacity: 1,
        blending: 'normal',
        keyframes: {},
      },
      {
        id: 'layer_shape_01',
        name: 'Shape 01',
        type: 'shape',
        shapeType: 'rect',
        width: 280,
        height: 280,
        fill: '#E2F952',
        cornerRadius: 48,
        start: 0,
        duration: 6,
        visible: true,
        locked: false,
        transform: {
          position: { x: 420, y: 675 },
          scale: { x: 1, y: 1 },
          rotation: -12,
          anchor: { x: 0.5, y: 0.5 },
        },
        opacity: 0.9,
        blending: 'normal',
        keyframes: {
          'rotation': [
            { id: 'kf_rot_1', time: 0, value: -45, easing: 'easeInOut' },
            { id: 'kf_rot_2', time: 3, value: 0, easing: 'easeInOut' },
          ],
          'scale.x': [
            { id: 'kf_s1', time: 0, value: 0.6, easing: 'elastic' },
            { id: 'kf_s2', time: 2, value: 1.0, easing: 'elastic' },
          ],
        },
      },
      {
        id: 'layer_text_01',
        name: 'Text 01',
        type: 'text',
        text: 'Shape\nIdeas\nInto\nMotion',
        fontSize: 64,
        fontFamily: 'Inter, sans-serif',
        fill: '#FFFFFF',
        lineHeight: 1.1,
        alignment: 'left',
        start: 0,
        duration: 6,
        visible: true,
        locked: false,
        transform: {
          position: { x: 580, y: 675 },
          scale: { x: 1, y: 1 },
          rotation: 0,
          anchor: { x: 0.5, y: 0.5 },
        },
        opacity: 1,
        blending: 'normal',
        keyframes: {
          'opacity': [
            { id: 'kf_o1', time: 0, value: 0, easing: 'easeOut' },
            { id: 'kf_o2', time: 1.2, value: 1, easing: 'easeOut' },
          ],
        },
      },
    ],
  };

  p.motionCompositions['comp_logo_reveal'] = logoRevealComp;

  // Insert Clips on Video Timeline
  // Video Track
  p.timeline.tracks[1].clips = [
    {
      id: 'clip_vid_1',
      name: 'C001.mov',
      type: 'video',
      assetId: 'asset_c001',
      start: 0,
      duration: 12.0,
      in: 0,
      out: 12.0,
      speed: 1,
      opacity: 1,
      locked: false,
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
      },
    } as VideoClip,
    {
      id: 'clip_vid_2',
      name: 'C002.mov',
      type: 'video',
      assetId: 'asset_c002',
      start: 12.0,
      duration: 18.0,
      in: 0,
      out: 18.0,
      speed: 1,
      opacity: 1,
      locked: false,
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
      },
    } as VideoClip,
  ];

  // Graphics Track (Contains our Motion Composition dynamically linked!)
  p.timeline.tracks[0].clips = [
    {
      id: 'clip_motion_1',
      name: 'Title 01 (Motion)',
      type: 'motionComposition',
      compositionId: 'comp_logo_reveal',
      start: 4.0,
      duration: 6.0,
      in: 0,
      out: 6.0,
      speed: 1,
      opacity: 1,
      locked: false,
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
      },
    } as MotionCompositionClip,
    {
      id: 'clip_motion_2',
      name: 'Title 02',
      type: 'text',
      text: 'Summer Drop',
      fontSize: 54,
      fontFamily: 'Inter',
      fill: '#FFFFFF',
      alignment: 'center',
      start: 15.0,
      duration: 8.0,
      in: 0,
      out: 8.0,
      speed: 1,
      opacity: 1,
      locked: false,
      transform: {
        position: { x: 0, y: 200 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
      },
    } as any,
  ];

  // Audio Track
  p.timeline.tracks[2].clips = [
    {
      id: 'clip_aud_1',
      name: 'Music',
      type: 'audio',
      assetId: 'asset_music',
      start: 0,
      duration: 90.0,
      in: 0,
      out: 90.0,
      speed: 1,
      opacity: 1,
      locked: false,
      volume: 0.8,
      fadeIn: 0.5,
      fadeOut: 1.0,
      transform: {
        position: { x: 0, y: 0 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
      },
    } as AudioClip,
  ];

  return p;
}

export const globalStore = new ProjectStore(initStarterProject());
export const globalSelection = new SelectionStore();
export const globalCompositor = new UnifiedCompositor();

export function useProject() {
  const [project, setProject] = useState<Project>(globalStore.getProject());

  useEffect(() => {
    return globalStore.subscribe((updated) => setProject(updated));
  }, []);

  return project;
}

export function useCurrentTime() {
  const [time, setTime] = useState<number>(globalStore.getCurrentTime());

  useEffect(() => {
    return globalStore.subscribeTime((t) => setTime(t));
  }, []);

  return time;
}

export function useSelection() {
  const [selection, setSelection] = useState(globalSelection.getSelection());

  useEffect(() => {
    return globalSelection.subscribe((s) => setSelection(s));
  }, []);

  return selection;
}
