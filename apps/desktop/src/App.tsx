import React, { useState, useEffect } from 'react';
import { HomeView } from './views/HomeView';
import { VideoWorkspace } from './views/VideoWorkspace';
import { MotionWorkspace } from './views/MotionWorkspace';
import { AIAssistantModal } from './views/AIAssistantModal';
import { ActiveWorkspace, globalStore } from './state/editorState';

export const App: React.FC = () => {
  const [workspace, setWorkspace] = useState<ActiveWorkspace>('home');
  const [activeCompId, setActiveCompId] = useState<string>('comp_logo_reveal');

  // Handle global keyboard shortcuts (Undo / Redo / Play)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd+Z or Ctrl+Z for undo
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') {
        if (e.shiftKey) {
          globalStore.redo();
        } else {
          globalStore.undo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const handleOpenMotionComp = (compId: string) => {
    setActiveCompId(compId);
    setWorkspace('motion');
  };

  return (
    <div style={{ width: '100vw', height: '100vh', overflow: 'hidden', display: 'flex' }}>
      {workspace === 'home' && <HomeView onNavigate={setWorkspace} />}
      {workspace === 'video' && (
        <VideoWorkspace
          onNavigate={setWorkspace}
          onOpenMotionComp={handleOpenMotionComp}
        />
      )}
      {workspace === 'motion' && (
        <MotionWorkspace
          onNavigate={setWorkspace}
          activeCompId={activeCompId}
        />
      )}
      {workspace === 'ai' && <AIAssistantModal onNavigate={setWorkspace} />}
    </div>
  );
};
