import type { ToolId } from '../store/types';
import type { Tool } from './types';
import { selectTool } from './selectTool';
import { wallTool } from './wallTool';
import { doorTool, windowTool } from './openingTools';
import { labelTool } from './labelTool';
import { measureTool } from './measureTool';

export const toolRegistry: Record<ToolId, Tool> = {
  select: selectTool,
  wall: wallTool,
  door: doorTool,
  window: windowTool,
  label: labelTool,
  measure: measureTool,
};
