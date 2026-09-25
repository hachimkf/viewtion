import React, { useRef, useEffect, useState, useCallback } from 'react';
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
  Trash2,
  Copy,
  Timer,
  Wand2,
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
  RemoveKeyframeCommand,
} from '@viewtion/editor-core';
import {
  renderMotionCompositionToCanvas,
  evaluateLayerAtTime,
  evaluateEasing,
  solveCubicBezier,
} from '@viewtion/motion-engine';
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
  const [inspectorTab, setInspectorTab] = useState<'transform' | 'text' | 'presets'>('transform');
  const [showCurveEditor, setShowCurveEditor] = useState(true);

  // Active keyframe property for graph editor
  const [activeGraphProp, setActiveGraphProp] = useState<string>('scale.x');

  // Interactive Gizmo dragging state
  const [gizmoDrag, setGizmoDrag] = useState<{
    mode: 'move' | 'scale' | 'rotate';
    startX: number;
    startY: number;
    initialPos: { x: number; y: number };
    initialScale: { x: number; y: number };
    initialRot: number;
  } | null>(null);

  // Selected keyframe for dragging/deleting
  const [selectedKf, setSelectedKf] = useState<{ layerId: string; prop: string; kfId: string } | null>(null);

  // Bezier curve handle state
  const [bezierHandles, setBezierHandles] = useState<{ p1x: number; p1y: number; p2x: number; p2y: number }>({
    p1x: 0.25,
    p1y: 0.1,
    p2x: 0.25,
    p2y: 1.0,
  });

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
  const evaluatedActive = activeLayer ? evaluateLayerAtTime(activeLayer, localTime) : null;

  // Gizmo dragging handlers
  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!gizmoDrag || !activeLayer) return;

      const dx = e.clientX - gizmoDrag.startX;
      const dy = e.clientY - gizmoDrag.startY;

      // Scale factor from preview viewport (320px width represents 1080px canvas)
      const scaleFactor = comp.width / 320;

      if (gizmoDrag.mode === 'move') {
        const newX = Math.round(gizmoDrag.initialPos.x + dx * scaleFactor);
        const newY = Math.round(gizmoDrag.initialPos.y + dy * scaleFactor);
        globalStore.dispatch(new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.position.x', newX));
        globalStore.dispatch(new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.position.y', newY));
      } else if (gizmoDrag.mode === 'scale') {
        const factor = 1 + (dx + dy) / 200;
        const newScaleX = Math.max(0.1, Number((gizmoDrag.initialScale.x * factor).toFixed(2)));
        const newScaleY = Math.max(0.1, Number((gizmoDrag.initialScale.y * factor).toFixed(2)));
        globalStore.dispatch(new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.scale.x', newScaleX));
        globalStore.dispatch(new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.scale.y', newScaleY));
      } else if (gizmoDrag.mode === 'rotate') {
        const newRot = Math.round(gizmoDrag.initialRot + dx * 0.5);
        globalStore.dispatch(new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.rotation', newRot));
      }
    };

    const handlePointerUp = () => {
      setGizmoDrag(null);
    };

    if (gizmoDrag) {
      window.addEventListener('pointermove', handlePointerMove);
      window.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [gizmoDrag, activeLayer, comp]);

  // Keyboard shortcut listener for Motion workspace
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement).tagName)) return;

      if (e.key === ' ' || e.code === 'Space') {
        e.preventDefault();
        setIsPlaying(!isPlaying);
      } else if (e.key === 'Backspace' || e.key === 'Delete') {
        if (selectedKf) {
          e.preventDefault();
          globalStore.dispatch(
            new RemoveKeyframeCommand(comp.id, selectedKf.layerId, selectedKf.prop, selectedKf.kfId)
          );
          setSelectedKf(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isPlaying, selectedKf, comp.id]);

  const handleAddTextLayer = () => {
    const newText: MotionTextLayer = {
      id: `layer_text_${Date.now()}`,
      name: `Text ${comp.layers.length + 1}`,
      type: 'text',
      text: 'Kinetic Motion',
      fontSize: 54,
      fontFamily: 'Inter, sans-serif',
      fill: '#FFFFFF',
      start: 0,
      duration: comp.duration,
      visible: true,
      locked: false,
      keyframes: {},
      transform: {
        position: { x: comp.width / 2, y: comp.height / 2 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
      },
      opacity: 1,
      blending: 'normal',
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
      keyframes: {},
      transform: {
        position: { x: comp.width / 2, y: comp.height / 2 },
        scale: { x: 1, y: 1 },
        rotation: 0,
        anchor: { x: 0.5, y: 0.5 },
      },
      opacity: 1,
      blending: 'normal',
    };
    globalStore.dispatch(new AddLayerCommand(comp.id, newShape));
    setSelectedLayerId(newShape.id);
  };

  const handleToggleKeyframe = (prop: string) => {
    if (!activeLayer) return;
    const evaluated = evaluateLayerAtTime(activeLayer, localTime);
    let val: any = 0;
    if (prop === 'opacity') val = evaluated.opacity;
    if (prop === 'rotation') val = evaluated.rotation;
    if (prop === 'scale.x') val = evaluated.scale.x;
    if (prop === 'position.y') val = evaluated.position.y;

    const kf: Keyframe = {
      id: `kf_${Date.now()}`,
      time: localTime,
      value: val,
      easing: 'easeInOut',
    };
    globalStore.dispatch(new AddKeyframeCommand(comp.id, activeLayer.id, prop, kf));
  };

  // Preset Applicator
  const handleApplyPreset = (presetName: string) => {
    if (!activeLayer) return;

    if (presetName === 'pop') {
      globalStore.dispatch(
        new AddKeyframeCommand(comp.id, activeLayer.id, 'scale.x', {
          id: `kf_${Date.now()}_1`,
          time: 0,
          value: 0.4,
          easing: 'elastic',
        })
      );
      globalStore.dispatch(
        new AddKeyframeCommand(comp.id, activeLayer.id, 'scale.x', {
          id: `kf_${Date.now()}_2`,
          time: 1.2,
          value: 1.0,
          easing: 'elastic',
        })
      );
    } else if (presetName === 'fadeUp') {
      globalStore.dispatch(
        new AddKeyframeCommand(comp.id, activeLayer.id, 'opacity', {
          id: `kf_${Date.now()}_1`,
          time: 0,
          value: 0,
          easing: 'easeOut',
        })
      );
      globalStore.dispatch(
        new AddKeyframeCommand(comp.id, activeLayer.id, 'opacity', {
          id: `kf_${Date.now()}_2`,
          time: 1.0,
          value: 1,
          easing: 'easeOut',
        })
      );
      globalStore.dispatch(
        new AddKeyframeCommand(comp.id, activeLayer.id, 'position.y', {
          id: `kf_${Date.now()}_3`,
          time: 0,
          value: activeLayer.transform.position.y + 80,
          easing: 'easeOut',
        })
      );
      globalStore.dispatch(
        new AddKeyframeCommand(comp.id, activeLayer.id, 'position.y', {
          id: `kf_${Date.now()}_4`,
          time: 1.0,
          value: activeLayer.transform.position.y,
          easing: 'easeOut',
        })
      );
    }
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

        {/* Center: Canvas Viewport with Interactive Gizmo */}
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
          {/* Motion Canvas Container */}
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

            {/* Interactive Bounding Box Gizmo for Active Layer */}
            {activeLayer && evaluatedActive && (
              <div
                onPointerDown={(e) => {
                  e.stopPropagation();
                  setGizmoDrag({
                    mode: 'move',
                    startX: e.clientX,
                    startY: e.clientY,
                    initialPos: { ...activeLayer.transform.position },
                    initialScale: { ...activeLayer.transform.scale },
                    initialRot: activeLayer.transform.rotation,
                  });
                }}
                style={{
                  position: 'absolute',
                  left: `${(evaluatedActive.position.x / comp.width) * 100}%`,
                  top: `${(evaluatedActive.position.y / comp.height) * 100}%`,
                  width: '120px',
                  height: '80px',
                  transform: `translate(-50%, -50%) rotate(${evaluatedActive.rotation}deg) scale(${evaluatedActive.scale.x}, ${evaluatedActive.scale.y})`,
                  border: '1.5px solid #E2F952',
                  boxShadow: '0 0 10px rgba(226, 249, 82, 0.3)',
                  cursor: 'grab',
                }}
                title="Drag to reposition layer"
              >
                {/* 4 Corner Resize Handles */}
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setGizmoDrag({
                      mode: 'scale',
                      startX: e.clientX,
                      startY: e.clientY,
                      initialPos: { ...activeLayer.transform.position },
                      initialScale: { ...activeLayer.transform.scale },
                      initialRot: activeLayer.transform.rotation,
                    });
                  }}
                  style={{ position: 'absolute', top: '-5px', left: '-5px', width: '10px', height: '10px', backgroundColor: '#E2F952', borderRadius: '2px', cursor: 'nwse-resize' }}
                />
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setGizmoDrag({
                      mode: 'scale',
                      startX: e.clientX,
                      startY: e.clientY,
                      initialPos: { ...activeLayer.transform.position },
                      initialScale: { ...activeLayer.transform.scale },
                      initialRot: activeLayer.transform.rotation,
                    });
                  }}
                  style={{ position: 'absolute', top: '-5px', right: '-5px', width: '10px', height: '10px', backgroundColor: '#E2F952', borderRadius: '2px', cursor: 'nesw-resize' }}
                />
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setGizmoDrag({
                      mode: 'scale',
                      startX: e.clientX,
                      startY: e.clientY,
                      initialPos: { ...activeLayer.transform.position },
                      initialScale: { ...activeLayer.transform.scale },
                      initialRot: activeLayer.transform.rotation,
                    });
                  }}
                  style={{ position: 'absolute', bottom: '-5px', left: '-5px', width: '10px', height: '10px', backgroundColor: '#E2F952', borderRadius: '2px', cursor: 'nesw-resize' }}
                />
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setGizmoDrag({
                      mode: 'scale',
                      startX: e.clientX,
                      startY: e.clientY,
                      initialPos: { ...activeLayer.transform.position },
                      initialScale: { ...activeLayer.transform.scale },
                      initialRot: activeLayer.transform.rotation,
                    });
                  }}
                  style={{ position: 'absolute', bottom: '-5px', right: '-5px', width: '10px', height: '10px', backgroundColor: '#E2F952', borderRadius: '2px', cursor: 'nwse-resize' }}
                />

                {/* Top Rotation Handle */}
                <div
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    setGizmoDrag({
                      mode: 'rotate',
                      startX: e.clientX,
                      startY: e.clientY,
                      initialPos: { ...activeLayer.transform.position },
                      initialScale: { ...activeLayer.transform.scale },
                      initialRot: activeLayer.transform.rotation,
                    });
                  }}
                  style={{
                    position: 'absolute',
                    top: '-20px',
                    left: '50%',
                    transform: 'translateX(-50%)',
                    width: '8px',
                    height: '8px',
                    backgroundColor: '#9D7BFF',
                    borderRadius: '50%',
                    cursor: 'crosshair',
                  }}
                  title="Drag horizontally to rotate"
                />
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
              onClick={() => setInspectorTab('presets')}
              style={{
                fontSize: '12px',
                fontWeight: 600,
                color: inspectorTab === 'presets' ? '#E2F952' : '#64748B',
                cursor: 'pointer',
              }}
            >
              Presets
            </span>
          </div>

          {/* Inspector Controls */}
          {activeLayer ? (
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {inspectorTab === 'transform' && (
                <>
                  {/* Position */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#94A3B8' }}>Position</span>
                      <button
                        onClick={() => handleToggleKeyframe('position.y')}
                        style={{ background: 'none', border: 'none', color: '#9D7BFF', cursor: 'pointer' }}
                        title="Keyframe Position"
                      >
                        <Timer size={12} />
                      </button>
                    </div>
                    <div style={{ display: 'flex', gap: '6px' }}>
                      <input
                        type="number"
                        value={activeLayer.transform.position.x}
                        onChange={(e) =>
                          globalStore.dispatch(
                            new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.position.x', Number(e.target.value))
                          )
                        }
                        style={{ width: '56px', backgroundColor: '#1C1C22', border: '1px solid #2E2E38', color: '#FFF', borderRadius: '4px', padding: '3px 6px', fontSize: '11px' }}
                      />
                      <input
                        type="number"
                        value={activeLayer.transform.position.y}
                        onChange={(e) =>
                          globalStore.dispatch(
                            new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.position.y', Number(e.target.value))
                          )
                        }
                        style={{ width: '56px', backgroundColor: '#1C1C22', border: '1px solid #2E2E38', color: '#FFF', borderRadius: '4px', padding: '3px 6px', fontSize: '11px' }}
                      />
                    </div>
                  </div>

                  {/* Scale */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#94A3B8' }}>Scale</span>
                      <button
                        onClick={() => handleToggleKeyframe('scale.x')}
                        style={{ background: 'none', border: 'none', color: '#9D7BFF', cursor: 'pointer' }}
                        title="Keyframe Scale"
                      >
                        <Timer size={12} />
                      </button>
                    </div>
                    <input
                      type="range"
                      min="0.1"
                      max="3"
                      step="0.05"
                      value={activeLayer.transform.scale.x}
                      onChange={(e) => {
                        const s = Number(e.target.value);
                        globalStore.dispatch(new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.scale.x', s));
                        globalStore.dispatch(new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.scale.y', s));
                      }}
                      style={{ width: '100px', accentColor: '#E2F952' }}
                    />
                  </div>

                  {/* Rotation */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#94A3B8' }}>Rotation</span>
                      <button
                        onClick={() => handleToggleKeyframe('rotation')}
                        style={{ background: 'none', border: 'none', color: '#9D7BFF', cursor: 'pointer' }}
                        title="Keyframe Rotation"
                      >
                        <Timer size={12} />
                      </button>
                    </div>
                    <input
                      type="number"
                      value={activeLayer.transform.rotation}
                      onChange={(e) =>
                        globalStore.dispatch(
                          new SetLayerPropertyCommand(comp.id, activeLayer.id, 'transform.rotation', Number(e.target.value))
                        )
                      }
                      style={{ width: '56px', backgroundColor: '#1C1C22', border: '1px solid #2E2E38', color: '#FFF', borderRadius: '4px', padding: '3px 6px', fontSize: '11px' }}
                    />
                  </div>

                  {/* Opacity */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={{ color: '#94A3B8' }}>Opacity</span>
                      <button
                        onClick={() => handleToggleKeyframe('opacity')}
                        style={{ background: 'none', border: 'none', color: '#9D7BFF', cursor: 'pointer' }}
                        title="Keyframe Opacity"
                      >
                        <Timer size={12} />
                      </button>
                    </div>
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
                      style={{ width: '100px', accentColor: '#E2F952' }}
                    />
                  </div>

                  <div style={{ height: '1px', backgroundColor: '#26262E', margin: '4px 0' }} />

                  {/* Fill Color */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                    <span style={{ color: '#94A3B8' }}>Fill Color</span>
                    <input
                      type="color"
                      value={
                        activeLayer.type === 'shape'
                          ? (activeLayer as ShapeLayer).fill
                          : (activeLayer as MotionTextLayer).fill || '#FFFFFF'
                      }
                      onChange={(e) =>
                        globalStore.dispatch(new SetLayerPropertyCommand(comp.id, activeLayer.id, 'fill', e.target.value))
                      }
                      style={{ width: '26px', height: '26px', borderRadius: '4px', border: 'none', cursor: 'pointer', background: 'none' }}
                    />
                  </div>
                </>
              )}

              {inspectorTab === 'text' && activeLayer.type === 'text' && (
                <div style={{ fontSize: '12px' }}>
                  <span style={{ color: '#94A3B8', display: 'block', marginBottom: '6px' }}>Text Content</span>
                  <textarea
                    rows={4}
                    value={(activeLayer as MotionTextLayer).text}
                    onChange={(e) =>
                      globalStore.dispatch(new SetLayerPropertyCommand(comp.id, activeLayer.id, 'text', e.target.value))
                    }
                    style={{
                      width: '100%',
                      backgroundColor: '#1C1C22',
                      border: '1px solid #2E2E38',
                      color: '#FFF',
                      borderRadius: '6px',
                      padding: '8px',
                      fontSize: '12px',
                      resize: 'none',
                    }}
                  />
                </div>
              )}

              {inspectorTab === 'presets' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <span style={{ fontSize: '11px', color: '#94A3B8', fontWeight: 600 }}>ANIMATION PRESETS</span>
                  <button
                    onClick={() => handleApplyPreset('pop')}
                    style={{
                      backgroundColor: '#1C1C22',
                      border: '1px solid #2E2E38',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    ✨ Pop & Elastic Scale
                  </button>
                  <button
                    onClick={() => handleApplyPreset('fadeUp')}
                    style={{
                      backgroundColor: '#1C1C22',
                      border: '1px solid #2E2E38',
                      borderRadius: '6px',
                      padding: '8px 12px',
                      color: '#FFFFFF',
                      fontSize: '12px',
                      textAlign: 'left',
                      cursor: 'pointer',
                    }}
                  >
                    🚀 Smooth Fade Up Reveal
                  </button>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: '#94A3B8' }}>ANIMATION TIMELINE</span>
            {selectedKf && (
              <span style={{ fontSize: '11px', color: '#E2F952' }}>
                Keyframe selected • Press Backspace to delete
              </span>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <select
              value={activeGraphProp}
              onChange={(e) => setActiveGraphProp(e.target.value)}
              style={{
                backgroundColor: '#1C1C22',
                border: '1px solid #2E2E38',
                color: '#CBD5E1',
                borderRadius: '4px',
                padding: '2px 6px',
                fontSize: '11px',
              }}
            >
              <option value="scale.x">Curve: Scale</option>
              <option value="opacity">Curve: Opacity</option>
              <option value="rotation">Curve: Rotation</option>
              <option value="position.y">Curve: Position Y</option>
            </select>

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
              {showCurveEditor ? 'Hide Curve Editor' : 'Show Curve Editor'}
            </button>
          </div>
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
                  <div
                    onClick={(e) => {
                      const rect = e.currentTarget.getBoundingClientRect();
                      const clickX = e.clientX - rect.left;
                      const time = Math.max(0, Math.min(comp.duration, (clickX / rect.width) * comp.duration));
                      setLocalTime(time);
                    }}
                    style={{ flex: 1, height: '100%', position: 'relative', borderLeft: '1px solid #202028' }}
                  >
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
                      return kfs.map((kf) => {
                        const isKfSelected = selectedKf?.kfId === kf.id;
                        return (
                          <div
                            key={kf.id}
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedKf({ layerId: layer.id, prop: key, kfId: kf.id });
                              setLocalTime(kf.time);
                            }}
                            style={{
                              position: 'absolute',
                              left: `${(kf.time / comp.duration) * 100}%`,
                              top: '16px',
                              width: '10px',
                              height: '10px',
                              backgroundColor: isKfSelected ? '#E2F952' : '#9D7BFF',
                              transform: 'translate(-5px, -50%) rotate(45deg)',
                              border: `1px solid ${isKfSelected ? '#0D0D10' : '#FFFFFF'}`,
                              zIndex: 15,
                              cursor: 'pointer',
                            }}
                            title={`Keyframe at ${kf.time.toFixed(2)}s (${key})`}
                          />
                        );
                      });
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Interactive Bezier Graph / Curve Editor */}
          {showCurveEditor && (
            <div style={{ flex: 1, backgroundColor: '#0F0F13', position: 'relative', overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: '8px', left: '12px', fontSize: '10px', color: '#64748B' }}>
                BEZIER CURVE EDITOR ({activeGraphProp.toUpperCase()}) • Drag handles to adjust curve
              </div>

              {/* Interactive Bezier SVG Canvas */}
              <svg
                width="100%"
                height="100%"
                viewBox="0 0 400 160"
                preserveAspectRatio="none"
                style={{ cursor: 'crosshair' }}
              >
                {/* Horizontal reference lines */}
                <line x1="0" y1="40" x2="400" y2="40" stroke="#1A1A24" strokeWidth="1" strokeDasharray="4 4" />
                <line x1="0" y1="80" x2="400" y2="80" stroke="#1A1A24" strokeWidth="1" />
                <line x1="0" y1="120" x2="400" y2="120" stroke="#1A1A24" strokeWidth="1" strokeDasharray="4 4" />

                {/* Interactive Curve Path */}
                <path
                  d={`M 30 130 C ${30 + bezierHandles.p1x * 200} ${130 - bezierHandles.p1y * 100}, ${370 - (1 - bezierHandles.p2x) * 200} ${30 + (1 - bezierHandles.p2y) * 100}, 370 30`}
                  fill="none"
                  stroke="#9D7BFF"
                  strokeWidth="3"
                />

                {/* Handle lines */}
                <line
                  x1="30"
                  y1="130"
                  x2={30 + bezierHandles.p1x * 200}
                  y2={130 - bezierHandles.p1y * 100}
                  stroke="#E2F952"
                  strokeWidth="1.5"
                />
                <circle
                  cx={30 + bezierHandles.p1x * 200}
                  cy={130 - bezierHandles.p1y * 100}
                  r="5"
                  fill="#E2F952"
                  style={{ cursor: 'pointer' }}
                />

                <line
                  x1="370"
                  y1="30"
                  x2={370 - (1 - bezierHandles.p2x) * 200}
                  y2={30 + (1 - bezierHandles.p2y) * 100}
                  stroke="#E2F952"
                  strokeWidth="1.5"
                />
                <circle
                  cx={370 - (1 - bezierHandles.p2x) * 200}
                  cy={30 + (1 - bezierHandles.p2y) * 100}
                  r="5"
                  fill="#E2F952"
                  style={{ cursor: 'pointer' }}
                />

                {/* Start & End Nodes */}
                <circle cx="30" cy="130" r="5" fill="#FFFFFF" stroke="#9D7BFF" strokeWidth="2" />
                <circle cx="370" cy="30" r="5" fill="#FFFFFF" stroke="#9D7BFF" strokeWidth="2" />
              </svg>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
