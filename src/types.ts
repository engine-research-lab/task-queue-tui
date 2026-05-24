/** Energy level for a task — always low/medium/high */
export type EnergyLevel = 'low' | 'medium' | 'high';

/** Task status in the queue lifecycle */
export type TaskStatus = 'queued' | 'active' | 'completed';

/** A single task item */
export interface Task {
  id: string;
  name: string;
  energy_level: EnergyLevel;
  task_type: string;
  definition_of_done: string;
  sub_steps: string[];
  status: TaskStatus;
  position: number;
  created_at: string;
  completed_at: string | null;
}

/** Stats summary */
export interface TaskStats {
  today: number;
  week: number;
  total: number;
}

/** Auto-generate a short label from a type name (e.g. "research" → "RES") */
export function typeLabel(type: string): string {
  // Use first 3 uppercase letters of each word
  return type
    .split(/[\s_-]+/)
    .map(w => w.slice(0, 3).toUpperCase())
    .join('')
    .slice(0, 4);
}

/** Format a type name for display (e.g. "deep_work" → "DEEP WORK") */
export function typeDisplay(type: string): string {
  return type
    .replace(/[_-]/g, ' ')
    .toUpperCase();
}

/** Display helpers for energy (always fixed) */
export const ENERGY_NAMES: Record<EnergyLevel, string> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
};

export const ALL_ENERGY_LEVELS: EnergyLevel[] = ['low', 'medium', 'high'];
