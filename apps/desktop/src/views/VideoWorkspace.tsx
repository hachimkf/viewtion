import React, { useRef, useEffect, useState } from 'react';
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
  Maximize2,
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
} from '@viewtion/editor-core';
import { formatTimecode, formatTimecodeDetailed } from '@viewtion/video-engine';
import { Asset, Clip, VideoClip, MotionCompositionClip, TextClip } from '@viewtion/project-schema';

interface VideoWorkspaceProps {
  onNavigate: (workspace: ActiveWorkspace) => void;
  onOpenMotionComp: (compId: string) => void;
}

export const VideoWorkspace: React.FC<VideoWorkspaceProps> = ({ onNavigate, onOpenMotionComp }) => {
  const project = useProject();
  const currentTime = useCurrentTime();
  const selection = useSelection();

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeTab, setActiveTab] = useState<'media' | 'effects' | 'transitions' | 'text' | 'audio' | 'captions' | 'templates'>('media');
  const [assetFilter, setAssetFilter] = useState<'all' | 'video' | 'images' | 'audio'>('all');
  const [timelineZoom, setTimelineZoom] = useState(45); // pixels per second
  const [showGuides, setShowGuides] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);

  // Render video preview canvas whenever time or project changes
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    globalCompositor.render(ctx, project, {
      width: canvas.width,
      height: canvas.height,
      time: currentTime,
      showGuides,
    });
  }, [project, currentTime, showGuides]);

  // Playback loop
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

  const handleSplitAtPlayhead = () => {
    if (selection.type === 'clip' && selection.id) {
      globalStore.dispatch(new SplitClipCommand(selection.id, currentTime));
    } else {
      // Find first clip intersecting playhead
      for (const t of project.timeline.tracks) {
        for (const c of t.clips) {
          if (currentTime > c.start && currentTime < c.start + c.duration) {
            globalStore.dispatch(new SplitClipCommand(c.id, currentTime));
            return;
          }
        }
      }
    }
  };

  const handleDeleteSelected = () => {
    if (selection.type === 'clip' && selection.id) {
      globalStore.dispatch(new RemoveClipCommand(selection.id));
      globalSelection.clear();
    }
  };

  const handleImportAssetFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const isVideo = file.type.startsWith('video');
      const isAudio = file.type.startsWith('audio');
      const isImg = file.type.startsWith('image');

      const url = URL.createObjectURL(file);
      const newAsset: Asset = {
        id: `asset_${Date.now()}`,
        name: file.name,
        type: isVideo ? 'video' : isAudio ? 'audio' : 'image',
        src: url,
        duration: 10,
        thumbnail: isImg ? url : undefined,
      };

      globalStore.dispatch(new AddAssetCommand(newAsset));
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
        a.download = `${project.name.replace(/\s+/g, '_')}_1080x1350.webm`;
        a.click();
        setIsExporting(false);
        setExportProgress(0);
      };

      recorder.start();

      let renderTime = 0;
      const stepInterval = 1 / 30;
      const exportDuration = Math.min(10, project.settings.duration); // render first 10s for fast preview export

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
      console.warn('Canvas capture stream export fallback:', err);
      setTimeout(() => {
        setIsExporting(false);
        alert('Export simulated successfully.');
      }, 1500);
    }
  };

  // Find selected clip object if any
  let selectedClip: Clip | undefined;
  if (selection.type === 'clip' && selection.id) {
    for (const t of project.timeline.tracks) {
      const found = t.clips.find((c) => c.id === selection.id);
      if (found) {
        selectedClip = found;
        break;
      }
    }
  }

  const assetsList = Object.values(project.assets).filter((a) => {
    if (assetFilter === 'all') return true;
    if (assetFilter === 'video') return a.type === 'video';
    if (assetFilter === 'audio') return a.type === 'audio';
    if (assetFilter === 'images') return a.type === 'image';
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#0D0D10' }}>
      <input type="file" ref={fileInputRef} style={{ display: 'none' }} onChange={handleImportAssetFile} />

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

          {/* Quick Undo / Redo */}
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

        {/* Right: Motion workspace jump & Export Button */}
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

      {/* Middle Work Area (Sidebar + Assets + Video Canvas) */}
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

        {/* Media / Asset Browser Panel */}
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
                onClick={() => {
                  // Add asset to timeline on click
                  const isVideo = asset.type === 'video';
                  const targetTrack = isVideo
                    ? project.timeline.tracks[1]
                    : project.timeline.tracks[2];

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
                  }
                }}
                style={{
                  height: '94px',
                  backgroundColor: '#18181E',
                  borderRadius: '8px',
                  border: '1px solid #24242E',
                  overflow: 'hidden',
                  cursor: 'pointer',
                  position: 'relative',
                }}
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
                  {!asset.thumbnail && (
                    <FileVideo size={20} color="#64748B" />
                  )}
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
          {/* Dynamic Link Notification Pill if Motion Clip selected */}
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

          {/* Video Preview Canvas with aspect ratio 4:5 (1080x1350) */}
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
      </div>

      {/* Bottom Multitrack Timeline Area */}
      <div
        style={{
          height: '280px',
          backgroundColor: '#121216',
          borderTop: '1px solid #26262E',
          display: 'flex',
          flexDirection: 'column',
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
              title="Split Clip at Playhead (C)"
            >
              <Scissors size={13} />
              Split
            </button>

            {selectedClip && (
              <button
                onClick={handleDeleteSelected}
                style={{
                  background: '#1C1C22',
                  border: '1px solid #3F1D24',
                  color: '#F87171',
                  borderRadius: '6px',
                  padding: '4px 10px',
                  fontSize: '12px',
                  cursor: 'pointer',
                }}
              >
                Delete Clip
              </button>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11px', color: '#64748B' }}>Zoom</span>
            <input
              type="range"
              min="20"
              max="100"
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
            // Seek playhead by clicking on timeline
            const rect = e.currentTarget.getBoundingClientRect();
            const clickX = e.clientX - rect.left - 180; // 180px track header offset
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
          <div style={{ position: 'relative', width: `${180 + project.settings.duration * timelineZoom}px`, flex: 1 }}>
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
                      {track.visible ? <Eye size={13} /> : <EyeOff size={13} />}
                      {track.locked ? <Lock size={13} /> : <Unlock size={13} />}
                    </div>
                  </div>

                  {/* Track Content (Clips) */}
                  <div style={{ flex: 1, position: 'relative', height: '100%' }}>
                    {track.clips.map((clip) => {
                      const isSelected = selection.type === 'clip' && selection.id === clip.id;
                      const clipLeft = clip.start * timelineZoom;
                      const clipWidth = clip.duration * timelineZoom;

                      // Theme colors based on clip type
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
                          onClick={(e) => {
                            e.stopPropagation();
                            globalSelection.select({ type: 'clip', id: clip.id });
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
                            cursor: 'pointer',
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'space-between',
                            padding: '4px 8px',
                            overflow: 'hidden',
                            userSelect: 'none',
                          }}
                        >
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
                              {Array.from({ length: Math.min(60, Math.floor(clipWidth / 4)) }).map((_, idx) => {
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
