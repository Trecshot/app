export type WeekType = 'CARGA' | 'DESCARGA';

export interface MesocycleWeek {
  id: number;
  week_number: number;
  type: WeekType;
  total_planned_sessions: number;
  week_comment: string | null;
  is_current: boolean;
}

export interface SessionNote {
  id: number;
  week_id: number;
  session_index: number;
  session_note: string;
}
