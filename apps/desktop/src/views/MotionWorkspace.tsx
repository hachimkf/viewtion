import React, { useRef, useEffect, useState } from 'react';
import {
  Layers,
  Sparkles,
  Play,
  Pause,
  RotateCcw,
  Plus,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  Type,
  Square,
  Circle,
  Film,
  Download,
  Sliders,
  ChevronDown,
  ArrowLeft,
  Grid,
} from 'lucide-react';
import {
  ActiveWorkspace,
  useProject,
  useSelection,
  globalStore,
  globalSelection,
} from '../state/editorState';
import {
  AddLayerCommand,
  SetLayerPropertyCommand,
  AddKeyframeCommand,
} from '@viewtion/editor-core';
import {
  renderMotionCompositionToCanvas,
  evaluateLayerAtTime,
  evaluateEasing,
} from '@viewtion/motion-engine';
import { formatTimecodeDetailed } from '@viewtion/video-engine';
import {
  MotionComposition,
  MotionLayer,
  MotionTextLayer,
  ShapeLayer,
  Keyframe,
} from '@viewtion/project-schema';

interface MotionWorkspaceProps {
  onNavigate: (workspace: ActiveWorkspace) => void;
  activeCompId: string;
}

export const MotionWorkspace: React.FC<MotionWorkspaceProps> = ({ onNavigate, activeCompId }) => {
  const project = useProject();
  const selection = useSelection();

  // Find active composition
  const comp: MotionComposition =
    project.motionCompositions[activeCompId] ||
    Object.values(project.motionCompositions)[0] || {
      id: 'default_comp',
      name: 'Logo Reveal',
      width: 1080,
      height: 1350,
      fps: 30,
      duration: 6,
      backgroundColor: '#0D0D10',
      layers: [],
    };

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [localTime, setLocalTime] = useState(2.5); // seconds
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedLayerId, setSelectedLayerId] = useState<string>('layer_text_01');
  const [inspectorTab, setInspectorTab] = useState<'transform' | 'text' | 'effects'>('transform');
  const [showCurveEditor, setShowCurveEditor] = useState(true);

  // Set default selected layer if exists
  useEffect(() => {
    if (comp.layers.length > 0 && !comp.layers.find((l) => l.id === selectedLayerId)) {
      setSelectedLayerId(comp.layers[0].id);
    }
  }, [comp, selectedLayerId]);

  // Canvas render loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    renderMotionCompositionToCanvas(ctx, comp, localTime, { clear: true });
  }, [comp, localTime]);

  // Animation ticker
  useEffect(() => {
    let animId: number;
    let lastStamp: number | null = null;

    if (isPlaying) {
      const step = (timestamp: number) => {
        if (lastStamp !== null) {
          const delta = (timestamp - lastStamp) / 1000;
          setLocalTime((prev) => {
            const next = prev + delta;
            return next >= comp.duration ? 0 : next;
          });
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
  }, [isPlaying, comp.duration]);

  const activeLayer = comp.layers.find((l) => l.id === selectedLayerId);

  const handleAddTextLayer = () => {
    const newText: MotionTextLayer = {
      id: `layer_text_${Date.now()}`,
      name: `Text ${comp.layers.length + 1}`,
      type: 'text',
      text: 'New Kinetic Title',
      fontSize: 54,
      fontFamily: 'Inter, sans-serif',
      fill: '#FFFFFF',
      start: 0,
      duration: comp.duration,
      visible: true,
      locked: false,
      transform: {
        position: { x: comp.width / 2, y: comp.height / 2 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
      },
      opacity: 1,
      blending: 'normal',
      keyframes: {},
    };
    globalStore.dispatch(new AddLayerCommand(comp.id, newText));
    setSelectedLayerId(newText.id);
  };

  const handleAddShapeLayer = () => {
    const newShape: ShapeLayer = {
      id: `layer_shape_${Date.now()}`,
      name: `Shape ${comp.layers.length + 1}`,
      type: 'shape',
      shapeType: 'rect',
      width: 240,
      height: 240,
      fill: '#E2F952',
      cornerRadius: 24,
      start: 0,
      duration: comp.duration,
      visible: true,
      locked: false,
      transform: {
        position: { x: comp.width / 2, y: comp.height / 2 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
      },
      opacity: 1,
      blending: 'normal',
      keyframes: {},
    };
    globalStore.dispatch(new AddLayerCommand(comp.id, newShape));
    setSelectedLayerId(newShape.id);
  };

  const handleAddKeyframe = (prop: string) => {
    if (!activeLayer) return;
    const evaluated = evaluateLayerAtTime(activeLayer, localTime);
    let val: any = 0;
    if (prop === 'opacity') val = evaluated.opacity;
    if (prop === 'rotation') val = evaluated.rotation;
    if (prop === 'scale.x') val = evaluated.scale.x;

    const kf: Keyframe = {
      id: `kf_${Date.now()}`,
      time: localTime,
      value: val,
      easing: 'easeInOut',
    };
    globalStore.dispatch(new AddKeyframeCommand(comp.id, activeLayer.id, prop, kf));
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', width: '100%', height: '100%', backgroundColor: '#0D0D10' }}>
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
        {/* Left: Viewtion Logo + Back to Video + Comp Selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button
            onClick={() => onNavigate('video')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backgroundColor: '#1C1C22',
              border: '1px solid #282834',
              borderRadius: '20px',
              padding: '5px 12px',
              color: '#FFFFFF',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={14} />
            Back to Video
          </button>

          <div style={{ width: '1px', height: '18px', backgroundColor: '#2E2E38' }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px', color: '#FFFFFF', fontWeight: 600 }}>
            <span style={{ color: '#9D7BFF' }}>✦</span>
            <span>{comp.name}</span>
            <span style={{ color: '#64748B', fontSize: '11px' }}>▾</span>
          </div>
        </div>

        {/* Center: Playback Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <button
            onClick={() => setLocalTime(0)}
            style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
            title="Reset to 0s"
          >
            <RotateCcw size={16} />
          </button>
          <button
            onClick={() => setIsPlaying(!isPlaying)}
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
          <span style={{ fontSize: '12px', color: '#94A3B8', fontVariantNumeric: 'tabular-nums' }}>
            {localTime.toFixed(2)}s / {comp.duration.toFixed(2)}s
          </span>
        </div>

        {/* Right: Zoom & Render Pill */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '12px',
              color: '#94A3B8',
              backgroundColor: '#1C1C22',
              padding: '4px 10px',
              borderRadius: '16px',
            }}
          >
            <span>100%</span>
            <ChevronDown size={12} />
          </div>

          <button
            onClick={() => alert(`Rendered ${comp.name} frame buffer successfully.`)}
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
            Render
          </button>
        </div>
      </div>

      {/* Middle Work Area (Layers Tree + Canvas + Inspector) */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Left: Layers Tree */}
        <div
          style={{
            width: '240px',
            backgroundColor: '#141418',
            borderRight: '1px solid #26262E',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Header */}
          <div
            style={{
              height: '42px',
              borderBottom: '1px solid #22222C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 14px',
            }}
          >
            <div style={{ display: 'flex', gap: '12px', fontSize: '12px', fontWeight: 600 }}>
              <span style={{ color: '#E2F952', borderBottom: '2px solid #E2F952', paddingBottom: '10px' }}>Layers</span>
              <span style={{ color: '#64748B' }}>Assets</span>
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                onClick={handleAddTextLayer}
                style={{ background: '#1C1C22', border: '1px solid #282834', borderRadius: '4px', color: '#FFF', padding: '3px 6px', cursor: 'pointer' }}
                title="Add Text Layer"
              >
                <Type size={12} />
              </button>
              <button
                onClick={handleAddShapeLayer}
                style={{ background: '#1C1C22', border: '1px solid #282834', borderRadius: '4px', color: '#FFF', padding: '3px 6px', cursor: 'pointer' }}
                title="Add Shape Layer"
              >
                <Square size={12} />
              </button>
            </div>
          </div>

          {/* Layer List */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
            {comp.layers.map((layer) => {
              const isSelected = selectedLayerId === layer.id;
              const isText = layer.type === 'text';
              const isShape = layer.type === 'shape';

              return (
                <div
                  key={layer.id}
                  onClick={() => setSelectedLayerId(layer.id)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    backgroundColor: isSelected ? '#242430' : 'transparent',
                    border: `1px solid ${isSelected ? '#3A3A4C' : 'transparent'}`,
                    marginBottom: '4px',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {isText ? <Type size={14} color="#9D7BFF" /> : <Square size={14} color="#E2F952" />}
                    <span style={{ fontSize: '12px', color: isSelected ? '#FFFFFF' : '#94A3B8', fontWeight: isSelected ? 600 : 400 }}>
                      {layer.name}
                    </span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#64748B' }}>
                    {layer.visible ? <Eye size={12} /> : <EyeOff size={12} />}
                    {layer.locked ? <Lock size={12} /> : <Unlock size={12} />}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Center: Canvas Viewport */}
        <div
          style={{
            flex: 1,
            backgroundColor: '#0A0A0D',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            position: 'relative',
            padding: '20px',
            overflow: 'hidden',
          }}
        >
          {/* Motion Canvas Container (with bounding box) */}
          <div
            style={{
              position: 'relative',
              width: '320px',
              height: '400px',
              boxShadow: '0 12px 48px rgba(0,0,0,0.8)',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #282834',
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
              }}
            />

            {/* Bounding box guide overlay for active layer */}
            {activeLayer && (
              <div
                style={{
                  position: 'absolute',
                  top: '25%',
                  left: '15%',
                  width: '70%',
                  height: '50%',
                  border: '1px dashed #E2F952',
                  pointerEvents: 'none',
                }}
              >
                {/* 4 corner transform handles */}
                <div style={{ position: 'absolute', top: '-4px', left: '-4px', width: '8px', height: '8px', backgroundColor: '#E2F952' }} />
                <div style={{ position: 'absolute', top: '-4px', right: '-4px', width: '8px', height: '8px', backgroundColor: '#E2F952' }} />
                <div style={{ position: 'absolute', bottom: '-4px', left: '-4px', width: '8px', height: '8px', backgroundColor: '#E2F952' }} />
                <div style={{ position: 'absolute', bottom: '-4px', right: '-4px', width: '8px', height: '8px', backgroundColor: '#E2F952' }} />
              </div>
            )}
          </div>
        </div>

        {/* Right: Inspector Panel */}
        <div
          style={{
            width: '280px',
            backgroundColor: '#141418',
            borderLeft: '1px solid #26262E',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Inspector Tabs */}
          <div
            style={{
              height: '42px',
              borderBottom: '1px solid #22222C',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-around',
              padding: '0 10px',
            }}
          >
            <span
              onClick={() => setInspectorTab('transform')}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: inspectorTab === 'transform' ? '#E2F952' : '#64748B',
                cursor: 'pointer',
              }}
            >
              Transform
            </span>
            <span
              onClick={() => setInspectorTab('text')}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: inspectorTab === 'text' ? '#E2F952' : '#64748B',
                cursor: 'pointer',
              }}
            >
              Text
            </span>
            <span
              onClick={() => setInspectorTab('effects')}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: inspectorTab === 'effects' ? '#E2F952' : '#64748B',
                cursor: 'pointer',
              }}
            >
              Effects
            </span>
          </div>

          {/* Inspector Controls */}
          {activeLayer ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {/* Position */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ color: '#94A3B8' }}>Position</span>
                <div style={{ display: 'flex', gap: '6px' }}>
                  <input
                    type="number"
                    value={activeLayer.transform.position.x}
                    onChange={(e) =>
                      globalStore.dispatch(
                        new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.position.x', Number(e.target.value))
                      )
                    }
                    style={{
                      width: '60px',
                      backgroundColor: '#1C1C22',
                      border: '1px solid #2E2E38',
                      color: '#FFF',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '11px',
                    }}
                  />
                  <input
                    type="number"
                    value={activeLayer.transform.position.y}
                    onChange={(e) =>
                      globalStore.dispatch(
                        new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.position.y', Number(e.target.value))
                      )
                    }
                    style={{
                      width: '60px',
                      backgroundColor: '#1C1C22',
                      border: '1px solid #2E2E38',
                      color: '#FFF',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '11px',
                    }}
                  />
                </div>
              </div>

              {/* Scale */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ color: '#94A3B8' }}>Scale</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    step="0.1"
                    value={activeLayer.transform.scale.x}
                    onChange={(e) => {
                      const v = Number(e.target.value);
                      globalStore.dispatch(new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.scale.x', v));
                      globalStore.dispatch(new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.scale.y', v));
                    }}
                    style={{
                      width: '60px',
                      backgroundColor: '#1C1C22',
                      border: '1px solid #2E2E38',
                      color: '#FFF',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '11px',
                    }}
                  />
                  <button
                    onClick={() => handleAddKeyframe('scale.x')}
                    style={{ background: 'none', border: 'none', color: '#9D7BFF', cursor: 'pointer', fontSize: '10px' }}
                    title="Add Keyframe"
                  >
                    ◆
                  </button>
                </div>
              </div>

              {/* Rotation */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ color: '#94A3B8' }}>Rotation</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="number"
                    value={activeLayer.transform.rotation}
                    onChange={(e) =>
                      globalStore.dispatch(
                        new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.rotation', Number(e.target.value))
                      )
                    }
                    style={{
                      width: '60px',
                      backgroundColor: '#1C1C22',
                      border: '1px solid #2E2E38',
                      color: '#FFF',
                      borderRadius: '4px',
                      padding: '4px 6px',
                      fontSize: '11px',
                    }}
                  />
                  <button
                    onClick={() => handleAddKeyframe('rotation')}
                    style={{ background: 'none', border: 'none', color: '#9D7BFF', cursor: 'pointer', fontSize: '10px' }}
                    title="Add Keyframe"
                  >
                    ◆
                  </button>
                </div>
              </div>

              {/* Opacity */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                <span style={{ color: '#94A3B8' }}>Opacity</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={activeLayer.opacity}
                    onChange={(e) =>
                      globalStore.dispatch(
                        new SetLayerPropertyCommand(comp.id, activeLayer.id, 'opacity', Number(e.target.value))
                      )
                    }
                    style={{ width: '80px', accentColor: '#E2F952' }}
                  />
                  <button
                    onClick={() => handleAddKeyframe('opacity')}
                    style={{ background: 'none', border: 'none', color: '#9D7BFF', cursor: 'pointer', fontSize: '10px' }}
                    title="Add Keyframe"
                  >
                    ◆
                  </button>
                </div>
              </div>

              <div style={{ height: '1px', backgroundColor: '#26262E', margin: '4px 0' }} />

              {/* Fill styling */}
              <div style={{ fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ color: '#94A3B8' }}>Fill Color</span>
                  <input
                    type="color"
                    value={
                      activeLayer.type === 'shape'
                        ? (activeLayer as ShapeLayer).fill
                        : (activeLayer as MotionTextLayer).fill || '#FFFFFF'
                    }
                    onChange={(e) =>
                      globalStore.dispatch(
                        new SetLayerPropertyCommand(comp.id, activeLayer.id, 'fill', e.target.value)
                      )
                    }
                    style={{
                      width: '24px',
                      height: '24px',
                      borderRadius: '4px',
                      border: 'none',
                      cursor: 'pointer',
                      background: 'none',
                    }}
                  />
                </div>
              </div>

              {/* Text editing if text layer */}
              {activeLayer.type === 'text' && (
                <div style={{ fontSize: '12px' }}>
                  <span style={{ color: '#94A3B8', display: 'block', marginBottom: '6px' }}>Text Content</span>
                  <textarea
                    rows={3}
                    value={(activeLayer as MotionTextLayer).text}
                    onChange={(e) =>
                      globalStore.dispatch(
                        new SetLayerPropertyCommand(comp.id, activeLayer.id, 'text', e.target.value)
                      )
                    }
                    style={{
                      width: '100%',
                      backgroundColor: '#1C1C22',
                      border: '1px solid #2E2E38',
                      color: '#FFF',
                      borderRadius: '6px',
                      padding: '6px 8px',
                      fontSize: '12px',
                      resize: 'none',
                    }}
                  />
                </div>
              )}
            </div>
          ) : (
            <div style={{ padding: '24px', color: '#64748B', fontSize: '13px', textAlign: 'center' }}>
              Select a layer to view properties.
            </div>
          )}
        </div>
      </div>

      {/* Bottom Animation Timeline + Graph / Curve Editor */}
      <div
        style={{
          height: '260px',
          backgroundColor: '#121216',
          borderTop: '1px solid #26262E',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Timeline Header Bar */}
        <div
          style={{
            height: '32px',
            backgroundColor: '#141418',
            borderBottom: '1px solid #202028',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 16px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8' }}>ANIMATION TIMELINE</span>
          </div>

          <button
            onClick={() => setShowCurveEditor(!showCurveEditor)}
            style={{
              background: 'transparent',
              border: 'none',
              color: showCurveEditor ? '#E2F952' : '#64748B',
              fontSize: '11px',
              fontWeight: 500,
              cursor: 'pointer',
            }}
          >
            {showCurveEditor ? 'Hide Graph Editor' : 'Show Graph Editor'}
          </button>
        </div>

        {/* Timeline Tracks & Graph Editor Split */}
        <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
          {/* Keyframe Tracks */}
          <div style={{ width: showCurveEditor ? '50%' : '100%', borderRight: '1px solid #202028', overflowY: 'auto' }}>
            {comp.layers.map((layer) => {
              const isSelected = selectedLayerId === layer.id;
              const kfKeys = Object.keys(layer.keyframes || {});

              return (
                <div
                  key={layer.id}
                  onClick={() => setSelectedLayerId(layer.id)}
                  style={{
                    height: '42px',
                    borderBottom: '1px solid #1C1C24',
                    display: 'flex',
                    alignItems: 'center',
                    backgroundColor: isSelected ? '#1A1A24' : 'transparent',
                    cursor: 'pointer',
                  }}
                >
                  <div style={{ width: '120px', paddingLeft: '14px', fontSize: '11px', color: '#CBD5E1', flexShrink: 0 }}>
                    {layer.name}
                  </div>

                  {/* Timeline bar with Keyframe Diamonds */}
                  <div style={{ flex: 1, height: '100%', position: 'relative', borderLeft: '1px solid #202028' }}>
                    {/* Layer span bar */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `${(layer.start / comp.duration) * 100}%`,
                        width: `${(layer.duration / comp.duration) * 100}%`,
                        top: '12px',
                        height: '18px',
                        backgroundColor: '#2A2A3C',
                        borderRadius: '4px',
                      }}
                    />

                    {/* Keyframe diamonds */}
                    {kfKeys.flatMap((key) => {
                      const kfs = layer.keyframes?.[key] || [];
                      return kfs.map((kf) => (
                        <div
                          key={kf.id}
                          style={{
                            position: 'absolute',
                            left: `${(kf.time / comp.duration) * 100}%`,
                            top: '16px',
                            width: '10px',
                            height: '10px',
                            backgroundColor: '#9D7BFF',
                            transform: 'translate(-5px, -50%) rotate(45deg)',
                            border: '1px solid #FFFFFF',
                            zIndex: 10,
                          }}
                          title={`Keyframe at ${kf.time}s (${key})`}
                        />
                      ));
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Bezier Graph / Curve Editor (as shown in Bottom-Left screen) */}
          {showCurveEditor && (
            <div style={{ flex: 1, backgroundColor: '#0F0F13', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '8px', left: '12px', fontSize: '10px', color: '#64748B' }}>
                BEZIER CURVE EDITOR (Easing: EaseInOut / Elastic)
              </div>

              {/* SVG Smooth Bezier Curve Visualizer matching the screenshot! */}
              <svg width="100%" height="100%" viewBox="0 0 400 160" preserveAspectRatio="none">
                {/* Grid lines */}
                <line x1="0" y1="40" x2="400" y2="40" stroke="#1A1A24" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="80" x2="400" y2="80" stroke="#1A1A24" strokeWidth="1" />
                <line x1="0" y1="120" x2="400" y2="120" stroke="#1A1A24" strokeWidth="1" strokeDasharray="4 4" />

                {/* Smooth Bezier Motion Curve */}
                <path
                  d="M 20 130 C 120 130, 160 30, 240 30 C 300 30, 340 100, 380 90"
                  fill="none"
                  stroke="#9D7BFF"
                  strokeWidth="3"
                />

                {/* Bezier Control Handles */}
                <line x1="20" y1="130" x2="120" y2="130" stroke="#E2F952" strokeWidth="1" />
                <circle cx="120" cy="130" r="4" fill="#E2F952" />

                <line x1="240" y1="30" x2="160" y2="30" stroke="#E2F952" strokeWidth="1" />
                <circle cx="160" cy="30" r="4" fill="#E2F952" />

                {/* Keyframe Nodes */}
                <circle cx="20" cy="130" r="5" fill="#FFFFFF" stroke="#9D7BFF" strokeWidth="2" />
                <circle cx="240" cy="30" r="5" fill="#FFFFFF" stroke="#9D7BFF" strokeWidth="2" />
                <circle cx="380" cy="90" r="5" fill="#FFFFFF" stroke="#9D7BFF" strokeWidth="2" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
