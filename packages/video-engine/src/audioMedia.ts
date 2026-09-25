// Real Web Audio API and Media Extraction utilities

let globalAudioCtx: AudioContext | null = null;

export function getAudioContext(): AudioContext {
  if (!globalAudioCtx && typeof window !== 'undefined') {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (AudioCtx) {
      globalAudioCtx = new AudioCtx();
    }
  }
  return globalAudioCtx!;
}

/**
 * Extracts real audio waveform peaks from an audio or video file.
 */
export async function extractWaveformFromFile(file: File | Blob, samples: number = 100): Promise<number[]> {
  const ctx = getAudioContext();
  if (!ctx) return [];

  try {
    const arrayBuffer = await file.arrayBuffer();
    const audioBuffer = await ctx.decodeAudioData(arrayBuffer.slice(0));
    const channelData = audioBuffer.getChannelData(0); // first audio channel
    const blockSize = Math.floor(channelData.length / samples);
    const peaks: number[] = [];

    for (let i = 0; i < samples; i++) {
      const start = i * blockSize;
      let max = 0;
      for (let j = 0; j < blockSize; j += 10) {
        const val = Math.abs(channelData[start + j] || 0);
        if (val > max) max = val;
      }
      peaks.push(Math.max(0.05, Math.min(1.0, max * 1.5)));
    }

    return peaks;
  } catch (err) {
    console.warn('Failed to extract waveform from file, generating placeholder:', err);
    return [];
  }
}

/**
 * Generates a video thumbnail and extracts video metadata from a video file.
 */
export function extractVideoMetadata(
  file: File | Blob
): Promise<{ duration: number; width: number; height: number; thumbnail: string; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.src = url;
    video.muted = true;
    video.playsInline = true;

    video.onloadedmetadata = () => {
      // Seek to 1s or 25% for thumbnail
      video.currentTime = Math.min(1.0, video.duration / 4);
    };

    video.onseeked = () => {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = Math.min(320, video.videoWidth || 320);
        canvas.height = Math.min(180, video.videoHeight || 180);
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const thumbnail = canvas.toDataURL('image/jpeg', 0.8);
          resolve({
            duration: video.duration || 10,
            width: video.videoWidth || 1920,
            height: video.videoHeight || 1080,
            thumbnail,
            url,
          });
        } else {
          resolve({
            duration: video.duration || 10,
            width: video.videoWidth || 1920,
            height: video.videoHeight || 1080,
            thumbnail: '',
            url,
          });
        }
      } catch (e) {
        resolve({
          duration: video.duration || 10,
          width: video.videoWidth || 1920,
          height: video.videoHeight || 1080,
          thumbnail: '',
          url,
        });
      }
    };

    video.onerror = () => {
      resolve({
        duration: 10,
        width: 1920,
        height: 1080,
        thumbnail: '',
        url,
      });
    };
  });
}
