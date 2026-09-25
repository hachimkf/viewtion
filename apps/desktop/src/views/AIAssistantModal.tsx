import React, { useState } from 'react';
import {
  Sparkles,
  ArrowRight,
  Plus,
  Play,
  RotateCcw,
  Check,
  Scissors,
  Layers,
  FileText,
  Palette,
  Sliders,
  X,
  FileVideo,
  Music,
  Type,
  LayoutGrid,
} from 'lucide-react';
import { ActiveWorkspace, useProject, useSelection, globalStore } from '../state/editorState';
import { AIRouter, LocalHeuristicProvider, AIPlan } from '@viewtion/ai-core';
import { ToolDispatcher } from '@viewtion/ai-tools';

interface AIAssistantModalProps {
  onNavigate: (workspace: ActiveWorkspace) => void;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({ onNavigate }) => {
  const project = useProject();
  const selection = useSelection();

  const [prompt, setPrompt] = useState('');
  const [isPlanning, setIsPlanning] = useState(false);
  const [activePlan, setActivePlan] = useState<AIPlan | null>(null);
  const [planApplied, setPlanApplied] = useState(false);

  const provider = new LocalHeuristicProvider();

  const handleGeneratePlan = async (inputPrompt: string) => {
    const text = inputPrompt.trim();
    if (!text) return;

    setIsPlanning(true);
    setPlanApplied(false);

    try {
      const plan = await provider.generatePlan(text, project, selection);
      setActivePlan(plan);
    } catch (e) {
      console.error('Error generating AI plan:', e);
    } finally {
      setIsPlanning(false);
    }
  };

  const handleApplyPlan = () => {
    if (!activePlan) return;
    ToolDispatcher.applyPlan(globalStore, activePlan);
    setPlanApplied(true);
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#0D0D10' }}>
      {/* Left Sidebar (with AI Assistant active) */}
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
          onClick={() => onNavigate('video')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#64748B', cursor: 'pointer' }}
        >
          <FileVideo size={20} />
          <span style={{ fontSize: '10px' }}>Media</span>
        </div>

        <div
          onClick={() => onNavigate('video')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#64748B', cursor: 'pointer' }}
        >
          <Type size={20} />
          <span style={{ fontSize: '10px' }}>Text</span>
        </div>

        <div
          onClick={() => onNavigate('motion')}
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px', color: '#64748B', cursor: 'pointer' }}
        >
          <Layers size={20} />
          <span style={{ fontSize: '10px' }}>Motion</span>
        </div>

        <div style={{ flex: 1 }} />

        {/* AI Assistant active pill in sidebar */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '4px',
            padding: '8px 10px',
            borderRadius: '20px',
            backgroundColor: '#E2F952',
            color: '#0D0D10',
            cursor: 'pointer',
          }}
        >
          <Sparkles size={18} />
          <span style={{ fontSize: '9px', fontWeight: 700 }}>AI Assistant</span>
        </div>
      </div>

      {/* Main AI Workspace Content */}
      <div style={{ flex: 1, height: '100%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
        {/* Header Bar */}
        <div
          style={{
            height: '52px',
            borderBottom: '1px solid #26262E',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700, color: '#FFFFFF' }}>Viewtion</span>
            <span style={{ color: '#64748B' }}>/</span>
            <span style={{ fontSize: '13px', color: '#94A3B8' }}>{project.name}</span>
          </div>

          <button
            onClick={() => onNavigate('video')}
            style={{
              backgroundColor: '#1C1C22',
              border: '1px solid #282834',
              borderRadius: '20px',
              padding: '6px 14px',
              color: '#FFFFFF',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            Return to Editor
          </button>
        </div>

        {/* AI Center Stage */}
        <div style={{ maxWidth: '820px', margin: '0 auto', width: '100%', padding: '40px 24px' }}>
          {/* Hero Sparkle + Title */}
          <div style={{ textAlign: 'center', marginBottom: '28px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', color: '#FFFFFF' }}>
              <Sparkles size={24} color="#E2F952" />
              <h2 style={{ fontSize: '24px', fontWeight: 600 }}>How can I help you edit today?</h2>
            </div>
          </div>

          {/* Prompt Input Box */}
          <div
            style={{
              backgroundColor: '#16161D',
              border: '1px solid #2A2A36',
              borderRadius: '20px',
              padding: '16px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.5)',
              marginBottom: '20px',
            }}
          >
            <textarea
              rows={2}
              placeholder="Describe what you want to create or change..."
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleGeneratePlan(prompt);
                }
              }}
              style={{
                width: '100%',
                background: 'transparent',
                border: 'none',
                outline: 'none',
                color: '#FFFFFF',
                fontSize: '14px',
                fontFamily: 'inherit',
                resize: 'none',
              }}
            />

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  backgroundColor: '#1F1F28',
                  border: '1px solid #2A2A38',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#94A3B8',
                  cursor: 'pointer',
                }}
                title="Attach Media / Asset"
              >
                <Plus size={16} />
              </button>

              <button
                onClick={() => handleGeneratePlan(prompt)}
                disabled={isPlanning || !prompt.trim()}
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  backgroundColor: '#E2F952',
                  border: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0D0D10',
                  cursor: isPlanning ? 'default' : 'pointer',
                  opacity: prompt.trim() ? 1 : 0.6,
                }}
              >
                <ArrowRight size={18} />
              </button>
            </div>
          </div>

          {/* Prompt Suggestions Pills */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px', marginBottom: '36px' }}>
            {[
              'Make a 20 second event reel with fast cuts and captions',
              'Animate this logo with a smooth reveal',
              'Cut the silences and remove pauses',
              'Match the cuts to the music beat',
            ].map((sug, idx) => (
              <div
                key={idx}
                onClick={() => {
                  setPrompt(sug);
                  handleGeneratePlan(sug);
                }}
                style={{
                  backgroundColor: '#141418',
                  border: '1px solid #24242E',
                  borderRadius: '12px',
                  padding: '12px 14px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                  transition: 'border-color 0.15s ease',
                }}
              >
                <span style={{ color: '#E2F952', fontSize: '12px' }}>✦</span>
                <span style={{ fontSize: '12px', color: '#CBD5E1' }}>{sug}</span>
              </div>
            ))}
          </div>

          {/* Plan Preview & Apply Flow if Plan generated */}
          {activePlan && (
            <div
              style={{
                backgroundColor: '#181822',
                border: '1px solid #9D7BFF',
                borderRadius: '14px',
                padding: '20px',
                marginBottom: '36px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      backgroundColor: '#9D7BFF',
                      color: '#0D0D10',
                      padding: '2px 8px',
                      borderRadius: '4px',
                    }}
                  >
                    {activePlan.classification}
                  </span>
                  <span style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>
                    {activePlan.summary}
                  </span>
                </div>

                {!planApplied ? (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      onClick={() => setActivePlan(null)}
                      style={{
                        backgroundColor: '#242430',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 12px',
                        color: '#94A3B8',
                        fontSize: '12px',
                        cursor: 'pointer',
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleApplyPlan}
                      style={{
                        backgroundColor: '#E2F952',
                        border: 'none',
                        borderRadius: '6px',
                        padding: '6px 16px',
                        color: '#0D0D10',
                        fontWeight: 600,
                        fontSize: '12px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                      }}
                    >
                      Apply Changes
                      <ArrowRight size={13} />
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#22C55E', fontSize: '13px', fontWeight: 600 }}>
                    <Check size={16} />
                    Applied (Undoable via Cmd+Z)
                  </div>
                )}
              </div>

              {/* Step list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {activePlan.steps.map((st, i) => (
                  <div
                    key={st.id}
                    style={{
                      backgroundColor: '#121217',
                      padding: '8px 12px',
                      borderRadius: '8px',
                      fontSize: '12px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                    }}
                  >
                    <span style={{ color: '#E2F952', fontWeight: 700 }}>{i + 1}.</span>
                    <span style={{ color: '#E2E8F0' }}>{st.description}</span>
                    <span style={{ color: '#64748B', fontSize: '10px', marginLeft: 'auto' }}>
                      tool: {st.toolName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Tools Grid Section */}
          <div style={{ marginBottom: '36px' }}>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#94A3B8', marginBottom: '14px' }}>Tools</h3>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              <div
                style={{
                  backgroundColor: '#141418',
                  border: '1px solid #26262E',
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: '#9D7BFF', marginBottom: '8px' }}>
                  <Music size={18} />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>Analyze Media</div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  Find highlights & beats
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#141418',
                  border: '1px solid #26262E',
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: '#38BDF8', marginBottom: '8px' }}>
                  <FileText size={18} />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>Create Captions</div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  Transcribe and style
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#141418',
                  border: '1px solid #26262E',
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: '#F59E0B', marginBottom: '8px' }}>
                  <Palette size={18} />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>Brand Style</div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  Apply brand colors & fonts
                </div>
              </div>

              <div
                style={{
                  backgroundColor: '#141418',
                  border: '1px solid #26262E',
                  borderRadius: '12px',
                  padding: '14px',
                  cursor: 'pointer',
                }}
              >
                <div style={{ color: '#22C55E', marginBottom: '8px' }}>
                  <LayoutGrid size={18} />
                </div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>Template</div>
                <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>
                  Use professional template
                </div>
              </div>
            </div>
          </div>

          {/* Recent AI Edits Section */}
          <div>
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#94A3B8', marginBottom: '14px' }}>
              Recent AI Edits
            </h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div
                style={{
                  backgroundColor: '#141418',
                  border: '1px solid #24242E',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>Event Reel — Auto Edit</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>12 changes • 2 min ago</div>
                </div>
                <button
                  onClick={() => onNavigate('video')}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                >
                  <Play size={16} />
                </button>
              </div>

              <div
                style={{
                  backgroundColor: '#141418',
                  border: '1px solid #24242E',
                  borderRadius: '10px',
                  padding: '12px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF' }}>Logo Animation</div>
                  <div style={{ fontSize: '11px', color: '#64748B', marginTop: '2px' }}>8 changes • 1 hour ago</div>
                </div>
                <button
                  onClick={() => onNavigate('motion')}
                  style={{ background: 'none', border: 'none', color: '#94A3B8', cursor: 'pointer' }}
                >
                  <Play size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
