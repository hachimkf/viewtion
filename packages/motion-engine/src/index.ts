import {
  EasingType,
  Keyframe,
  MotionComposition,
  MotionLayer,
  ShapeLayer,
  MotionTextLayer,
} from '@viewtion/project-schema';

// -------------------------------------------------------------
// Easing Mathematics & Cubic Bezier Solver
// -------------------------------------------------------------

export function solveCubicBezier(
  t: number,
  p1x: number,
  p1y: number,
  p2x: number,
  p2y: number
): number {
  const ax = 3 * p1x - 3 * p2x + 1;
  const bx = 3 * p2x - 6 * p1x;
  const cx = 3 * p1x;

  const ay = 3 * p1y - 3 * p2y + 1;
  const by = 3 * p2y - 6 * p1y;
  const cy = 3 * p1y;

  function sampleCurveX(u: number): number {
    return ((ax * u + bx) * u + cx) * u;
  }

  function sampleCurveY(u: number): number {
    return ((ay * u + by) * u + cy) * u;
  }

  function sampleCurveDerivativeX(u: number): number {
    return (3 * ax * u + 2 * bx) * u + cx;
  }

  // Newton-Raphson iteration
  let u = t;
  for (let i = 0; i < 8; i++) {
    const x = sampleCurveX(u) - t;
    if (Math.abs(x) < 1e-5) break;
    const d2 = sampleCurveDerivativeX(u);
    if (Math.abs(d2) < 1e-5) break;
    u -= x / d2;
  }

  // Clamp u to [0, 1]
  u = Math.max(0, Math.min(1, u));
  return sampleCurveY(u);
}

export function evaluateEasing(progress: number, easing: EasingType, bezier?: [number, number, number, number]): number {
  const t = Math.max(0, Math.min(1, progress));

  switch (easing) {
    case 'linear':
      return t;
    case 'easeIn':
      return t * t;
    case 'easeOut':
      return t * (2 - t);
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
    case 'cubic':
      return t * t * t;
    case 'back': {
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    }
    case 'elastic': {
      if (t === 0) return 0;
      if (t === 1) return 1;
      return -Math.pow(2, 10 * (t - 1)) * Math.sin(((t - 1.1) * 2 * Math.PI) / 0.4);
    }
    case 'spring': {
      return 1 - Math.exp(-6 * t) * Math.cos(10 * t);
    }
    case 'hold':
      return progress >= 1 ? 1 : 0;
    case 'bezier':
      if (bezier && bezier.length === 4) {
        return solveCubicBezier(t, bezier[0], bezier[1], bezier[2], bezier[3]);
      }
      return t;
    default:
      return t;
  }
}

// -------------------------------------------------------------
// Keyframe Property Interpolator
// -------------------------------------------------------------

export function interpolateValue(keyframes: Keyframe[], time: number, defaultValue: any): any {
  if (!keyframes || keyframes.length === 0) {
    return defaultValue;
  }

  if (keyframes.length === 1 || time <= keyframes[0].time) {
    return keyframes[0].value;
  }

  if (time >= keyframes[keyframes.length - 1].time) {
    return keyframes[keyframes.length - 1].value;
  }

  // Find surrounding keyframe segment
  let k0 = keyframes[0];
  let k1 = keyframes[1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (time >= keyframes[i].time && time <= keyframes[i + 1].time) {
      k0 = keyframes[i];
      k1 = keyframes[i + 1];
      break;
    }
  }

  const duration = k1.time - k0.time;
  if (duration <= 0.0001) return k0.value;

  const rawProgress = (time - k0.time) / duration;
  const easedProgress = evaluateEasing(rawProgress, k0.easing, k0.bezierPoints);

  if (typeof k0.value === 'number' && typeof k1.value === 'number') {
    return k0.value + (k1.value - k0.value) * easedProgress;
  }

  return easedProgress >= 1 ? k1.value : k0.value;
}

// -------------------------------------------------------------
// Evaluated Layer State
// -------------------------------------------------------------

export interface EvaluatedLayerState {
  layer: MotionLayer;
  position: { x: number; y: number };
  scale: { x: number; y: number };
  rotation: number;
  opacity: number;
  anchor: { x: number; y: number };
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  cornerRadius?: number;
  fontSize?: number;
  text?: string;
}

export function evaluateLayerAtTime(layer: MotionLayer, localTime: number): EvaluatedLayerState {
  const kfs = layer.keyframes || {};

  const posX = interpolateValue(kfs['position.x'], localTime, layer.transform.position.x);
  const posY = interpolateValue(kfs['position.y'], localTime, layer.transform.position.y);
  const scaleX = interpolateValue(kfs['scale.x'], localTime, layer.transform.scale.x);
  const scaleY = interpolateValue(kfs['scale.y'], localTime, layer.transform.scale.y);
  const rotation = interpolateValue(kfs['rotation'], localTime, layer.transform.rotation);
  const opacity = interpolateValue(kfs['opacity'], localTime, layer.opacity);

  const res: EvaluatedLayerState = {
    layer,
    position: { x: posX, y: posY },
    scale: { x: scaleX, y: scaleY },
    rotation,
    opacity: Math.max(0, Math.min(1, opacity)),
    anchor: layer.transform.anchor,
  };

  if (layer.type === 'shape') {
    const s = layer as ShapeLayer;
    res.fill = interpolateValue(kfs['fill'], localTime, s.fill);
    res.stroke = s.stroke;
    res.strokeWidth = interpolateValue(kfs['strokeWidth'], localTime, s.strokeWidth || 0);
    res.cornerRadius = interpolateValue(kfs['cornerRadius'], localTime, s.cornerRadius || 0);
  } else if (layer.type === 'text') {
    const t = layer as MotionTextLayer;
    res.fill = interpolateValue(kfs['fill'], localTime, t.fill);
    res.fontSize = interpolateValue(kfs['fontSize'], localTime, t.fontSize);
    res.text = t.text;
  }

  return res;
}

// -------------------------------------------------------------
// 2D Canvas Scene Graph Renderer
// -------------------------------------------------------------

export function renderMotionCompositionToCanvas(
  ctx: CanvasRenderingContext2D,
  comp: MotionComposition,
  time: number,
  options?: { clear?: boolean }
) {
  const { width, height } = comp;
  if (options?.clear !== false) {
    ctx.clearRect(0, 0, width, height);
    if (comp.backgroundColor && comp.backgroundColor !== 'transparent') {
      ctx.fillStyle = comp.backgroundColor;
      ctx.fillRect(0, 0, width, height);
    }
  }

  // Iterate layers in order
  for (const layer of comp.layers) {
    if (!layer.visible) continue;
    if (time < layer.start || time > layer.start + layer.duration) continue;

    const localTime = time - layer.start;
    const evaluated = evaluateLayerAtTime(layer, localTime);

    ctx.save();
    ctx.globalAlpha = evaluated.opacity;

    // Apply 2D transform matrix
    ctx.translate(evaluated.position.x, evaluated.position.y);
    ctx.rotate((evaluated.rotation * Math.PI) / 180);
    ctx.scale(evaluated.scale.x, evaluated.scale.y);

    if (layer.type === 'shape') {
      const s = layer as ShapeLayer;
      const w = s.width;
      const h = s.height;
      const ox = -w * evaluated.anchor.x;
      const oy = -h * evaluated.anchor.y;

      ctx.fillStyle = evaluated.fill || '#E2F952';

      if (s.shapeType === 'rect') {
        const r = evaluated.cornerRadius || 0;
        if (r > 0 && typeof ctx.roundRect === 'function') {
          ctx.beginPath();
          ctx.roundRect(ox, oy, w, h, r);
          ctx.fill();
        } else {
          ctx.fillRect(ox, oy, w, h);
        }
      } else if (s.shapeType === 'circle') {
        ctx.beginPath();
        ctx.ellipse(ox + w / 2, oy + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
        ctx.fill();
      }

      if (evaluated.stroke && (evaluated.strokeWidth || 0) > 0) {
        ctx.strokeStyle = evaluated.stroke;
        ctx.lineWidth = evaluated.strokeWidth!;
        ctx.stroke();
      }
    } else if (layer.type === 'text') {
      const t = layer as MotionTextLayer;
      const fontSize = evaluated.fontSize || t.fontSize || 48;
      ctx.font = `bold ${fontSize}px ${t.fontFamily || 'Inter, sans-serif'}`;
      ctx.fillStyle = evaluated.fill || t.fill || '#FFFFFF';
      ctx.textAlign = t.alignment || 'center';
      ctx.textBaseline = 'middle';

      // Render multi-line text nicely
      const lines = (evaluated.text || t.text).split('\n');
      const lineHeight = fontSize * (t.lineHeight || 1.2);
      const totalHeight = lines.length * lineHeight;
      const startY = -totalHeight / 2 + lineHeight / 2;

      for (let i = 0; i < lines.length; i++) {
        ctx.fillText(lines[i], 0, startY + i * lineHeight);
      }
    }

    ctx.restore();
  }
}
