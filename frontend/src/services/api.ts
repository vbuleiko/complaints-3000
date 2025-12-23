import axios from 'axios';
import { Complaint, ResolutionTemplate, UpdateComplaintRequest, ApiResponse, ComplaintFilters, StatisticsFilters, StatisticsData, ColumnBranch } from '../types';

const API_BASE_URL = process.env.REACT_APP_API_URL || '/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Интерсептор для обработки ошибок
api.interceptors.response.use(
  (response) => response,
  (error) => {
    console.error('API Error:', error);
    return Promise.reject(error);
  }
);

export const complaintsApi = {
  // Получить все жалобы
  async getComplaints(filters?: ComplaintFilters): Promise<Complaint[]> {
    const params = new URLSearchParams();
    
    if (filters?.category?.length) {
      params.append('category', filters.category.join(','));
    }
    if (filters?.seen_status !== undefined && filters.seen_status !== null && filters.seen_status.length > 0) {
      params.append('seen_status', filters.seen_status.join(','));
    }
    if (filters?.report_type !== undefined && filters.report_type !== null && filters.report_type.length > 0) {
      params.append('report_type', filters.report_type.join(','));
    }
    if (filters?.search) {
      params.append('search', filters.search);
    }
    if (filters?.date_from) {
      params.append('date_from', filters.date_from);
    }
    if (filters?.date_to) {
      params.append('date_to', filters.date_to);
    }
    if (filters?.damage_only !== undefined) {
      params.append('damage_only', filters.damage_only.toString());
    }
    if (filters?.types?.length) {
      params.append('types', filters.types.join(','));
    }
    if (filters?.priority !== undefined && filters.priority.length > 0) {
      params.append('priority', filters.priority.join(','));
    }
    if (filters?.status !== undefined && filters.status.length > 0) {
      params.append('status', filters.status.map(s => s.toString()).join(','));
    }

    const response = await api.get<ApiResponse<Complaint[]>>(`/complaints?${params}`);
    return response.data.data;
  },

  // Получить шаблоны резолюций
  async getResolutionTemplates(): Promise<ResolutionTemplate[]> {
    const response = await api.get<ApiResponse<ResolutionTemplate[]>>('/resolution-templates');
    return response.data.data;
  },

  // Добавить новый шаблон резолюции
  async addResolutionTemplate(value: string): Promise<ResolutionTemplate> {
    const response = await api.post<ApiResponse<ResolutionTemplate>>('/resolution-templates', { value });
    return response.data.data;
  },

  // Удалить шаблон резолюции
  async deleteResolutionTemplate(id: number): Promise<void> {
    await api.delete<ApiResponse<void>>(`/resolution-templates/${id}`);
  },

  // Обновить статус просмотра
  async updateSeenStatus(id: number, seen: number, type?: string): Promise<void> {
    await api.patch<ApiResponse<void>>(`/complaints/${id}/seen`, { seen, type });
  },

  // Обновить тип доклада
  async updateReportType(id: number, report_type: number, type?: string): Promise<void> {
    await api.patch<ApiResponse<void>>(`/complaints/${id}/report-type`, { report_type, type });
  },

  // Обновить приоритет
  async updatePriority(id: number, priority: number, type?: string): Promise<void> {
    await api.patch<ApiResponse<void>>(`/complaints/${id}/priority`, { priority, type });
  },

  // Обновить резолюцию
  async updateResolution(data: UpdateComplaintRequest): Promise<void> {
    const { id, ...updateData } = data;
    await api.patch<ApiResponse<void>>(`/complaints/${id}/resolution`, updateData);
  },

  // Получить уникальные категории
  async getCategories(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/categories');
    return response.data.data;
  },

  // Получить статистику (старый метод)
  async getStatistics(): Promise<{
    total: number;
    seen: number;
    withResolution: number;
    byReportType: Record<number, number>;
  }> {
    const response = await api.get<ApiResponse<any>>('/statistics');
    return response.data.data;
  },

  // Новые методы для расширенной статистики
  async getAdvancedStatistics(filters?: StatisticsFilters): Promise<StatisticsData> {
    const params = new URLSearchParams();
    
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.columns?.length) params.append('columns', filters.columns.join(','));
    if (filters?.branches?.length) params.append('branches', filters.branches.join(','));
    if (filters?.routes?.length) params.append('routes', filters.routes.join(','));
    if (filters?.categories?.length) params.append('categories', filters.categories.join(','));
    if (filters?.tables?.length) params.append('tables', filters.tables.join(','));
    if (filters?.types?.length) params.append('types', filters.types.join(','));

    const response = await api.get<ApiResponse<StatisticsData>>(`/statistics?${params}`);
    return response.data.data;
  },

  async getColumnBranches(): Promise<ColumnBranch[]> {
    const response = await api.get<ApiResponse<ColumnBranch[]>>('/statistics/column-branches');
    return response.data.data;
  },

  async getStatisticsRoutes(tables?: string[]): Promise<string[]> {
    const params = tables?.length ? `?tables=${tables.join(',')}` : '';
    const response = await api.get<ApiResponse<string[]>>(`/statistics/routes${params}`);
    return response.data.data;
  },

  async getStatisticsCategories(tables?: string[], types?: string[]): Promise<string[]> {
    const params = new URLSearchParams();
    if (tables?.length) params.append('tables', tables.join(','));
    if (types?.length) params.append('types', types.join(','));
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get<ApiResponse<string[]>>(`/statistics/categories${queryString}`);
    return response.data.data;
  },

  async getStatisticsBranches(): Promise<string[]> {
    const response = await api.get<ApiResponse<string[]>>('/statistics/branches');
    return response.data.data;
  },

  async getRoutesByColumns(columns?: (number | string)[], tables?: string[]): Promise<string[]> {
    const params = new URLSearchParams();
    if (columns?.length) params.append('columns', columns.join(','));
    if (tables?.length) params.append('tables', tables.join(','));
    
    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get<ApiResponse<string[]>>(`/statistics/routes-by-columns${queryString}`);
    return response.data.data;
  },

  async exportStatistics(filters?: StatisticsFilters): Promise<Blob> {
    const params = new URLSearchParams();
    
    if (filters?.dateFrom) params.append('dateFrom', filters.dateFrom);
    if (filters?.dateTo) params.append('dateTo', filters.dateTo);
    if (filters?.columns?.length) params.append('columns', filters.columns.join(','));
    if (filters?.branches?.length) params.append('branches', filters.branches.join(','));
    if (filters?.routes?.length) params.append('routes', filters.routes.join(','));
    if (filters?.categories?.length) params.append('categories', filters.categories.join(','));
    if (filters?.tables?.length) params.append('tables', filters.tables.join(','));
    if (filters?.types?.length) params.append('types', filters.types.join(','));

    const queryString = params.toString() ? `?${params.toString()}` : '';
    const response = await api.get(`/statistics/export${queryString}`, {
      responseType: 'blob'
    });
    
    return response.data;
  }
};

export default api;