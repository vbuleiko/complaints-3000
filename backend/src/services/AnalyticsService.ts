import { analyticsQueryMany } from '../config/database';

export interface ChecksAnalyticsData {
  task_num_bitrix: string;
  column_num: string;
  route: string;
}

export class AnalyticsService {
  
  // Получить данные о колоннах и маршрутах для проверок по битрикс номерам
  async getChecksAnalyticsData(bitrixNumbers: string[]): Promise<Map<string, ChecksAnalyticsData>> {
    if (!bitrixNumbers.length) {
      return new Map();
    }

    try {
      // Создаем плейсхолдеры для параметров
      const placeholders = bitrixNumbers.map((_, index) => `$${index + 1}`).join(',');
      
      const query = `
        SELECT task_num_bitrix, column_num, route
        FROM checks_workflow.checks
        WHERE task_num_bitrix IN (${placeholders})
      `;

      const results = await analyticsQueryMany(query, bitrixNumbers);
      
      // Создаем Map для быстрого поиска по битрикс номеру
      const dataMap = new Map<string, ChecksAnalyticsData>();
      
      results.forEach(row => {
        dataMap.set(row.task_num_bitrix, {
          task_num_bitrix: row.task_num_bitrix,
          column_num: row.column_num,
          route: row.route
        });
      });
      
      return dataMap;
    } catch (error) {
      console.error('Ошибка получения данных из ANALYTICS_DB.checks:', error);
      return new Map();
    }
  }

  // Парсить номер колонны из строки "Колонна № 1" -> 1
  static parseColumnNumber(columnStr: string): number | null {
    if (!columnStr) return null;
    
    const match = columnStr.match(/Колонна\s*№\s*(\d+)/i);
    return match ? parseInt(match[1]) : null;
  }

  // Получить маршруты для проверок по фильтрам
  async getRoutesForChecks(filters?: {
    columns?: (number | string)[];
    bitrixNumbers?: string[];
  }): Promise<string[]> {
    try {
      let query = 'SELECT DISTINCT route FROM checks_workflow.checks WHERE 1=1';
      const params: any[] = [];
      let paramIndex = 1;

      // Фильтр по битрикс номерам
      if (filters?.bitrixNumbers?.length) {
        const placeholders = filters.bitrixNumbers.map(() => `$${paramIndex++}`).join(',');
        query += ` AND task_num_bitrix IN (${placeholders})`;
        params.push(...filters.bitrixNumbers);
      }

      // Фильтр по колоннам (если указаны)
      if (filters?.columns?.length) {
        const columnConditions: string[] = [];
        
        filters.columns.forEach(col => {
          if (typeof col === 'number') {
            columnConditions.push(`column_num ILIKE $${paramIndex++}`);
            params.push(`%№ ${col}%`);
          }
        });
        
        if (columnConditions.length) {
          query += ` AND (${columnConditions.join(' OR ')})`;
        }
      }

      query += ' ORDER BY route';
      
      const results = await analyticsQueryMany(query, params);
      return results.map(row => row.route).filter(route => route);
    } catch (error) {
      console.error('Ошибка получения маршрутов из ANALYTICS_DB.checks:', error);
      return [];
    }
  }

  // Получить колонны для проверок
  async getColumnsForChecks(): Promise<Array<{column_no: number, raw_value: string}>> {
    try {
      const query = `
        SELECT DISTINCT column_num
        FROM checks_workflow.checks
        WHERE column_num IS NOT NULL AND column_num != ''
        ORDER BY column_num
      `;
      
      const results = await analyticsQueryMany(query, []);
      
      return results
        .map(row => ({
          column_no: AnalyticsService.parseColumnNumber(row.column_num),
          raw_value: row.column_num
        }))
        .filter(item => item.column_no !== null)
        .sort((a, b) => a.column_no! - b.column_no!);
    } catch (error) {
      console.error('Ошибка получения колонн из ANALYTICS_DB.checks:', error);
      return [];
    }
  }
}