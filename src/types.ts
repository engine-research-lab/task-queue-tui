/** Energy level for a task */
export type EnergyLevel = 'low' | 'medium' | 'high';

/** Task type category */
export type TaskType = 'design' | 'admin' | 'thinking' | 'build';

/** Task status in the queue lifecycle */
export type TaskStatus = 'queued' | 'active' | 'completed';

/** A single task item */
export interface Task {
  id: string;
  name: string;
  energy_level: EnergyLevel;
  task_type: TaskType;
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

/** Display helpers */
export const TYPE_LABELS: Record<TaskType, string> = {
  design: 'DSN',
  admin: 'ADM',
  thinking: 'THK',
  build: 'BLD',
};

export const TYPE_NAMES: Record<TaskType, string> = {
  design: 'DESIGN',
  admin: 'ADMIN',
  thinking: 'THINKING',
  build: 'BUILD',
};

export const ENERGY_LABELS: Record<EnergyLevel, string> = {
  low: 'LOW',
  medium: 'MED',
  high: 'HIGH',
};

export const ENERGY_NAMES: Record<EnergyLevel, string> = {
  low: 'LOW',
  medium: 'MEDIUM',
  high: 'HIGH',
};

export const ENERGY_BARS: Record<EnergyLevel, string> = {
  low: '▓░░',
  medium: '▓▓░',
  high: '▓▓▓',
};

export const ALL_ENERGY_LEVELS: EnergyLevel[] = ['low', 'medium', 'high'];
export const ALL_TASK_TYPES: TaskType[] = ['design', 'admin', 'thinking', 'build'];
