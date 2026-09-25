import { Project, VideoClip, TextClip, MotionCompositionClip, Clip } from '@viewtion/project-schema';
import { renderMotionCompositionToCanvas } from '@viewtion/motion-engine';

export interface RenderContextOptions {
  width: number;
  height: number;
  time: number;
  mediaElements?: Map<string, HTMLVideoElement | HTMLImageElement>;
  showGuides?: boolean;
}

export class UnifiedCompositor {
  private offscreenCanvas: HTMLCanvasElement | null = null;
  private offscreenCtx: CanvasRenderingContext2D | null = null;

  constructor() {
    if (typeof document !== 'undefined') {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    }
  }

  render(targetCtx: CanvasRenderingContext2D, project: Project, options: RenderContextOptions) {
    const { width, height, time, mediaElements, showGuides } = options;

    targetCtx.save();
    targetCtx.clearRect(0, 0, width, height);

    // Dark canvas background
    targetCtx.fillStyle = '#0a0a0d';
    targetCtx.fillRect(0, 0, width, height);

    // Tracks ordered bottom-to-top (video tracks render first, then graphics/titles)
    // Reverse tracks so earlier in array or higher-priority graphics render on top
    const tracks = [...project.timeline.tracks].reverse();

    for (const track of tracks) {
      if (!track.visible) continue;

      for (const clip of track.clips) {
        if (time < clip.start || time > clip.start + clip.duration) continue;

        const clipLocalTime = (time - clip.start) * clip.speed;

        targetCtx.save();
        targetCtx.globalAlpha = clip.opacity;

        // Apply clip transform
        const cx = clip.transform.position.x + width / 2;
        const cy = clip.transform.position.y + height / 2;
        targetCtx.translate(cx, cy);
        targetCtx.rotate((clip.transform.rotation * Math.PI) / 180);
        targetCtx.scale(clip.transform.scale.x, clip.transform.scale.y);

        if (clip.type === 'video') {
          this.renderVideoClip(targetCtx, clip as VideoClip, width, height, mediaElements);
        } else if (clip.type === 'text') {
          this.renderTextClip(targetCtx, clip as TextClip);
        } else if (clip.type === 'motionComposition') {
          this.renderMotionClip(targetCtx, clip as MotionCompositionClip, project, clipLocalTime);
        }

        targetCtx.restore();
      }
    }

    // Optional rule-of-thirds grid / guides (as shown in the user's mockup)
    if (showGuides) {
      this.renderGuides(targetCtx, width, height);
    }

    targetCtx.restore();
  }

  private renderVideoClip(
    ctx: CanvasRenderingContext2D,
    clip: VideoClip,
    width: number,
    height: number,
    mediaElements?: Map<string, HTMLVideoElement | HTMLImageElement>
  ) {
    const el = mediaElements?.get(clip.assetId);
    if (el) {
      // Draw image or video frame centered
      const ox = -width / 2;
      const oy = -height / 2;
      ctx.drawImage(el, ox, oy, width, height);
    } else {
      // Placeholder aesthetic video card representation
      const ox = -width / 2;
      const oy = -height / 2;
      const grad = ctx.createLinearGradient(ox, oy, ox + width, oy + height);
      grad.addColorStop(0, '#1c1c24');
      grad.addColorStop(1, '#121217');
      ctx.fillStyle = grad;
      ctx.fillRect(ox, oy, width, height);

      ctx.fillStyle = '#64748B';
      ctx.font = '18px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`[Video Clip: ${clip.name}]`, 0, 0);
    }
  }

  private renderTextClip(ctx: CanvasRenderingContext2D, clip: TextClip) {
    ctx.font = `bold ${clip.fontSize}px ${clip.fontFamily || 'Inter, sans-serif'}`;
    ctx.fillStyle = clip.fill || '#FFFFFF';
    ctx.textAlign = clip.alignment || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clip.text, 0, 0);
  }

  private renderMotionClip(
    ctx: CanvasRenderingContext2D,
    clip: MotionCompositionClip,
    project: Project,
    motionTime: number
  ) {
    const comp = project.motionCompositions[clip.compositionId];
    if (!comp) return;

    if (!this.offscreenCanvas || !this.offscreenCtx) {
      this.offscreenCanvas = document.createElement('canvas');
      this.offscreenCtx = this.offscreenCanvas.getContext('2d');
    }

    if (this.offscreenCanvas && this.offscreenCtx) {
      if (
        this.offscreenCanvas.width !== comp.width ||
        this.offscreenCanvas.height !== comp.height
      ) {
        this.offscreenCanvas.width = comp.width;
        this.offscreenCanvas.height = comp.height;
      }

      renderMotionCompositionToCanvas(this.offscreenCtx, comp, motionTime, { clear: true });

      // Composite onto video canvas centered
      const ox = -comp.width / 2;
      const oy = -comp.height / 2;
      ctx.drawImage(this.offscreenCanvas, ox, oy);
    }
  }

  private renderGuides(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 249, 82, 0.25)'; // Subtle lime guidelines
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

    // Rule of thirds
    ctx.beginPath();
    ctx.moveTo(width / 3, 0);
    ctx.lineTo(width / 3, height);
    ctx.moveTo((2 * width) / 3, 0);
    ctx.lineTo((2 * width) / 3, height);
    ctx.moveTo(0, height / 3);
    ctx.lineTo(width, height / 3);
    ctx.moveTo(0, (2 * height) / 3);
    ctx.lineTo(width, (2 * height) / 3);
    ctx.stroke();

    ctx.restore();
  }
}
