import { Project, VideoClip, TextClip, MotionCompositionClip, Clip, ClipEffect } from '@viewtion/project-schema';
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
    const tracks = [...project.timeline.tracks].reverse();

    for (const track of tracks) {
      if (!track.visible) continue;

      for (const clip of track.clips) {
        if (time < clip.start || time > clip.start + clip.duration) continue;

        const clipLocalTime = (time - clip.start) * clip.speed;

        targetCtx.save();

        // 1. Calculate Transition modifier
        let transOpacity = 1;
        let transOffsetX = 0;
        let isDipToBlack = false;
        let dipProgress = 0;

        if (clip.transition && clip.transition.type !== 'none' && clip.transition.duration > 0) {
          const transDur = clip.transition.duration;
          const timeSinceStart = time - clip.start;
          if (timeSinceStart <= transDur) {
            const progress = Math.max(0, Math.min(1, timeSinceStart / transDur));
            switch (clip.transition.type) {
              case 'crossDissolve':
                transOpacity = progress;
                break;
              case 'slideLeft':
                transOffsetX = (1 - progress) * width;
                break;
              case 'dipToBlack':
                isDipToBlack = true;
                dipProgress = progress < 0.5 ? 1 - progress * 2 : (progress - 0.5) * 2;
                break;
              case 'wipe': {
                const ox = -width / 2;
                const oy = -height / 2;
                targetCtx.beginPath();
                targetCtx.rect(ox, oy, width * progress, height);
                targetCtx.clip();
                break;
              }
            }
          }
        }

        targetCtx.globalAlpha = clip.opacity * transOpacity;

        // 2. Apply clip transform
        const cx = clip.transform.position.x + width / 2 + transOffsetX;
        const cy = clip.transform.position.y + height / 2;
        targetCtx.translate(cx, cy);
        targetCtx.rotate((clip.transform.rotation * Math.PI) / 180);
        targetCtx.scale(clip.transform.scale.x, clip.transform.scale.y);

        // 3. Apply Crop if set
        if (clip.crop && (clip.crop.left > 0 || clip.crop.right > 0 || clip.crop.top > 0 || clip.crop.bottom > 0)) {
          const ox = -width / 2;
          const oy = -height / 2;
          const cropL = (clip.crop.left / 100) * width;
          const cropR = (clip.crop.right / 100) * width;
          const cropT = (clip.crop.top / 100) * height;
          const cropB = (clip.crop.bottom / 100) * height;
          targetCtx.beginPath();
          targetCtx.rect(
            ox + cropL,
            oy + cropT,
            Math.max(0, width - cropL - cropR),
            Math.max(0, height - cropT - cropB)
          );
          targetCtx.clip();
        }

        // 4. Apply Effects & Color Filters
        this.applyEffectsFilter(targetCtx, clip.effects);

        if (clip.type === 'video') {
          this.renderVideoClip(targetCtx, clip as VideoClip, width, height, clipLocalTime, mediaElements);
        } else if (clip.type === 'text') {
          this.renderTextClip(targetCtx, clip as TextClip);
        } else if (clip.type === 'motionComposition') {
          this.renderMotionClip(targetCtx, clip as MotionCompositionClip, project, clipLocalTime);
        }

        // Dip to black overlay
        if (isDipToBlack && dipProgress > 0) {
          targetCtx.fillStyle = `rgba(0, 0, 0, ${1 - dipProgress})`;
          targetCtx.fillRect(-width / 2, -height / 2, width, height);
        }

        targetCtx.restore();
      }
    }

    // Optional rule-of-thirds grid / guides
    if (showGuides) {
      this.renderGuides(targetCtx, width, height);
    }

    targetCtx.restore();
  }

  private applyEffectsFilter(ctx: CanvasRenderingContext2D, effects?: ClipEffect[]) {
    if (!effects || effects.length === 0) return;

    let filterStr = '';
    for (const eff of effects) {
      if (!eff.enabled) continue;
      switch (eff.type) {
        case 'brightness':
          filterStr += ` brightness(${Math.max(0, 1 + eff.value)})`;
          break;
        case 'contrast':
          filterStr += ` contrast(${Math.max(0, 1 + eff.value)})`;
          break;
        case 'saturation':
          filterStr += ` saturate(${Math.max(0, 1 + eff.value)})`;
          break;
        case 'blur':
          filterStr += ` blur(${Math.max(0, eff.value)}px)`;
          break;
        case 'grayscale':
          filterStr += ` grayscale(${Math.max(0, Math.min(1, eff.value))})`;
          break;
        case 'sepia':
          filterStr += ` sepia(${Math.max(0, Math.min(1, eff.value))})`;
          break;
      }
    }

    if (filterStr.trim()) {
      ctx.filter = filterStr.trim();
    }
  }

  private renderVideoClip(
    ctx: CanvasRenderingContext2D,
    clip: VideoClip,
    width: number,
    height: number,
    clipLocalTime: number,
    mediaElements?: Map<string, HTMLVideoElement | HTMLImageElement>
  ) {
    const el = mediaElements?.get(clip.assetId);
    const ox = -width / 2;
    const oy = -height / 2;

    if (el) {
      if (el instanceof HTMLVideoElement) {
        const targetTime = Math.max(0, clip.in + clipLocalTime);
        if (Math.abs(el.currentTime - targetTime) > 0.08 && !el.seeking) {
          try {
            el.currentTime = targetTime;
          } catch (_) {}
        }
        ctx.drawImage(el, ox, oy, width, height);
      } else {
        ctx.drawImage(el, ox, oy, width, height);
      }
    } else {
      // Sleek stylized placeholder video representation
      const grad = ctx.createLinearGradient(ox, oy, ox + width, oy + height);
      grad.addColorStop(0, '#1c1c24');
      grad.addColorStop(1, '#121217');
      ctx.fillStyle = grad;
      ctx.fillRect(ox, oy, width, height);

      ctx.fillStyle = '#64748B';
      ctx.font = '500 16px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(clip.name, 0, -10);

      ctx.fillStyle = '#38BDF8';
      ctx.font = '12px Inter, sans-serif';
      ctx.fillText(`Video Footage`, 0, 16);
    }
  }

  private renderTextClip(ctx: CanvasRenderingContext2D, clip: TextClip) {
    ctx.font = `bold ${clip.fontSize}px ${clip.fontFamily || 'Inter, sans-serif'}`;
    ctx.fillStyle = clip.fill || '#FFFFFF';
    ctx.textAlign = clip.alignment || 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(clip.text, 0, 0);

    if (clip.stroke && (clip.strokeWidth || 0) > 0) {
      ctx.strokeStyle = clip.stroke;
      ctx.lineWidth = clip.strokeWidth!;
      ctx.strokeText(clip.text, 0, 0);
    }
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

      const ox = -comp.width / 2;
      const oy = -comp.height / 2;
      ctx.drawImage(this.offscreenCanvas, ox, oy);
    }
  }

  private renderGuides(ctx: CanvasRenderingContext2D, width: number, height: number) {
    ctx.save();
    ctx.strokeStyle = 'rgba(226, 249, 82, 0.25)';
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);

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
