import React, { useRef } from 'react';
import {
  Home,
  FolderKanban,
  LayoutGrid,
  Palette,
  Sparkles,
  Settings,
  Search,
  Plus,
  FileVideo,
  FolderOpen,
  HardDrive,
} from 'lucide-react';
import { ActiveWorkspace, globalStore } from '../state/editorState';
import { createEmptyProject } from '@viewtion/project-schema';

interface HomeViewProps {
  onNavigate: (workspace: ActiveWorkspace) => void;
}

export const HomeView: React.FC<HomeViewProps> = ({ onNavigate }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleNewProject = () => {
    const proj = createEmptyProject("Brink's Event Reel");
    globalStore.setProject(proj);
    onNavigate('video');
  };

  const handleOpenProjectFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (event) => {
        const content = event.target?.result as string;
        if (content) {
          const success = globalStore.fromJSON(content);
          if (success) {
            onNavigate('video');
          } else {
            alert('Failed to parse .viewtion project file.');
          }
        }
      };
      reader.readAsText(file);
    }
  };

  return (
    <div style={{ display: 'flex', width: '100%', height: '100%', backgroundColor: '#0D0D10' }}>
      {/* Hidden file input for opening projects */}
      <input
        type="file"
        ref={fileInputRef}
        accept=".viewtion,.json"
        style={{ display: 'none' }}
        onChange={handleOpenProjectFile}
      />

      {/* Left Sidebar */}
      <div
        style={{
          width: '240px',
          height: '100%',
          backgroundColor: '#141418',
          borderRight: '1px solid #26262E',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '24px 16px',
        }}
      >
        <div>
          {/* Logo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '32px', paddingLeft: '8px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#1C1C22',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                border: '1px solid #2E2E38',
              }}
            >
              <div style={{ width: '10px', height: '10px', backgroundColor: '#E2F952', borderRadius: '2px' }} />
            </div>
            <span style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '-0.5px', color: '#FFFFFF' }}>Viewtion</span>
          </div>

          {/* Navigation Links */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <button
              onClick={() => onNavigate('home')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: '#E2F952',
                color: '#0D0D10',
                fontWeight: 600,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Home size={18} />
              Home
            </button>

            <button
              onClick={() => onNavigate('video')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: '#94A3B8',
                fontWeight: 500,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <FolderKanban size={18} />
              Projects
            </button>

            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: '#94A3B8',
                fontWeight: 500,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <LayoutGrid size={18} />
              Templates
            </button>

            <button
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: '#94A3B8',
                fontWeight: 500,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Palette size={18} />
              Brand Kits
            </button>

            <button
              onClick={() => onNavigate('ai')}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '10px 14px',
                borderRadius: '8px',
                backgroundColor: 'transparent',
                color: '#94A3B8',
                fontWeight: 500,
                fontSize: '14px',
                border: 'none',
                cursor: 'pointer',
              }}
            >
              <Sparkles size={18} color="#E2F952" />
              AI Assistant
            </button>
          </div>
        </div>

        {/* Bottom Sidebar info */}
        <div>
          <div style={{ padding: '0 8px', marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#64748B', marginBottom: '6px' }}>
              <span>Storage</span>
              <span>48.2 GB / 500 GB</span>
            </div>
            <div style={{ width: '100%', height: '4px', backgroundColor: '#26262E', borderRadius: '2px', overflow: 'hidden' }}>
              <div style={{ width: '12%', height: '100%', backgroundColor: '#E2F952' }} />
            </div>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '10px 8px',
              borderTop: '1px solid #26262E',
              color: '#64748B',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
              <HardDrive size={16} />
              <span>Local Cache</span>
            </div>
            <Settings size={16} style={{ cursor: 'pointer' }} />
          </div>
        </div>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1, height: '100%', overflowY: 'auto', padding: '36px 48px' }}>
        {/* Top Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '36px' }}>
          <div>
            <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.8px' }}>
              Good afternoon,
            </h1>
            <h1 style={{ fontSize: '32px', fontWeight: 700, color: '#E2F952', letterSpacing: '-0.8px' }}>
              Let's create.
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {/* Search */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: '#141418',
                border: '1px solid #26262E',
                borderRadius: '24px',
                padding: '8px 16px',
                width: '280px',
              }}
            >
              <Search size={16} color="#64748B" />
              <input
                type="text"
                placeholder="Search projects..."
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  width: '100%',
                }}
              />
            </div>

            {/* Profile Avatar */}
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#26262E',
                backgroundImage: 'url(https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&q=80)',
                backgroundSize: 'cover',
                border: '1px solid #3A3A48',
              }}
            />
          </div>
        </div>

        {/* 4 Action Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px', marginBottom: '44px' }}>
          {/* New Project (Solid Lime) */}
          <div
            onClick={handleNewProject}
            style={{
              backgroundColor: '#E2F952',
              borderRadius: '16px',
              padding: '24px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '140px',
              transition: 'transform 0.15s ease',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                backgroundColor: '#0D0D10',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#E2F952',
              }}
            >
              <Plus size={20} />
            </div>
            <div>
              <div style={{ fontSize: '16px', fontWeight: 700, color: '#0D0D10' }}>New Project</div>
              <div style={{ fontSize: '12px', color: '#3A3A40', marginTop: '2px' }}>Video or Motion</div>
            </div>
          </div>

          {/* Import Media */}
          <div
            onClick={() => onNavigate('video')}
            style={{
              backgroundColor: '#141418',
              border: '1px solid #26262E',
              borderRadius: '16px',
              padding: '24px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '140px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#1C1C22',
                border: '1px solid #2E2E38',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <FileVideo size={18} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>Import Media</div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>Videos, images, audio</div>
            </div>
          </div>

          {/* Start from Template */}
          <div
            onClick={() => onNavigate('motion')}
            style={{
              backgroundColor: '#141418',
              border: '1px solid #26262E',
              borderRadius: '16px',
              padding: '24px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '140px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#1C1C22',
                border: '1px solid #2E2E38',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <LayoutGrid size={18} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>Start from Template</div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>Titles, intros, reels</div>
            </div>
          </div>

          {/* Open Project */}
          <div
            onClick={() => fileInputRef.current?.click()}
            style={{
              backgroundColor: '#141418',
              border: '1px solid #26262E',
              borderRadius: '16px',
              padding: '24px',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              height: '140px',
            }}
          >
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                backgroundColor: '#1C1C22',
                border: '1px solid #2E2E38',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#FFFFFF',
              }}
            >
              <FolderOpen size={18} />
            </div>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#FFFFFF' }}>Open Project</div>
              <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>Browse your files</div>
            </div>
          </div>
        </div>

        {/* Recent Projects Section */}
        <div>
          <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#FFFFFF', marginBottom: '18px' }}>
            Recent Projects
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '16px' }}>
            {/* Project 1 */}
            <div
              onClick={() => onNavigate('video')}
              style={{
                backgroundColor: '#141418',
                border: '1px solid #26262E',
                borderRadius: '14px',
                overflow: 'hidden',
                cursor: 'pointer',
                transition: 'border-color 0.15s ease',
              }}
            >
              <div
                style={{
                  height: '150px',
                  backgroundColor: '#1C1C22',
                  backgroundImage: 'url(https://images.unsplash.com/photo-1540575467063-178a50c2df87?w=400&q=80)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div style={{ padding: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>Brink's Event Reel</div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>00:24 • 1080 x 1350</div>
              </div>
            </div>

            {/* Project 2 */}
            <div
              onClick={() => onNavigate('video')}
              style={{
                backgroundColor: '#141418',
                border: '1px solid #26262E',
                borderRadius: '14px',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  height: '150px',
                  backgroundColor: '#1C1C22',
                  backgroundImage: 'url(https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=400&q=80)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div style={{ padding: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>Raconte Coffee</div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>00:32 • 1920 x 1080</div>
              </div>
            </div>

            {/* Project 3 */}
            <div
              onClick={() => onNavigate('video')}
              style={{
                backgroundColor: '#141418',
                border: '1px solid #26262E',
                borderRadius: '14px',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  height: '150px',
                  backgroundColor: '#1C1C22',
                  backgroundImage: 'url(https://images.unsplash.com/photo-1506157786151-b8491531f063?w=400&q=80)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div style={{ padding: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>Eleven Twelve</div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>00:15 • 1080 x 1920</div>
              </div>
            </div>

            {/* Project 4 */}
            <div
              onClick={() => onNavigate('video')}
              style={{
                backgroundColor: '#141418',
                border: '1px solid #26262E',
                borderRadius: '14px',
                overflow: 'hidden',
                cursor: 'pointer',
              }}
            >
              <div
                style={{
                  height: '150px',
                  backgroundColor: '#1C1C22',
                  backgroundImage: 'url(https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?w=400&q=80)',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <div style={{ padding: '14px' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#FFFFFF' }}>Rouge le Jaune</div>
                <div style={{ fontSize: '12px', color: '#64748B', marginTop: '4px' }}>00:28 • 1080 x 1350</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
