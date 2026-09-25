import { Project, Clip } from '@viewtion/project-schema';

export function formatTimecode(seconds: number, fps: number = 30): string {
  const totalSecs = Math.max(0, Math.floor(seconds));
  const mins = Math.floor(totalSecs / 60);
  const secs = totalSecs % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function formatTimecodeDetailed(seconds: number, fps: number = 30): string {
  const totalSecs = Math.max(0, seconds);
  const mins = Math.floor(totalSecs / 60);
  const secs = Math.floor(totalSecs % 60);
  const frames = Math.floor((totalSecs - Math.floor(totalSecs)) * fps);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}:${frames.toString().padStart(2, '0')}`;
}

export function timeToPixels(seconds: number, zoom: number): number {
  return seconds * zoom; // zoom = pixels per second (e.g. 50px/sec)
}

export function pixelsToTime(pixels: number, zoom: number): number {
  if (zoom <= 0) return 0;
  return pixels / zoom;
}

export interface SnapTarget {
  time: number;
  label: string;
}

export function findSnapTime(
  candidateTime: number,
  project: Project,
  ignoreClipId?: string,
  thresholdSeconds: number = 0.2
): number {
  const targets: number[] = [0, project.settings.duration];

  // Clip boundaries
  for (const track of project.timeline.tracks) {
    for (const clip of track.clips) {
      if (clip.id === ignoreClipId) continue;
      targets.push(clip.start);
      targets.push(clip.start + clip.duration);
    }
  }

  // Markers
  for (const m of project.timeline.markers) {
    targets.push(m.time);
  }

  let closestTime = candidateTime;
  let minDiff = thresholdSeconds;

  for (const t of targets) {
    const diff = Math.abs(t - candidateTime);
    if (diff < minDiff) {
      minDiff = diff;
      closestTime = t;
    }
  }

  return closestTime;
}

/**
 * Generate smooth waveform peak points for audio rendering.
 */
export function generateWaveformPeaks(count: number = 100, seed: number = 1): number[] {
  const peaks: number[] = [];
  let prev = 0.5;
  for (let i = 0; i < count; i++) {
    // Generate organic looking waveform envelope
    const noise = Math.sin(i * 0.3 * seed) * 0.3 + Math.cos(i * 0.7 * seed) * 0.2;
    const val = Math.max(0.1, Math.min(0.95, 0.45 + noise + (Math.random() - 0.5) * 0.2));
    prev = prev * 0.6 + val * 0.4;
    peaks.push(prev);
  }
  return peaks;
}
