export interface Complaint {
  id: number;
  bitrix_num: string;
  vkh_num: string;
  message_text: string;
  resolution?: string;
  add_comment?: string;
  report_type: number;
  seen: number; // 0 = Не требуется, 1 = Не принято, 2 = Принято
  resolution_text?: string;
  resolution_final?: string;
  category?: string;
  event_date?: string;
  fee?: number;
  record_type?: string;
  status?: boolean;
  priority: number;
}

export interface ResolutionTemplate {
  id: number;
  value: string;
}

export interface UpdateComplaintRequest {
  id: number;
  seen?: number; // 0, 1, или 2
  report_type?: number;
  resolution_text?: string;
  add_comment?: string;
  resolution_final?: string;
  type?: string;
}

export interface ComplaintFilters {
  category?: string[];
  seen_status?: number[]; // Массив статусов: [0, 1, 2]
  report_type?: number[] | null;
  search?: string;
  date_from?: string;
  date_to?: string;
  damage_only?: boolean;
  types?: string[];
  priority?: number[];
  status?: boolean[];
}

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export enum ReportType {
  NOT_REQUIRED = 0,
  BITRIX = 1,
  VERBAL = 2
}

export const REPORT_TYPE_LABELS: Record<number, string> = {
  [ReportType.NOT_REQUIRED]: 'Не требуется',
  [ReportType.BITRIX]: 'Битрикс',
  [ReportType.VERBAL]: 'Устно'
};

export const REPORT_TYPE_COLORS = {
  [ReportType.NOT_REQUIRED]: 'success',
  [ReportType.BITRIX]: 'warning',
  [ReportType.VERBAL]: 'error'
} as const;

// Константы для приоритетов
export const PRIORITY_LABELS: Record<number, string> = {
  0: 'Низкий приоритет',
  1: 'Средний приоритет',
  2: 'Высокий приоритет'
};

export const PRIORITY_EMOJIS: Record<number, string> = {
  0: '🟢',
  1: '🟡',
  2: '🔴'
};

// Константы для статусов принятия
export enum SeenStatus {
  NOT_REQUIRED = 0,
  NOT_ACCEPTED = 1,
  ACCEPTED = 2
}

export const SEEN_LABELS: Record<number, string> = {
  0: 'Не требуется',
  1: 'Не принято',
  2: 'Принято'
};

export const SEEN_COLORS: Record<number, string> = {
  0: '#d9d9d9', // серый
  1: '#fa8c16', // оранжевый
  2: '#52c41a'  // зеленый
};

// Интерфейсы для статистики
export interface StatisticsFilters {
  dateFrom?: string;
  dateTo?: string;
  columns?: (number | string)[]; // Поддерживаем как номера колонн, так и названия филиалов
  branches?: string[]; // Названия площадок
  routes?: string[]; // Номера маршрутов
  categories?: string[]; // Категории жалоб
  tables?: string[]; // Выбранные таблицы для анализа
  types?: string[]; // Жалобы или Проверки
}

export interface ColumnBranch {
  column_no: number;
  branch_name: string;
}

export interface StatisticsData {
  byColumns: Array<{ column_no: number; count: number; branch_name?: string }>;
  byBranches: Array<{ branch_name: string; count: number }>;
  byRoutes: Array<{ route_num: string; count: number }>;
  byCategories: Array<{ category: string; count: number }>;
  byDates: Array<{ date: string; count: number }>;
  totalCount: number;
}

export interface ExportDataRow {
  event_date: string;
  complaint_text: string;
  route_num: string;
  column_no: number;
  category: string;
  bitrix_num: string | null;
}