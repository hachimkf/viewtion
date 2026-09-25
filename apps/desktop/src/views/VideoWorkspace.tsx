import React, { useRef, useEffect, useState, useCallback } from 'react';
import {
  FolderKanban,
  FileVideo,
  Sparkles,
  Scissors,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  ChevronLeft,
  ChevronRight,
  Download,
  Grid,
  Lock,
  Unlock,
  Eye,
  EyeOff,
  Volume2,
  VolumeX,
  Type,
  Music,
  Plus,
  Undo2,
  Redo2,
  Layers,
  ArrowRight,
  Copy,
  Trash2,
  Sliders,
  Crop,
  Zap,
  SlidersHorizontal,
  Wand2,
} from 'lucide-react';
import {
  ActiveWorkspace,
  useProject,
  useCurrentTime,
  useSelection,
  globalStore,
  globalSelection,
  globalCompositor,
} from '../state/editorState';
import {
  SplitClipCommand,
  TrimClipCommand,
  MoveClipCommand,
  RemoveClipCommand,
  AddClipCommand,
  AddAssetCommand,
  DuplicateClipCommand,
  RippleDeleteClipCommand,
  SetClipPropertyCommand,
  AddTrackCommand,
} from '@viewtion/editor-core';
import {
  formatTimecode,
  formatTimecodeDetailed,
  findSnapTime,
  extractVideoMetadata,
  extractWaveformFromFile,
} from '@viewtion/video-engine';
import {
  Asset,
  Clip,
  VideoClip,
  MotionCompositionClip,
  TextClip,
  AudioClip,
  ClipEffect,
  ClipTransition,
} from '@viewtion/project-schema';

interface VideoWorkspaceProps {
  onNavigate: (workspace: ActiveWorkspace) => void;
  onOpenMotionComp: (compId: string) => void;
}

interface DragState {
  clipId: string;
  originalStart: number;
  originalTrackId: string;
  startX: number;
  startY: number;
  currentStart: number;
  targetTrackId: string;
}

interface TrimState {
  clipId: string;
  handle: 'left' | 'right';
  startX: number;
  originalStart: number;
  originalDuration: number;
  originalIn: number;
  originalOut: number;
  currentStart: number;
  currentDuration: number;
}

export const VideoWorkspace: React.FC<VideoWorkspaceProps> = ({ onNavigate, onOpenMotionComp }) => {
  const project = useProject();
  const currentTime = useCurrentTime();
  const selection = useSelection();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'media' | 'effects' | 'transitions' | 'text' | 'audio' | 'captions' | 'templates'>('media');
  const [assetFilter, setAssetFilter] = useState<'all' | 'video' | 'images' | 'audio'>('all');
  const [timelineZoom, setTimelineZoom] = useState(50); // pixels per second
  const [showGuides, setShowGuides] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  // Inspector toggle
  const [showInspector, setShowInspector] = useState(true);

  // Dragging & Trimming interaction state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [trimState, setTrimState] = useState<TrimState | null>(null);
  const [snapLineTime, setSnapLineTime] = useState<number | null>(null);

  // Clipboard for copy/paste
  const [clipboardClip, setClipboardClip] = useState<Clip | null>(null);

  // Media Elements Pool (HTMLVideoElement / HTMLImageElement)
  const mediaPoolRef = useRef<Map<string, HTMLVideoElement | HTMLImageElement>>(new Map());

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const tracksContainerRef = useRef<HTMLDivElement>(null);

  // Load assets into media pool when project.assets change
  useEffect(() => {
    for (const asset of Object.values(project.assets)) {
      if (!asset.src) continue;
      if (!mediaPoolRef.current.has(asset.id)) {
        if (asset.type === 'video') {
          const video = document.createElement('video');
          video.src = asset.src;
          video.preload = 'auto';
          video.muted = true;
          video.playsInline = true;
          mediaPoolRef.current.set(asset.id, video);
        } else if (asset.type === 'image') {
          const img = new Image();
          img.src = asset.src;
          mediaPoolRef.current.set(asset.id, img);
        }
      }
    }
  }, [project.assets]);

  // Render video preview canvas whenever time, project, or interaction changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    globalCompositor.render(ctx, project, {
      width: canvas.width,
      height: canvas.height,
      time: currentTime,
      mediaElements: mediaPoolRef.current,
      showGuides,
    });
  }, [project, currentTime, showGuides]);

  // Playback loop with accurate time synchronization
  useEffect(() => {
    let animId: number;
    let lastStamp: number | null = null;

    if (isPlaying) {
      const step = (timestamp: number) => {
        if (lastStamp !== null) {
          const delta = (timestamp - lastStamp) / 1000;
          const nextTime = currentTime + delta;
          if (nextTime >= project.settings.duration) {
            globalStore.setCurrentTime(0);
            setIsPlaying(false);
          } else {
            globalStore.setCurrentTime(nextTime);
          }
        }
        lastStamp = timestamp;
        if (isPlaying) {
          animId = requestAnimationFrame(step);
        }
      };
      animId = requestAnimationFrame(step);
    }

    return () => {
      if (animId) cancelAnimationFrame(animId);
    };
  }, [isPlaying, currentTime, project.settings.duration]);

  const handlePlayPause = () => {
    setIsPlaying(!isPlaying);
  };

  const handleStepFrame = (frames: number) => {
    setIsPlaying(false);
    const dt = frames * (1 / project.settings.fps);
    globalStore.setCurrentTime(Math.max(0, Math.min(project.settings.duration, currentTime + dt)));
  };

  const handleSeek = (time: number) => {
    globalStore.setCurrentTime(Math.max(0, Math.min(project.settings.duration, time)));
  };

  // Find currently selected clip object
  let selectedClip: Clip | undefined;
  let selectedTrack: { id: string; name: string; type: string } | undefined;
  if (selection.type === 'clip' && selection.id) {
    for (const t of project.timeline.tracks) {
      const found = t.clips.find((c) => c.id === selection.id);
      if (found) {
        selectedClip = found;
        selectedTrack = { id: t.id, name: t.name, type: t.type };
        break;
      }
    }
  }

  // Split clip at playhead
  const handleSplitAtPlayhead = () => {
    if (selectedClip) {
      if (currentTime > selectedClip.start && currentTime < selectedClip.start + selectedClip.duration) {
        globalStore.dispatch(new SplitClipCommand(selectedClip.id, currentTime));
        return;
      }
    }
    // Fallback: find any clip intersecting playhead
    for (const t of project.timeline.tracks) {
      for (const c of t.clips) {
        if (currentTime > c.start && currentTime < c.start + c.duration) {
          globalStore.dispatch(new SplitClipCommand(c.id, currentTime));
          return;
        }
      }
    }
  };

  // Duplicate clip
  const handleDuplicateSelected = () => {
    if (selectedClip) {
      globalStore.dispatch(new DuplicateClipCommand(selectedClip.id));
    }
  };

  // Delete clip (standard)
  const handleDeleteSelected = () => {
    if (selectedClip) {
      globalStore.dispatch(new RemoveClipCommand(selectedClip.id));
      globalSelection.clear();
    }
  };

  // Ripple delete clip
  const handleRippleDeleteSelected = () => {
    if (selectedClip) {
      globalStore.dispatch(new RippleDeleteClipCommand(selectedClip.id));
      globalSelection.clear();
    }
  };

  // Copy clip
  const handleCopySelected = () => {
    if (selectedClip) {
      setClipboardClip(JSON.parse(JSON.stringify(selectedClip)));
    }
  };

  // Paste clip at playhead
  const handlePasteAtPlayhead = () => {
    if (clipboardClip) {
      const targetTrackId = selectedTrack?.id || project.timeline.tracks[0]?.id;
      if (targetTrackId) {
        const pasted: Clip = {
          ...clipboardClip,
          id: `clip_${Date.now()}`,
          start: currentTime,
        };
        globalStore.dispatch(new AddClipCommand(targetTrackId, pasted));
        globalSelection.select({ type: 'clip', id: pasted.id });
      }
    }
  };

  // Keyboard shortcut listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if typing in text inputs or textareas
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'b') {
        e.preventDefault();
        handleSplitAtPlayhead();
      } else if (e.key.toLowerCase() === 'b' && !e.metaKey && !e.ctrlKey) {
        handleSplitAtPlayhead();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'd') {
        e.preventDefault();
        handleDuplicateSelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleCopySelected();
      } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') {
        e.preventDefault();
        handlePasteAtPlayhead();
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        e.preventDefault();
        if (e.shiftKey) {
          handleRippleDeleteSelected();
        } else {
          handleDeleteSelected();
        }
      } else if (e.key === ' ') {
        e.preventDefault();
        handlePlayPause();
      } else if (e.key === '=' || e.key === '+') {
        setTimelineZoom((z) => Math.min(120, z + 10));
      } else if (e.key === '-' || e.key === '_') {
        setTimelineZoom((z) => Math.max(20, z - 10));
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClip, currentTime, clipboardClip, isPlaying]);

  // Pointer move & up handlers for timeline dragging & trimming
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (dragState) {
        const deltaX = (e.clientX - dragState.startX) / timelineZoom;
        let candidateStart = Math.max(0, dragState.originalStart + deltaX);

        // Magnetic snapping
        const snapped = findSnapTime(candidateStart, project, dragState.clipId, 0.15);
        if (Math.abs(snapped - candidateStart) < 0.15) {
          candidateStart = snapped;
          setSnapLineTime(snapped);
        } else {
          setSnapLineTime(null);
        }

        // Determine target track based on clientY
        let targetTrackId = dragState.originalTrackId;
        if (tracksContainerRef.current) {
          const trackElements = tracksContainerRef.current.querySelectorAll('[data-track-id]');
          trackElements.forEach((el) => {
            const rect = el.getBoundingClientRect();
            if (e.clientY >= rect.top && e.clientY <= rect.bottom) {
              const tid = el.getAttribute('data-track-id');
              const ttype = el.getAttribute('data-track-type');
              if (tid && ttype) {
                // Ensure compatible track type
                const isAudClip = selectedClip?.type === 'audio';
                if ((isAudClip && ttype === 'audio') || (!isAudClip && ttype !== 'audio')) {
                  targetTrackId = tid;
                }
              }
            }
          });
        }

        setDragState((prev) => (prev ? { ...prev, currentStart: candidateStart, targetTrackId } : null));
      } else if (trimState) {
        const deltaX = (e.clientX - trimState.startX) / timelineZoom;
        if (trimState.handle === 'left') {
          const maxStart = trimState.originalStart + trimState.originalDuration - 0.2;
          const newStart = Math.min(maxStart, Math.max(0, trimState.originalStart + deltaX));
          const diff = newStart - trimState.originalStart;
          const newDuration = trimState.originalDuration - diff;
          setTrimState((prev) => (prev ? { ...prev, currentStart: newStart, currentDuration: newDuration } : null));
        } else {
          const newDuration = Math.max(0.2, trimState.originalDuration + deltaX);
          setTrimState((prev) => (prev ? { ...prev, currentDuration: newDuration } : null));
        }
      }
    };

    const handlePointerUp = () => {
      if (dragState) {
        if (dragState.currentStart !== dragState.originalStart || dragState.targetTrackId !== dragState.originalTrackId) {
          globalStore.dispatch(
            new MoveClipCommand(dragState.clipId, dragState.currentStart, dragState.targetTrackId)
          );
        }
        setDragState(null);
        setSnapLineTime(null);
      } else if (trimState) {
        if (trimState.handle === 'left') {
          const diff = trimState.currentStart - trimState.originalStart;
          const newIn = Math.max(0, trimState.originalIn + diff);
          globalStore.dispatch(
            new TrimClipCommand(
              trimState.clipId,
              trimState.currentStart,
              trimState.currentDuration,
              newIn,
              trimState.originalOut
            )
          );
        } else {
          const newOut = trimState.originalIn + trimState.currentDuration;
          globalStore.dispatch(
            new TrimClipCommand(
              trimState.clipId,
              trimState.originalStart,
              trimState.currentDuration,
              trimState.originalIn,
              newOut
            )
          );
        }
        setTrimState(null);
      }
    };

    if (dragState || trimState) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [dragState, trimState, timelineZoom, project, selectedClip]);

  // File import handler with real metadata extraction
  const handleImportAssetFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const isVideo = file.type.startsWith('video');
      const isAudio = file.type.startsWith('audio');
      const isImg = file.type.startsWith('image');

      if (isVideo) {
        const meta = await extractVideoMetadata(file);
        const newAsset: Asset = {
          id: `asset_${Date.now()}_${i}`,
          name: file.name,
          type: 'video',
          src: meta.url,
          duration: meta.duration,
          width: meta.width,
          height: meta.height,
          thumbnail: meta.thumbnail,
        };
        globalStore.dispatch(new AddAssetCommand(newAsset));
      } else if (isAudio) {
        const peaks = await extractWaveformFromFile(file);
        const url = URL.createObjectURL(file);
        const newAsset: Asset = {
          id: `asset_${Date.now()}_${i}`,
          name: file.name,
          type: 'audio',
          src: url,
          duration: 30,
          waveform: peaks.length > 0 ? peaks : undefined,
        };
        globalStore.dispatch(new AddAssetCommand(newAsset));
      } else if (isImg) {
        const url = URL.createObjectURL(file);
        const newAsset: Asset = {
          id: `asset_${Date.now()}_${i}`,
          name: file.name,
          type: 'image',
          src: url,
          thumbnail: url,
        };
        globalStore.dispatch(new AddAssetCommand(newAsset));
      }
    }
  };

  const handleSaveProject = () => {
    const json = globalStore.toJSON();
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.replace(/\s+/g, '_').toLowerCase()}.viewtion`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportVideo = () => {
    setIsExporting(true);
    setExportProgress(10);

    const canvas = canvasRef.current;
    if (!canvas) {
      setIsExporting(false);
      return;
    }

    try {
      const stream = canvas.captureStream(30);
      const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
      const chunks: Blob[] = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunks.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: 'video/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project.name.replace(/\s+/g, '_')}_rendered.webm`;
        a.click();
        setIsExporting(false);
        setExportProgress(0);
      };

      recorder.start();

      let renderTime = 0;
      const stepInterval = 1 / 30;
      const exportDuration = Math.min(15, project.settings.duration);

      const timer = setInterval(() => {
        renderTime += stepInterval;
        setExportProgress(Math.floor((renderTime / exportDuration) * 100));
        globalStore.setCurrentTime(renderTime);

        if (renderTime >= exportDuration) {
          clearInterval(timer);
          recorder.stop();
        }
      }, 33);
    } catch (err) {
      console.warn('Canvas export:', err);
      setTimeout(() => {
        setIsExporting(false);
      }, 1500);
    }
  };

  const assetsList = Object.values(project.assets).filter((a) => {
    if (assetFilter === 'all') return true;
    if (assetFilter === 'video') return a.type === 'video';
    if (assetFilter === 'audio') return a.type === 'audio';
    if (assetFilter === 'images') return a.type === 'image';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#0D0D10' }}>
      <input type="file" ref={fileInputRef} multiple style={{ display: 'none' }} onChange={handleImportAssetFile} />

      {/* Top Header Bar */}
      <div
        style={{
          height: '52px',
          backgroundColor: '#141418',
          borderBottom: '1px solid #26262E',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 20px',
        }}
      >
        {/* Left: Viewtion Logo & Project Name */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div
            onClick={() => onNavigate('home')}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}
          >
            <div
              style={{
                width: '26px',
                height: '26px',
                borderRadius: '6px',
                backgroundColor: '#1C1C22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #2E2E38',
              }}
            >
              <div style={{ width: '8px', height: '8px', backgroundColor: '#E2F952', borderRadius: '2px' }} />
            </div>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>Viewtion</span>
          </div>

          <div style={{ width: '1px', height: '18px', backgroundColor: '#2E2E38' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#FFFFFF', fontWeight: 500 }}>
            <span>{project.name}</span>
            <span style={{ color: '#64748B', fontSize: '11px' }}>▾</span>
          </div>
        </div>

        {/* Center: Resolution & FPS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1C1C22',
              padding: '5px 12px',
              borderRadius: '20px',
              border: '1px solid #282834',
              fontSize: '12px',
              color: '#94A3B8',
            }}
          >
            <span>{project.settings.width} x {project.settings.height}</span>
            <span>•</span>
            <span>{project.settings.fps} fps</span>
            <span style={{ fontSize: '10px' }}>▾</span>
          </div>

          {/* Undo / Redo */}
          <div style={{ display: 'flex', gap: '4px' }}>
            <button
              onClick={() => globalStore.undo()}
              disabled={!globalStore.canUndo()}
              style={{
                background: 'transparent',
                border: 'none',
                color: globalStore.canUndo() ? '#FFFFFF' : '#475569',
                cursor: globalStore.canUndo() ? 'pointer' : 'default',
                padding: '6px',
              }}
              title="Undo (Cmd+Z)"
            >
              <Undo2 size={16} />
            </button>
            <button
              onClick={() => globalStore.redo()}
              disabled={!globalStore.canRedo()}
              style={{
                background: 'transparent',
                border: 'none',
                color: globalStore.canRedo() ? '#FFFFFF' : '#475569',
                cursor: globalStore.canRedo() ? 'pointer' : 'default',
                padding: '6px',
              }}
              title="Redo (Cmd+Shift+Z)"
            >
              <Redo2 size={16} />
            </button>
          </div>
        </div>

        {/* Right: Motion workspace jump, Inspector toggle, Save & Export */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            onClick={() => onNavigate('motion')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1C1C22',
              border: '1px solid #282834',
              color: '#9D7BFF',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            <Layers size={14} />
            Motion Editor
          </button>

          <button
            onClick={() => setShowInspector(!showInspector)}
            style={{
              backgroundColor: showInspector ? '#242432' : '#1C1C22',
              border: '1px solid #282834',
              color: showInspector ? '#E2F952' : '#94A3B8',
              padding: '6px 12px',
              borderRadius: '20px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Inspector
          </button>

          <button
            onClick={handleSaveProject}
            style={{
              backgroundColor: '#1C1C22',
              border: '1px solid #282834',
              color: '#FFFFFF',
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            Save
          </button>

          <button
            onClick={handleExportVideo}
            disabled={isExporting}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#E2F952',
              color: '#0D0D10',
              padding: '6px 16px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 600,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            <Download size={14} />
            {isExporting ? `Exporting ${exportProgress}%` : 'Export'}
          </button>
        </div>
      </div>

      {/* Middle Work Area (Sidebar + Assets + Video Canvas + Inspector) */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Far-Left Vertical Icon Tab Bar */}
        <div
          style={{
            width: '68px',
            backgroundColor: '#141418',
            borderRight: '1px solid #26262E',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '16px 0',
            gap: '16px',
          }}
        >
          <div
            onClick={() => setActiveTab('media')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              color: activeTab === 'media' ? '#E2F952' : '#64748B',
              cursor: 'pointer',
            }}
          >
            <FileVideo size={20} />
            <span style={{ fontSize: '10px', fontWeight: 500 }}>Media</span>
          </div>

          <div
            onClick={() => setActiveTab('effects')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              color: activeTab === 'effects' ? '#E2F952' : '#64748B',
              cursor: 'pointer',
            }}
          >
            <Sparkles size={20} />
            <span style={{ fontSize: '10px', fontWeight: 500 }}>Effects</span>
          </div>

          <div
            onClick={() => setActiveTab('text')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              color: activeTab === 'text' ? '#E2F952' : '#64748B',
              cursor: 'pointer',
            }}
          >
            <Type size={20} />
            <span style={{ fontSize: '10px', fontWeight: 500 }}>Text</span>
          </div>

          <div
            onClick={() => setActiveTab('audio')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              color: activeTab === 'audio' ? '#E2F952' : '#64748B',
              cursor: 'pointer',
            }}
          >
            <Music size={20} />
            <span style={{ fontSize: '10px', fontWeight: 500 }}>Audio</span>
          </div>

          <div style={{ flex: 1 }} />

          {/* AI Assistant Button Pill in Left Tab Bar */}
          <div
            onClick={() => onNavigate('ai')}
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '4px',
              padding: '8px 10px',
              borderRadius: '20px',
              backgroundColor: '#1C1C22',
              border: '1px solid #2E2E38',
              color: '#E2F952',
              cursor: 'pointer',
            }}
            title="Open AI Assistant"
          >
            <Sparkles size={18} />
            <span style={{ fontSize: '9px', fontWeight: 600 }}>AI Assistant</span>
          </div>
        </div>

        {/* Media / Asset Browser Panel with Drag & Drop */}
        <div
          style={{
            width: '280px',
            backgroundColor: '#111115',
            borderRight: '1px solid #26262E',
            display: 'flex',
            flexDirection: 'column',
            padding: '16px',
            overflowY: 'auto',
          }}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
              handleImportAssetFile({ target: { files: e.dataTransfer.files } } as any);
            }
          }}
        >
          {/* Filter Pills */}
          <div style={{ display: 'flex', gap: '6px', marginBottom: '16px' }}>
            {(['all', 'video', 'images', 'audio'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setAssetFilter(filter)}
                style={{
                  padding: '4px 10px',
                  borderRadius: '14px',
                  fontSize: '11px',
                  fontWeight: 500,
                  border: 'none',
                  cursor: 'pointer',
                  backgroundColor: assetFilter === filter ? '#E2F952' : '#1C1C22',
                  color: assetFilter === filter ? '#0D0D10' : '#94A3B8',
                  textTransform: 'capitalize',
                }}
              >
                {filter}
              </button>
            ))}
          </div>

          {/* Asset Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
            {/* Import Button Card */}
            <div
              onClick={() => fileInputRef.current?.click()}
              style={{
                height: '94px',
                border: '1px dashed #2E2E38',
                borderRadius: '8px',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
                cursor: 'pointer',
                backgroundColor: 'rgba(255,255,255,0.01)',
              }}
            >
              <Plus size={20} color="#64748B" />
              <span style={{ fontSize: '11px', color: '#64748B' }}>Add Media</span>
            </div>

            {assetsList.map((asset) => (
              <div
                key={asset.id}
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData('text/plain', asset.id);
                  e.dataTransfer.effectAllowed = 'copy';
                }}
                onClick={() => {
                  // Direct click adds to timeline
                  const isVideo = asset.type === 'video';
                  const targetTrack = isVideo
                    ? project.timeline.tracks.find((t) => t.type === 'video') || project.timeline.tracks[0]
                    : project.timeline.tracks.find((t) => t.type === 'audio') || project.timeline.tracks[0];

                  if (targetTrack) {
                    const newClip: Clip = isVideo
                      ? {
                          id: `clip_${Date.now()}`,
                          name: asset.name,
                          type: 'video',
                          assetId: asset.id,
                          start: currentTime,
                          duration: asset.duration || 6,
                          in: 0,
                          out: asset.duration || 6,
                          speed: 1,
                          opacity: 1,
                          locked: false,
                          keyframes: {},
                          effects: [],
                          transform: {
                            position: { x: 0, y: 0 },
                            scale: { x: 1, y: 1 },
                            rotation: 0,
                            anchor: { x: 0.5, y: 0.5 },
                          },
                        }
                      : {
                          id: `clip_${Date.now()}`,
                          name: asset.name,
                          type: 'audio',
                          assetId: asset.id,
                          start: currentTime,
                          duration: asset.duration || 10,
                          in: 0,
                          out: asset.duration || 10,
                          speed: 1,
                          opacity: 1,
                          locked: false,
                          keyframes: {},
                          effects: [],
                          volume: 0.8,
                          fadeIn: 0,
                          fadeOut: 0,
                          transform: {
                            position: { x: 0, y: 0 },
                            scale: { x: 1, y: 1 },
                            rotation: 0,
                            anchor: { x: 0.5, y: 0.5 },
                          },
                        };

                    globalStore.dispatch(new AddClipCommand(targetTrack.id, newClip));
                    globalSelection.select({ type: 'clip', id: newClip.id });
                  }
                }}
                style={{
                  height: '94px',
                  backgroundColor: '#18181E',
                  borderRadius: '8px',
                  border: '1px solid #24242E',
                  overflow: 'hidden',
                  cursor: 'grab',
                  position: 'relative',
                }}
                title="Click or drag to timeline"
              >
                <div
                  style={{
                    height: '64px',
                    backgroundColor: '#1F1F28',
                    backgroundImage: asset.thumbnail ? `url(${asset.thumbnail})` : undefined,
                    backgroundSize: 'cover',
                    backgroundPosition: 'center',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {!asset.thumbnail && <FileVideo size={20} color="#64748B" />}
                </div>
                <div
                  style={{
                    padding: '4px 6px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '10px',
                    color: '#CBD5E1',
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '75px' }}>
                    {asset.name}
                  </span>
                  <span style={{ color: '#64748B' }}>
                    {asset.duration ? formatTimecode(asset.duration) : '--:--'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Center: Video Preview Canvas */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#0A0A0D',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: '16px',
          }}
        >
          {/* Dynamic Motion Link Pill */}
          {selectedClip && selectedClip.type === 'motionComposition' && (
            <div
              style={{
                position: 'absolute',
                top: '20px',
                zIndex: 10,
                backgroundColor: 'rgba(28, 28, 36, 0.95)',
                border: '1px solid #9D7BFF',
                boxShadow: '0 4px 20px rgba(157, 123, 255, 0.25)',
                borderRadius: '30px',
                padding: '6px 16px',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
              }}
            >
              <span style={{ fontSize: '12px', color: '#FFFFFF' }}>
                Selected: <strong>{selectedClip.name}</strong> (Dynamic Motion Link)
              </span>
              <button
                onClick={() => onOpenMotionComp((selectedClip as MotionCompositionClip).compositionId)}
                style={{
                  backgroundColor: '#9D7BFF',
                  color: '#0D0D10',
                  border: 'none',
                  borderRadius: '16px',
                  padding: '4px 12px',
                  fontSize: '11px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                Open in Motion
                <ArrowRight size={12} />
              </button>
            </div>
          )}

          {/* Canvas container */}
          <div
            style={{
              position: 'relative',
              width: '320px',
              height: '400px',
              borderRadius: '8px',
              overflow: 'hidden',
              boxShadow: '0 8px 32px rgba(0,0,0,0.6)',
              border: '1px solid #24242E',
            }}
          >
            <canvas
              ref={canvasRef}
              width={1080}
              height={1350}
              style={{
                width: '100%',
                height: '100%',
                display: 'block',
                backgroundColor: '#000000',
              }}
            />
          </div>

          {/* Preview Controls Bar */}
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '16px',
              backgroundColor: 'rgba(20, 20, 24, 0.9)',
              border: '1px solid #26262E',
              borderRadius: '24px',
              padding: '6px 16px',
              backdropFilter: 'blur(8px)',
            }}
          >
            {/* Timecode */}
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', fontVariantNumeric: 'tabular-nums' }}>
              <span>{formatTimecode(currentTime)}</span>
              <span style={{ color: '#64748B', margin: '0 4px' }}>/</span>
              <span style={{ color: '#94A3B8' }}>{formatTimecode(project.settings.duration)}</span>
            </div>

            <div style={{ width: '1px', height: '14px', backgroundColor: '#2E2E38' }} />

            {/* Transport controls */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                onClick={() => globalStore.setCurrentTime(0)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                title="Jump to Start"
              >
                <SkipBack size={16} />
              </button>
              <button
                onClick={() => handleStepFrame(-1)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                title="Step 1 Frame Back"
              >
                <ChevronLeft size={16} />
              </button>
              <button
                onClick={handlePlayPause}
                style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#FFFFFF',
                  color: '#0D0D10',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                {isPlaying ? <Pause size={14} fill="#0D0D10" /> : <Play size={14} fill="#0D0D10" />}
              </button>
              <button
                onClick={() => handleStepFrame(1)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                title="Step 1 Frame Forward"
              >
                <ChevronRight size={16} />
              </button>
              <button
                onClick={() => globalStore.setCurrentTime(project.settings.duration)}
                style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                title="Jump to End"
              >
                <SkipForward size={16} />
              </button>
            </div>

            <div style={{ width: '1px', height: '14px', backgroundColor: '#2E2E38' }} />

            {/* Guides toggle */}
            <button
              onClick={() => setShowGuides(!showGuides)}
              style={{
                background: 'none',
                border: 'none',
                color: showGuides ? '#E2F952' : '#64748B',
                cursor: 'pointer',
              }}
              title="Toggle Guides"
            >
              <Grid size={16} />
            </button>
          </div>
        </div>

        {/* Right Inspector Panel */}
        {showInspector && (
          <div
            style={{
              width: '300px',
              backgroundColor: '#141418',
              borderLeft: '1px solid #26262E',
              display: 'flex',
              flexDirection: 'column',
              overflowY: 'auto',
              padding: '16px',
            }}
          >
            {selectedClip ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {/* Header with Name & Type */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>{selectedClip.name}</h3>
                    <span style={{ fontSize: '11px', color: '#9D7BFF', textTransform: 'uppercase', fontWeight: 600 }}>
                      {selectedClip.type}
                    </span>
                  </div>
                  <button
                    onClick={() => globalSelection.clear()}
                    style={{ background: 'none', border: 'none', color: '#64748B', cursor: 'pointer', fontSize: '12px' }}
                  >
                    Deselect
                  </button>
                </div>

                {/* Transform Controls */}
                <div style={{ backgroundColor: '#181820', borderRadius: '8px', padding: '12px', border: '1px solid #24242E' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '10px' }}>
                    TRANSFORM
                  </span>

                  {/* Position X / Y */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px' }}>
                    <span style={{ color: '#64748B' }}>Position</span>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="number"
                        value={selectedClip.transform.position.x}
                        onChange={(e) =>
                          globalStore.dispatch(
                            new SetClipPropertyCommand(selectedClip!.id, 'transform.position.x', Number(e.target.value))
                          )
                        }
                        style={{ width: '56px', background: '#121216', border: '1px solid #2A2A36', color: '#FFF', padding: '3px 6px', borderRadius: '4px', fontSize: '11px' }}
                      />
                      <input
                        type="number"
                        value={selectedClip.transform.position.y}
                        onChange={(e) =>
                          globalStore.dispatch(
                            new SetClipPropertyCommand(selectedClip!.id, 'transform.position.y', Number(e.target.value))
                          )
                        }
                        style={{ width: '56px', background: '#121216', border: '1px solid #2A2A36', color: '#FFF', padding: '3px 6px', borderRadius: '4px', fontSize: '11px' }}
                      />
                    </div>
                  </div>

                  {/* Scale */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px' }}>
                    <span style={{ color: '#64748B' }}>Scale</span>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.05"
                      value={selectedClip.transform.scale.x}
                      onChange={(e) => {
                        const s = Number(e.target.value);
                        globalStore.dispatch(new SetClipPropertyCommand(selectedClip!.id, 'transform.scale.x', s));
                        globalStore.dispatch(new SetClipPropertyCommand(selectedClip!.id, 'transform.scale.y', s));
                      }}
                      style={{ width: '120px', accentColor: '#E2F952' }}
                    />
                  </div>

                  {/* Rotation */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '12px' }}>
                    <span style={{ color: '#64748B' }}>Rotation</span>
                    <input
                      type="number"
                      value={selectedClip.transform.rotation}
                      onChange={(e) =>
                        globalStore.dispatch(
                          new SetClipPropertyCommand(selectedClip!.id, 'transform.rotation', Number(e.target.value))
                        )
                      }
                      style={{ width: '56px', background: '#121216', border: '1px solid #2A2A36', color: '#FFF', padding: '3px 6px', borderRadius: '4px', fontSize: '11px' }}
                    />
                  </div>

                  {/* Opacity */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#64748B' }}>Opacity</span>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={selectedClip.opacity}
                      onChange={(e) =>
                        globalStore.dispatch(
                          new SetClipPropertyCommand(selectedClip!.id, 'opacity', Number(e.target.value))
                        )
                      }
                      style={{ width: '120px', accentColor: '#E2F952' }}
                    />
                  </div>
                </div>

                {/* Speed Controls */}
                <div style={{ backgroundColor: '#181820', borderRadius: '8px', padding: '12px', border: '1px solid #24242E' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8' }}>SPEED</span>
                    <span style={{ fontSize: '12px', color: '#E2F952', fontWeight: 600 }}>{selectedClip.speed}x</span>
                  </div>

                  <div style={{ display: 'flex', gap: '6px' }}>
                    {[0.5, 0.75, 1.0, 1.5, 2.0].map((spd) => (
                      <button
                        key={spd}
                        onClick={() =>
                          globalStore.dispatch(new SetClipPropertyCommand(selectedClip!.id, 'speed', spd))
                        }
                        style={{
                          flex: 1,
                          padding: '4px 0',
                          borderRadius: '4px',
                          border: 'none',
                          cursor: 'pointer',
                          fontSize: '11px',
                          backgroundColor: selectedClip!.speed === spd ? '#E2F952' : '#22222E',
                          color: selectedClip!.speed === spd ? '#0D0D10' : '#CBD5E1',
                          fontWeight: selectedClip!.speed === spd ? 700 : 400,
                        }}
                      >
                        {spd}x
                      </button>
                    ))}
                  </div>
                </div>

                {/* Color & Effects Stack */}
                <div style={{ backgroundColor: '#181820', borderRadius: '8px', padding: '12px', border: '1px solid #24242E' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8' }}>EFFECTS & COLOR</span>
                    <button
                      onClick={() => {
                        const existing = selectedClip!.effects || [];
                        const newEff: ClipEffect = {
                          id: `eff_${Date.now()}`,
                          type: 'brightness',
                          value: 0.2,
                          enabled: true,
                        };
                        globalStore.dispatch(
                          new SetClipPropertyCommand(selectedClip!.id, 'effects', [...existing, newEff])
                        );
                      }}
                      style={{
                        background: '#22222E',
                        border: '1px solid #323240',
                        borderRadius: '4px',
                        color: '#E2F952',
                        fontSize: '10px',
                        padding: '2px 8px',
                        cursor: 'pointer',
                      }}
                    >
                      + Add Effect
                    </button>
                  </div>

                  {/* Render list of active effects */}
                  {(selectedClip.effects || []).map((eff, idx) => (
                    <div
                      key={eff.id}
                      style={{
                        backgroundColor: '#121216',
                        borderRadius: '6px',
                        padding: '8px',
                        marginBottom: '6px',
                        border: '1px solid #22222A',
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                        <select
                          value={eff.type}
                          onChange={(e) => {
                            const updated = [...(selectedClip!.effects || [])];
                            updated[idx] = { ...eff, type: e.target.value as any };
                            globalStore.dispatch(new SetClipPropertyCommand(selectedClip!.id, 'effects', updated));
                          }}
                          style={{
                            background: '#1A1A22',
                            color: '#FFF',
                            border: '1px solid #2A2A34',
                            borderRadius: '4px',
                            fontSize: '11px',
                            padding: '2px 4px',
                          }}
                        >
                          <option value="brightness">Brightness</option>
                          <option value="contrast">Contrast</option>
                          <option value="saturation">Saturation</option>
                          <option value="blur">Blur</option>
                          <option value="grayscale">Grayscale</option>
                          <option value="sepia">Sepia</option>
                        </select>

                        <button
                          onClick={() => {
                            const updated = (selectedClip!.effects || []).filter((_, i) => i !== idx);
                            globalStore.dispatch(new SetClipPropertyCommand(selectedClip!.id, 'effects', updated));
                          }}
                          style={{ background: 'none', border: 'none', color: '#EF4444', cursor: 'pointer', fontSize: '11px' }}
                        >
                          ✕
                        </button>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <input
                          type="range"
                          min={eff.type === 'blur' ? '0' : '-0.8'}
                          max={eff.type === 'blur' ? '20' : '1.5'}
                          step="0.05"
                          value={eff.value}
                          onChange={(e) => {
                            const updated = [...(selectedClip!.effects || [])];
                            updated[idx] = { ...eff, value: Number(e.target.value) };
                            globalStore.dispatch(new SetClipPropertyCommand(selectedClip!.id, 'effects', updated));
                          }}
                          style={{ flex: 1, accentColor: '#E2F952' }}
                        />
                        <span style={{ fontSize: '10px', color: '#94A3B8', width: '32px', textAlign: 'right' }}>
                          {eff.value.toFixed(2)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Transition Settings */}
                <div style={{ backgroundColor: '#181820', borderRadius: '8px', padding: '12px', border: '1px solid #24242E' }}>
                  <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '8px' }}>
                    IN-TRANSITION
                  </span>

                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <select
                      value={selectedClip.transition?.type || 'none'}
                      onChange={(e) => {
                        const val = e.target.value as any;
                        const trans: ClipTransition = {
                          type: val,
                          duration: selectedClip!.transition?.duration || 0.5,
                        };
                        globalStore.dispatch(new SetClipPropertyCommand(selectedClip!.id, 'transition', trans));
                      }}
                      style={{
                        flex: 1,
                        background: '#121216',
                        color: '#FFF',
                        border: '1px solid #2A2A36',
                        borderRadius: '4px',
                        padding: '4px 6px',
                        fontSize: '11px',
                      }}
                    >
                      <option value="none">None</option>
                      <option value="crossDissolve">Cross Dissolve</option>
                      <option value="dipToBlack">Dip to Black</option>
                      <option value="slideLeft">Slide Left</option>
                      <option value="wipe">Wipe</option>
                    </select>
                  </div>

                  {selectedClip.transition && selectedClip.transition.type !== 'none' && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px' }}>
                      <span style={{ color: '#64748B' }}>Duration</span>
                      <input
                        type="number"
                        step="0.1"
                        min="0.1"
                        max="3"
                        value={selectedClip.transition.duration}
                        onChange={(e) => {
                          const trans = { ...selectedClip!.transition!, duration: Number(e.target.value) };
                          globalStore.dispatch(new SetClipPropertyCommand(selectedClip!.id, 'transition', trans));
                        }}
                        style={{ width: '50px', background: '#121216', border: '1px solid #2A2A36', color: '#FFF', padding: '2px 4px', borderRadius: '4px' }}
                      />
                    </div>
                  )}
                </div>

                {/* Audio controls if audio or video clip */}
                {(selectedClip.type === 'audio' || 'volume' in (selectedClip as any)) && (
                  <div style={{ backgroundColor: '#181820', borderRadius: '8px', padding: '12px', border: '1px solid #24242E' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8', display: 'block', marginBottom: '8px' }}>
                      AUDIO VOLUME
                    </span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Volume2 size={14} color="#64748B" />
                      <input
                        type="range"
                        min="0"
                        max="1"
                        step="0.05"
                        value={(selectedClip as AudioClip).volume ?? 1}
                        onChange={(e) =>
                          globalStore.dispatch(
                            new SetClipPropertyCommand(selectedClip!.id, 'volume', Number(e.target.value))
                          )
                        }
                        style={{ flex: 1, accentColor: '#22C55E' }}
                      />
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div style={{ padding: '24px 0', textAlign: 'center', color: '#64748B', fontSize: '12px' }}>
                Select a clip on the timeline to edit properties, color, effects, and transitions.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Multitrack Timeline Area */}
      <div
        style={{
          height: '280px',
          backgroundColor: '#121216',
          borderTop: '1px solid #26262E',
          display: 'flex',
          flexDirection: 'column',
          userSelect: 'none',
        }}
      >
        {/* Timeline Toolbar */}
        <div
          style={{
            height: '36px',
            backgroundColor: '#141418',
            borderBottom: '1px solid #202028',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleSplitAtPlayhead}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                background: '#1C1C22',
                border: '1px solid #282834',
                color: '#FFFFFF',
                borderRadius: '6px',
                padding: '4px 10px',
                fontSize: '12px',
                cursor: 'pointer',
              }}
              title="Split Clip at Playhead (Cmd+B)"
            >
              <Scissors size={13} />
              Split
            </button>

            {selectedClip && (
              <>
                <button
                  onClick={handleDuplicateSelected}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#1C1C22',
                    border: '1px solid #282834',
                    color: '#FFFFFF',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                  title="Duplicate Clip (Cmd+D)"
                >
                  <Copy size={13} />
                  Duplicate
                </button>

                <button
                  onClick={handleRippleDeleteSelected}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    background: '#1C1C22',
                    border: '1px solid #3F1D24',
                    color: '#F87171',
                    borderRadius: '6px',
                    padding: '4px 10px',
                    fontSize: '12px',
                    cursor: 'pointer',
                  }}
                  title="Ripple Delete (Shift+Backspace)"
                >
                  <Trash2 size={13} />
                  Ripple Del
                </button>
              </>
            )}

            {/* Add Track Dropdown / Button */}
            <button
              onClick={() => globalStore.dispatch(new AddTrackCommand('video'))}
              style={{
                background: '#1C1C22',
                border: '1px solid #282834',
                color: '#94A3B8',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
              title="Add Video Track"
            >
              + Video Track
            </button>
            <button
              onClick={() => globalStore.dispatch(new AddTrackCommand('audio'))}
              style={{
                background: '#1C1C22',
                border: '1px solid #282834',
                color: '#94A3B8',
                borderRadius: '6px',
                padding: '4px 8px',
                fontSize: '11px',
                cursor: 'pointer',
              }}
              title="Add Audio Track"
            >
              + Audio Track
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: '#64748B' }}>Zoom</span>
            <input
              type="range"
              min="20"
              max="120"
              value={timelineZoom}
              onChange={(e) => setTimelineZoom(Number(e.target.value))}
              style={{ width: '80px', accentColor: '#E2F952' }}
            />
          </div>
        </div>

        {/* Main Timeline Viewport (Ruler + Tracks) */}
        <div
          ref={timelineScrollRef}
          onClick={(e) => {
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left - 180 + (timelineScrollRef.current?.scrollLeft || 0);
            if (clickX >= 0) {
              const clickedTime = clickX / timelineZoom;
              handleSeek(clickedTime);
            }
          }}
          style={{
            flex: 1,
            overflowX: 'auto',
            overflowY: 'auto',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Timeline Ruler */}
          <div
            style={{
              height: '24px',
              backgroundColor: '#16161C',
              borderBottom: '1px solid #24242E',
              display: 'flex',
              position: 'relative',
              width: `${180 + project.settings.duration * timelineZoom}px`,
            }}
          >
            {/* Header spacer */}
            <div style={{ width: '180px', borderRight: '1px solid #24242E', flexShrink: 0 }} />

            {/* Time ticks */}
            <div style={{ flex: 1, position: 'relative' }}>
              {Array.from({ length: Math.ceil(project.settings.duration / 5) + 1 }).map((_, i) => {
                const sec = i * 5;
                const left = sec * timelineZoom;
                return (
                  <div
                    key={sec}
                    style={{
                      position: 'absolute',
                      left: `${left}px`,
                      top: 0,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      justifyContent: 'flex-end',
                      fontSize: '10px',
                      color: '#64748B',
                      paddingLeft: '4px',
                    }}
                  >
                    <span>{formatTimecode(sec)}</span>
                    <div style={{ width: '1px', height: '6px', backgroundColor: '#323240' }} />
                  </div>
                );
              })}
            </div>
          </div>

          {/* Tracks Area */}
          <div
            ref={tracksContainerRef}
            style={{ position: 'relative', width: `${180 + project.settings.duration * timelineZoom}px`, flex: 1 }}
          >
            {/* Visual Snap Guide Line */}
            {snapLineTime !== null && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  left: `${180 + snapLineTime * timelineZoom}px`,
                  width: '1px',
                  backgroundColor: '#E2F952',
                  boxShadow: '0 0 8px #E2F952',
                  zIndex: 25,
                  pointerEvents: 'none',
                }}
              />
            )}

            {/* Draggable Playhead Marker */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: `${180 + currentTime * timelineZoom}px`,
                width: '2px',
                backgroundColor: '#E2F952',
                zIndex: 30,
                pointerEvents: 'none',
              }}
            >
              {/* Playhead Badge */}
              <div
                style={{
                  position: 'absolute',
                  top: '-20px',
                  left: '-24px',
                  width: '50px',
                  height: '20px',
                  borderRadius: '10px',
                  backgroundColor: '#E2F952',
                  color: '#0D0D10',
                  fontSize: '10px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {formatTimecode(currentTime)}
              </div>
            </div>

            {/* Render each Track */}
            {project.timeline.tracks.map((track) => {
              const isGraphics = track.type === 'graphics';
              const isVideo = track.type === 'video';
              const isAudio = track.type === 'audio';

              return (
                <div
                  key={track.id}
                  data-track-id={track.id}
                  data-track-type={track.type}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'copy';
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const assetId = e.dataTransfer.getData('text/plain');
                    const asset = project.assets[assetId];
                    if (asset) {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const dropX = e.clientX - rect.left - 180 + (timelineScrollRef.current?.scrollLeft || 0);
                      const dropTime = Math.max(0, dropX / timelineZoom);

                      const newClip: Clip = asset.type === 'audio'
                        ? {
                            id: `clip_${Date.now()}`,
                            name: asset.name,
                            type: 'audio',
                            assetId: asset.id,
                            start: dropTime,
                            duration: asset.duration || 10,
                            in: 0,
                            out: asset.duration || 10,
                            speed: 1,
                            opacity: 1,
                            locked: false,
                            volume: 0.8,
                            fadeIn: 0,
                            fadeOut: 0,
                            keyframes: {},
                            effects: [],
                            transform: {
                              position: { x: 0, y: 0 },
                              scale: { x: 1, y: 1 },
                              rotation: 0,
                              anchor: { x: 0.5, y: 0.5 },
                            },
                          }
                        : {
                            id: `clip_${Date.now()}`,
                            name: asset.name,
                            type: 'video',
                            assetId: asset.id,
                            start: dropTime,
                            duration: asset.duration || 6,
                            in: 0,
                            out: asset.duration || 6,
                            speed: 1,
                            opacity: 1,
                            locked: false,
                            keyframes: {},
                            effects: [],
                            transform: {
                              position: { x: 0, y: 0 },
                              scale: { x: 1, y: 1 },
                              rotation: 0,
                              anchor: { x: 0.5, y: 0.5 },
                            },
                          };

                      globalStore.dispatch(new AddClipCommand(track.id, newClip));
                      globalSelection.select({ type: 'clip', id: newClip.id });
                    }
                  }}
                  style={{
                    height: isAudio ? '48px' : '56px',
                    borderBottom: '1px solid #1E1E26',
                    display: 'flex',
                    position: 'relative',
                  }}
                >
                  {/* Track Header */}
                  <div
                    style={{
                      width: '180px',
                      backgroundColor: '#141418',
                      borderRight: '1px solid #24242E',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0 12px',
                      zIndex: 10,
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div
                        style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          backgroundColor: isGraphics ? '#9D7BFF' : isVideo ? '#38BDF8' : '#22C55E',
                        }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 500, color: '#CBD5E1' }}>
                        {track.name}
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748B' }}>
                      <span
                        onClick={() => {
                          const updated = project.timeline.tracks.map((t) =>
                            t.id === track.id ? { ...t, visible: !t.visible } : t
                          );
                          globalStore.dispatch(new SetClipPropertyCommand('root', 'timeline.tracks', updated));
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {track.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      </span>
                      <span
                        onClick={() => {
                          const updated = project.timeline.tracks.map((t) =>
                            t.id === track.id ? { ...t, locked: !t.locked } : t
                          );
                          globalStore.dispatch(new SetClipPropertyCommand('root', 'timeline.tracks', updated));
                        }}
                        style={{ cursor: 'pointer' }}
                      >
                        {track.locked ? <Lock size={13} /> : <Unlock size={13} />}
                      </span>
                    </div>
                  </div>

                  {/* Track Content (Clips) */}
                  <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                    {track.clips.map((clip) => {
                      const isSelected = selection.type === 'clip' && selection.id === clip.id;
                      const isBeingDragged = dragState?.clipId === clip.id;
                      const isBeingTrimmed = trimState?.clipId === clip.id;

                      const activeStart = isBeingDragged
                        ? dragState.currentStart
                        : isBeingTrimmed
                        ? trimState.currentStart
                        : clip.start;

                      const activeDuration = isBeingTrimmed ? trimState.currentDuration : clip.duration;

                      const clipLeft = activeStart * timelineZoom;
                      const clipWidth = Math.max(10, activeDuration * timelineZoom);

                      const isMotion = clip.type === 'motionComposition';
                      const isText = clip.type === 'text';
                      const isAud = clip.type === 'audio';

                      let bgColor = '#242432';
                      let borderColor = '#38384E';
                      if (isMotion || isText) {
                        bgColor = '#6D28D9';
                        borderColor = '#9D7BFF';
                      } else if (isAud) {
                        bgColor = '#164E63';
                        borderColor = '#22C55E';
                      }

                      return (
                        <div
                          key={clip.id}
                          onPointerDown={(e) => {
                            e.stopPropagation();
                            globalSelection.select({ type: 'clip', id: clip.id });

                            const rect = e.currentTarget.getBoundingClientRect();
                            const clickOffset = e.clientX - rect.left;

                            // Left trim handle (first 10px)
                            if (clickOffset <= 10) {
                              setTrimState({
                                clipId: clip.id,
                                handle: 'left',
                                startX: e.clientX,
                                originalStart: clip.start,
                                originalDuration: clip.duration,
                                originalIn: clip.in,
                                originalOut: clip.out,
                                currentStart: clip.start,
                                currentDuration: clip.duration,
                              });
                            }
                            // Right trim handle (last 10px)
                            else if (clickOffset >= rect.width - 10) {
                              setTrimState({
                                clipId: clip.id,
                                handle: 'right',
                                startX: e.clientX,
                                originalStart: clip.start,
                                originalDuration: clip.duration,
                                originalIn: clip.in,
                                originalOut: clip.out,
                                currentStart: clip.start,
                                currentDuration: clip.duration,
                              });
                            }
                            // Body drag
                            else {
                              setDragState({
                                clipId: clip.id,
                                originalStart: clip.start,
                                originalTrackId: track.id,
                                startX: e.clientX,
                                startY: e.clientY,
                                currentStart: clip.start,
                                targetTrackId: track.id,
                              });
                            }
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (clip.type === 'motionComposition') {
                              onOpenMotionComp((clip as MotionCompositionClip).compositionId);
                            }
                          }}
                          style={{
                            position: 'absolute',
                            left: `${clipLeft}px`,
                            top: '4px',
                            bottom: '4px',
                            width: `${clipWidth}px`,
                            backgroundColor: bgColor,
                            borderRadius: '6px',
                            border: `2px solid ${isSelected ? '#E2F952' : borderColor}`,
                            boxShadow: isSelected ? '0 0 12px rgba(226, 249, 82, 0.4)' : 'none',
                            cursor: 'grab',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            overflow: 'hidden',
                            opacity: isBeingDragged ? 0.75 : 1,
                            zIndex: isSelected || isBeingDragged ? 20 : 5,
                          }}
                        >
                          {/* Left Trim Handle Visual */}
                          <div
                            style={{
                              position: 'absolute',
                              left: 0,
                              top: 0,
                              bottom: 0,
                              width: '8px',
                              cursor: 'col-resize',
                              backgroundColor: 'rgba(255,255,255,0.08)',
                            }}
                            title="Trim Start"
                          />

                          {/* Right Trim Handle Visual */}
                          <div
                            style={{
                              position: 'absolute',
                              right: 0,
                              top: 0,
                              bottom: 0,
                              width: '8px',
                              cursor: 'col-resize',
                              backgroundColor: 'rgba(255,255,255,0.08)',
                            }}
                            title="Trim End"
                          />

                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span style={{ fontSize: '11px', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap' }}>
                              {clip.name}
                            </span>
                            {isMotion && (
                              <span style={{ fontSize: '9px', backgroundColor: '#9D7BFF', color: '#0D0D10', padding: '1px 4px', borderRadius: '3px', fontWeight: 700 }}>
                                MOTION
                              </span>
                            )}
                          </div>

                          {/* Audio Waveform visualization */}
                          {isAud && (
                            <div style={{ display: 'flex', alignItems: 'center', height: '18px', gap: '2px', opacity: 0.8 }}>
                              {Array.from({ length: Math.min(80, Math.floor(clipWidth / 4)) }).map((_, idx) => {
                                const h = 30 + Math.sin(idx * 0.4) * 50;
                                return (
                                  <div
                                    key={idx}
                                    style={{
                                      width: '2px',
                                      height: `${h}%`,
                                      backgroundColor: '#22C55E',
                                      borderRadius: '1px',
                                    }}
                                  />
                                );
                              })}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
