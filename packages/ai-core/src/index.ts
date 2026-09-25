import { Project } from '@viewtion/project-schema';
import { SelectionState } from '@viewtion/editor-core';

export type TaskClassification = 'VIDEO' | 'MOTION' | 'HYBRID' | 'PROJECT' | 'QUESTION';

export interface AIPlanStep {
  id: string;
  category: TaskClassification;
  description: string;
  toolName: string;
  params: Record<string, any>;
}

export interface AIPlan {
  id: string;
  userPrompt: string;
  classification: TaskClassification;
  summary: string;
  steps: AIPlanStep[];
}

export interface AIProviderConfig {
  provider: 'openai' | 'anthropic' | 'gemini' | 'local_mock';
  apiKey?: string;
  model?: string;
}

export interface IAIProvider {
  name: string;
  generatePlan(
    prompt: string,
    project: Project,
    selection: SelectionState
  ): Promise<AIPlan>;
}

/**
 * Intelligent AI Router classifying prompts into domains.
 */
export class AIRouter {
  static classify(prompt: string): TaskClassification {
    const lower = prompt.toLowerCase();

    const isMotion =
      lower.includes('animate') ||
      lower.includes('reveal') ||
      lower.includes('kinetic') ||
      lower.includes('typography') ||
      lower.includes('logo') ||
      lower.includes('easing') ||
      lower.includes('keyframe');

    const isVideo =
      lower.includes('cut') ||
      lower.includes('trim') ||
      lower.includes('clip') ||
      lower.includes('silence') ||
      lower.includes('pause') ||
      lower.includes('beat') ||
      lower.includes('music') ||
      lower.includes('split') ||
      lower.includes('audio');

    const isQuestion =
      lower.startsWith('how') ||
      lower.startsWith('what') ||
      lower.includes('duration?') ||
      lower.includes('how long');

    const isProject =
      lower.includes('export') ||
      lower.includes('render') ||
      lower.includes('resolution') ||
      lower.includes('fps');

    if (isQuestion) return 'QUESTION';
    if (isMotion && isVideo) return 'HYBRID';
    if (isMotion) return 'MOTION';
    if (isVideo) return 'VIDEO';
    if (isProject) return 'PROJECT';
    return 'HYBRID';
  }
}

/**
 * Default Local Mock / Heuristic AI Provider that decomposes prompt into valid Viewtion tool steps.
 */
export class LocalHeuristicProvider implements IAIProvider {
  readonly name = 'Local Heuristic Engine';

  async generatePlan(
    prompt: string,
    project: Project,
    selection: SelectionState
  ): Promise<AIPlan> {
    const classification = AIRouter.classify(prompt);
    const steps: AIPlanStep[] = [];
    const planId = `plan_${Date.now()}`;

    const lower = prompt.toLowerCase();

    if (classification === 'MOTION' || lower.includes('animate this logo') || lower.includes('reveal')) {
      steps.push({
        id: 'step_1',
        category: 'MOTION',
        description: 'Create animated logo reveal composition with smooth easing',
        toolName: 'create_composition',
        params: {
          name: 'Logo Reveal',
          width: project.settings.width,
          height: project.settings.height,
          duration: 5,
        },
      });
      steps.push({
        id: 'step_2',
        category: 'MOTION',
        description: 'Add title text layer "Shape Ideas Into Motion"',
        toolName: 'create_text_layer',
        params: {
          compositionId: 'auto_target',
          text: 'Shape Ideas Into Motion',
          fontSize: 56,
          fill: '#FFFFFF',
        },
      });
      steps.push({
        id: 'step_3',
        category: 'MOTION',
        description: 'Animate scale from 0.8 to 1.0 with elastic easing',
        toolName: 'add_keyframe',
        params: {
          layerId: 'auto_target',
          propertyName: 'scale.x',
          keyframes: [
            { time: 0, value: 0.8, easing: 'elastic' },
            { time: 1.5, value: 1.0, easing: 'elastic' },
          ],
        },
      });
    } else if (classification === 'VIDEO' || lower.includes('silence') || lower.includes('beat')) {
      steps.push({
        id: 'step_1',
        category: 'VIDEO',
        description: 'Trim silence in intro clips and snap to beat markers',
        toolName: 'trim_clip',
        params: {
          clipId: selection.id || 'first_clip',
          newStart: 0,
          newDuration: 3.5,
        },
      });
    } else {
      // Hybrid Plan
      steps.push({
        id: 'step_1',
        category: 'VIDEO',
        description: 'Align video footage to upbeat pacing',
        toolName: 'trim_clip',
        params: { clipId: selection.id || 'first_clip', newStart: 0, newDuration: 4.0 },
      });
      steps.push({
        id: 'step_2',
        category: 'MOTION',
        description: 'Generate dynamic motion typography composition',
        toolName: 'create_composition',
        params: { name: 'Dynamic Title', width: project.settings.width, height: project.settings.height, duration: 4.0 },
      });
      steps.push({
        id: 'step_3',
        category: 'VIDEO',
        description: 'Insert motion composition onto Graphics track',
        toolName: 'add_clip',
        params: {
          trackId: 'track_graphics_1',
          clipType: 'motionComposition',
          start: 0,
          duration: 4.0,
        },
      });
    }

    return {
      id: planId,
      userPrompt: prompt,
      classification,
      summary: `AI Plan: ${steps.length} coordinated editing operations`,
      steps,
    };
  }
}
