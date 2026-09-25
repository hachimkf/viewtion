import { ProjectStore } from '@viewtion/editor-core';

export interface MCPToolDefinition {
  name: string;
  description: string;
  parameters: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

export const VIEWTION_MCP_TOOLS: MCPToolDefinition[] = [
  {
    name: 'viewtion_get_project',
    description: 'Retrieves current Viewtion project settings, assets, and metadata.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'viewtion_get_timeline',
    description: 'Gets all tracks, clips, and playhead position on the Video timeline.',
    parameters: { type: 'object', properties: {} },
  },
  {
    name: 'viewtion_trim_clip',
    description: 'Trims a clip to a new start and duration on the timeline.',
    parameters: {
      type: 'object',
      properties: {
        clipId: { type: 'string', description: 'ID of clip to trim' },
        newStart: { type: 'number', description: 'New timeline start in seconds' },
        newDuration: { type: 'number', description: 'New duration in seconds' },
      },
      required: ['clipId', 'newStart', 'newDuration'],
    },
  },
  {
    name: 'viewtion_create_motion_comp',
    description: 'Creates a new motion composition for animation / kinetic typography.',
    parameters: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Name of the motion composition' },
        duration: { type: 'number', description: 'Duration in seconds' },
      },
      required: ['name'],
    },
  },
];

export class ViewtionMCPServer {
  constructor(private store: ProjectStore) {}

  listTools(): MCPToolDefinition[] {
    return VIEWTION_MCP_TOOLS;
  }

  async executeTool(name: string, args: any): Promise<any> {
    switch (name) {
      case 'viewtion_get_project':
        return this.store.getProject();
      case 'viewtion_get_timeline':
        return this.store.getProject().timeline;
      default:
        throw new Error(`Tool ${name} not found`);
    }
  }
}
