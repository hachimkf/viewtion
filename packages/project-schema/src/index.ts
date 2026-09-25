import { z } from 'zod';

export const CURRENT_SCHEMA_VERSION = '1.0.0';

export const TransformSchema = z.object({
  position: z.object({
    x: z.number().default(0),
    y: z.number().default(0),
  }),
  scale: z.object({
    x: z.number().default(1),
    y: z.number().default(1),
  }),
  rotation: z.number().default(0),
  anchor: z.object({
    x: z.number().default(0.5),
    y: z.number().default(0.5),
  }),
});
export type Transform = z.infer<typeof TransformSchema>;

export const EasingTypeSchema = z.enum([
  'linear',
  'easeIn',
  'easeOut',
  'easeInOut',
  'cubic',
  'back',
  'elastic',
  'spring',
  'hold',
  'bezier',
]);
export type EasingType = z.infer<typeof EasingTypeSchema>;

export const KeyframeSchema = z.object({
  id: z.string(),
  time: z.number(), // seconds relative to clip or layer start
  value: z.any(),
  easing: EasingTypeSchema.default('easeInOut'),
  bezierPoints: z.tuple([z.number(), z.number(), z.number(), z.number()]).optional(),
});
export type Keyframe = z.infer<typeof KeyframeSchema>;

export const AssetTypeSchema = z.enum(['video', 'audio', 'image', 'svg', 'font']);
export type AssetType = z.infer<typeof AssetTypeSchema>;

export const AssetSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: AssetTypeSchema,
  src: z.string(),
  duration: z.number().optional(),
  width: z.number().optional(),
  height: z.number().optional(),
  fps: z.number().optional(),
  waveform: z.array(z.number()).optional(),
  thumbnail: z.string().optional(),
});
export type Asset = z.infer<typeof AssetSchema>;

export const ClipEffectTypeSchema = z.enum([
  'brightness',
  'contrast',
  'saturation',
  'exposure',
  'temperature',
  'tint',
  'blur',
  'sharpen',
  'vignette',
  'grayscale',
  'sepia',
]);
export type ClipEffectType = z.infer<typeof ClipEffectTypeSchema>;

export const ClipEffectSchema = z.object({
  id: z.string(),
  type: ClipEffectTypeSchema,
  value: z.number().default(0),
  enabled: z.boolean().default(true),
});
export type ClipEffect = z.infer<typeof ClipEffectSchema>;

export const TransitionTypeSchema = z.enum([
  'none',
  'crossDissolve',
  'dipToBlack',
  'dipToWhite',
  'slideLeft',
  'slideRight',
  'push',
  'wipe',
]);
export type TransitionType = z.infer<typeof TransitionTypeSchema>;

export const ClipTransitionSchema = z.object({
  type: TransitionTypeSchema.default('none'),
  duration: z.number().default(0.5),
});
export type ClipTransition = z.infer<typeof ClipTransitionSchema>;

export const CropSchema = z.object({
  left: z.number().default(0),
  right: z.number().default(0),
  top: z.number().default(0),
  bottom: z.number().default(0),
});
export type Crop = z.infer<typeof CropSchema>;

export const BaseClipSchema = z.object({
  id: z.string(),
  name: z.string(),
  start: z.number(), // seconds on timeline
  duration: z.number(), // seconds on timeline
  in: z.number().default(0),
  out: z.number().default(0),
  speed: z.number().default(1),
  transform: TransformSchema.default({
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    anchor: { x: 0.5, y: 0.5 },
  }),
  opacity: z.number().default(1),
  locked: z.boolean().default(false),
  keyframes: z.record(z.array(KeyframeSchema)).optional(),
  effects: z.array(ClipEffectSchema).optional(),
  transition: ClipTransitionSchema.optional(),
  crop: CropSchema.optional(),
});

export const VideoClipSchema = BaseClipSchema.extend({
  type: z.literal('video'),
  assetId: z.string(),
});
export type VideoClip = z.infer<typeof VideoClipSchema>;

export const AudioClipSchema = BaseClipSchema.extend({
  type: z.literal('audio'),
  assetId: z.string(),
  volume: z.number().default(1),
  fadeIn: z.number().default(0),
  fadeOut: z.number().default(0),
});
export type AudioClip = z.infer<typeof AudioClipSchema>;

export const TextClipSchema = BaseClipSchema.extend({
  type: z.literal('text'),
  text: z.string().default('Title'),
  fontSize: z.number().default(64),
  fontFamily: z.string().default('Inter'),
  fill: z.string().default('#FFFFFF'),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  alignment: z.enum(['left', 'center', 'right']).optional().default('center'),
});
export type TextClip = z.infer<typeof TextClipSchema>;

export const MotionCompositionClipSchema = BaseClipSchema.extend({
  type: z.literal('motionComposition'),
  compositionId: z.string(),
});
export type MotionCompositionClip = z.infer<typeof MotionCompositionClipSchema>;

export const ClipSchema = z.discriminatedUnion('type', [
  VideoClipSchema,
  AudioClipSchema,
  TextClipSchema,
  MotionCompositionClipSchema,
]);
export type Clip = z.infer<typeof ClipSchema>;

export const TrackTypeSchema = z.enum(['video', 'audio', 'graphics']);
export type TrackType = z.infer<typeof TrackTypeSchema>;

export const TrackSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: TrackTypeSchema,
  locked: z.boolean().default(false),
  muted: z.boolean().default(false),
  visible: z.boolean().default(true),
  clips: z.array(ClipSchema).default([]),
});
export type Track = z.infer<typeof TrackSchema>;

export const TimelineMarkerSchema = z.object({
  id: z.string(),
  time: z.number(),
  label: z.string(),
  color: z.string().default('#E2F952'),
});
export type TimelineMarker = z.infer<typeof TimelineMarkerSchema>;

export const TimelineSchema = z.object({
  tracks: z.array(TrackSchema).default([]),
  markers: z.array(TimelineMarkerSchema).default([]),
});
export type Timeline = z.infer<typeof TimelineSchema>;

// Motion Layer Schemas
export const BaseLayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  start: z.number().default(0),
  duration: z.number().default(5),
  visible: z.boolean().default(true),
  locked: z.boolean().default(false),
  transform: TransformSchema.default({
    position: { x: 0, y: 0 },
    scale: { x: 1, y: 1 },
    rotation: 0,
    anchor: { x: 0.5, y: 0.5 },
  }),
  opacity: z.number().default(1),
  blending: z.string().default('normal'),
  keyframes: z.record(z.array(KeyframeSchema)).optional(),
});

export const ShapeLayerSchema = BaseLayerSchema.extend({
  type: z.literal('shape'),
  shapeType: z.enum(['rect', 'circle', 'path']).default('rect'),
  width: z.number().default(200),
  height: z.number().default(200),
  fill: z.string().default('#E2F952'),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  cornerRadius: z.number().optional(),
  pathData: z.string().optional(),
});
export type ShapeLayer = z.infer<typeof ShapeLayerSchema>;

export const MotionTextLayerSchema = BaseLayerSchema.extend({
  type: z.literal('text'),
  text: z.string().default('Shape Ideas Into Motion'),
  fontSize: z.number().default(52),
  fontFamily: z.string().default('Inter, sans-serif'),
  fill: z.string().default('#FFFFFF'),
  stroke: z.string().optional(),
  strokeWidth: z.number().optional(),
  letterSpacing: z.number().optional(),
  lineHeight: z.number().optional(),
  alignment: z.enum(['left', 'center', 'right']).optional(),
});
export type MotionTextLayer = z.infer<typeof MotionTextLayerSchema>;

export const MotionImageLayerSchema = BaseLayerSchema.extend({
  type: z.literal('image'),
  assetId: z.string().optional(),
  src: z.string().optional(),
  width: z.number().default(300),
  height: z.number().default(300),
});
export type MotionImageLayer = z.infer<typeof MotionImageLayerSchema>;

export const MotionLayerSchema = z.discriminatedUnion('type', [
  ShapeLayerSchema,
  MotionTextLayerSchema,
  MotionImageLayerSchema,
]);
export type MotionLayer = z.infer<typeof MotionLayerSchema>;

export const MotionCompositionSchema = z.object({
  id: z.string(),
  name: z.string(),
  width: z.number().default(1080),
  height: z.number().default(1350),
  fps: z.number().default(30),
  duration: z.number().default(5),
  backgroundColor: z.string().default('transparent'),
  layers: z.array(MotionLayerSchema).default([]),
});
export type MotionComposition = z.infer<typeof MotionCompositionSchema>;

export const ProjectSettingsSchema = z.object({
  width: z.number().default(1080),
  height: z.number().default(1350),
  fps: z.number().default(30),
  duration: z.number().default(90), // default 1:30 sequence
  sampleRate: z.number().default(48000),
  aspectRatio: z.string().default('4:5'),
});
export type ProjectSettings = z.infer<typeof ProjectSettingsSchema>;

export const ProjectSchema = z.object({
  schemaVersion: z.string().default(CURRENT_SCHEMA_VERSION),
  id: z.string(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  settings: ProjectSettingsSchema.default({}),
  assets: z.record(AssetSchema).default({}),
  timeline: TimelineSchema.default({ tracks: [], markers: [] }),
  motionCompositions: z.record(MotionCompositionSchema).default({}),
  metadata: z.record(z.any()).default({}),
});
export type Project = z.infer<typeof ProjectSchema>;

/**
 * Creates a blank starter Viewtion project with standard tracks.
 */
export function createEmptyProject(name = "Brink's Event Reel"): Project {
  const timestamp = new Date().toISOString();
  return {
    schemaVersion: CURRENT_SCHEMA_VERSION,
    id: `proj_${Date.now()}`,
    name,
    createdAt: timestamp,
    updatedAt: timestamp,
    settings: {
      width: 1080,
      height: 1350,
      fps: 30,
      duration: 90,
      sampleRate: 48000,
      aspectRatio: '4:5',
    },
    assets: {},
    timeline: {
      tracks: [
        {
          id: 'track_graphics_1',
          name: 'Graphics / Titles',
          type: 'graphics',
          locked: false,
          muted: false,
          visible: true,
          clips: [],
        },
        {
          id: 'track_video_1',
          name: 'Video 1',
          type: 'video',
          locked: false,
          muted: false,
          visible: true,
          clips: [],
        },
        {
          id: 'track_audio_1',
          name: 'Music / Audio',
          type: 'audio',
          locked: false,
          muted: false,
          visible: true,
          clips: [],
        },
      ],
      markers: [],
    },
    motionCompositions: {},
    metadata: {},
  };
}

export function validateProject(data: unknown): { success: true; data: Project } | { success: false; error: string } {
  const result = ProjectSchema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error.message };
}
