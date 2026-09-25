import {
  Project,
  MotionComposition,
  MotionLayer,
  MotionTextLayer,
  ShapeLayer,
  MotionCompositionClip,
} from '@viewtion/project-schema';
import {
  ICommand,
  GroupedCommand,
  CreateMotionCompositionCommand,
  AddLayerCommand,
  AddClipCommand,
  TrimClipCommand,
  AddKeyframeCommand,
  ProjectStore,
} from '@viewtion/editor-core';
import { AIPlan } from '@viewtion/ai-core';

export class ToolDispatcher {
  static planToCommands(plan: AIPlan, project: Project): ICommand[] {
    const commands: ICommand[] = [];
    let currentCompId = '';

    for (const step of plan.steps) {
      switch (step.toolName) {
        case 'create_composition': {
          currentCompId = `comp_${Date.now()}`;
          const newComp: MotionComposition = {
            id: currentCompId,
            name: step.params.name || 'AI Motion Composition',
            width: step.params.width || project.settings.width,
            height: step.params.height || project.settings.height,
            fps: 30,
            duration: step.params.duration || 5,
            backgroundColor: 'transparent',
            layers: [],
          };
          commands.push(new CreateMotionCompositionCommand(newComp));
          break;
        }

        case 'create_text_layer': {
          const compId = step.params.compositionId === 'auto_target' ? currentCompId : step.params.compositionId;
          const textLayer: MotionTextLayer = {
            id: `layer_${Date.now()}`,
            name: 'Title Text',
            type: 'text',
            start: 0,
            duration: 5,
            visible: true,
            locked: false,
            transform: {
              position: { x: project.settings.width / 2, y: project.settings.height / 2 },
              scale: { x: 1, y: 1 },
              rotation: 0,
              anchor: { x: 0.5, y: 0.5 },
            },
            opacity: 1,
            blending: 'normal',
            text: step.params.text || 'Shape Ideas Into Motion',
            fontSize: step.params.fontSize || 52,
            fontFamily: 'Inter, sans-serif',
            fill: step.params.fill || '#FFFFFF',
            strokeWidth: 0,
            letterSpacing: 0,
            lineHeight: 1.2,
            alignment: 'center',
            keyframes: {
              'opacity': [
                { id: 'kf_op_1', time: 0, value: 0, easing: 'easeOut' },
                { id: 'kf_op_2', time: 0.8, value: 1, easing: 'easeOut' },
              ],
              'scale.x': [
                { id: 'kf_sc_1', time: 0, value: 0.8, easing: 'elastic' },
                { id: 'kf_sc_2', time: 1.2, value: 1.0, easing: 'elastic' },
              ],
              'scale.y': [
                { id: 'kf_sc_3', time: 0, value: 0.8, easing: 'elastic' },
                { id: 'kf_sc_4', time: 1.2, value: 1.0, easing: 'elastic' },
              ],
            },
          };
          commands.push(new AddLayerCommand(compId, textLayer));
          break;
        }

        case 'add_clip': {
          if (step.params.clipType === 'motionComposition' && currentCompId) {
            const motionClip: MotionCompositionClip = {
              id: `clip_${Date.now()}`,
              name: 'Dynamic Title Motion',
              type: 'motionComposition',
              compositionId: currentCompId,
              start: step.params.start || 0,
              duration: step.params.duration || 4.0,
              in: 0,
              out: 4.0,
              speed: 1.0,
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
            const trackId = step.params.trackId || project.timeline.tracks[0]?.id || 'track_graphics_1';
            commands.push(new AddClipCommand(trackId, motionClip));
          }
          break;
        }

        case 'trim_clip': {
          let targetClipId = step.params.clipId;
          if (targetClipId === 'first_clip') {
            for (const t of project.timeline.tracks) {
              if (t.clips.length > 0) {
                targetClipId = t.clips[0].id;
                break;
              }
            }
          }
          if (targetClipId && targetClipId !== 'first_clip') {
            commands.push(
              new TrimClipCommand(targetClipId, step.params.newStart, step.params.newDuration)
            );
          }
          break;
        }
      }
    }

    return commands;
  }

  static applyPlan(store: ProjectStore, plan: AIPlan): void {
    const commands = this.planToCommands(plan, store.getProject());
    if (commands.length === 0) return;

    const grouped = new GroupedCommand(`AI Edit: ${plan.summary}`, commands);
    store.dispatch(grouped);
  }
}
