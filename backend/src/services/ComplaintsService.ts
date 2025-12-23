import { queryMany, queryOne, query } from '../config/database';

export interface ComplaintFilters {
  category?: string[];
  seen_status?: number[]; // Массив статусов: [0, 1, 2]
  report_type?: number[];
  search?: string;
  date_from?: string;
  date_to?: string;
  damage_only?: boolean;
  types?: string[];
  priority?: number[];
  status?: boolean[];
}

export interface UpdateResolutionData {
  resolution_final: string;
  seen: number; // 0, 1, или 2
}

export class ComplaintsService {
  
  async getComplaints(filters: ComplaintFilters = {}): Promise<any[]> {
    // Строим UNION запрос для объединения жалоб и проверок
    let complaintsQuery = `
      SELECT
        id, bitrix_num, vkh_num, message_text,
        report_type, seen, status, priority,
        resolution_final, category, event_date, fee,
        'Жалоба' as record_type
      FROM complaints_list
      WHERE 1=1
    `;

    let checksQuery = `
      SELECT
        id, bitrix_num, vkh_num, message_text,
        report_type, seen, status, priority,
        resolution_final, category, event_date, fee,
        'Проверка' as record_type
      FROM checks_list
      WHERE 1=1
    `;
    
    const queryParams: any[] = [];
    let paramIndex = 1;

    // Построим условия фильтрации
    let whereConditions = '';
    
    // Фильтр по категориям
    if (filters.category && filters.category.length > 0) {
      const categoryConditions = filters.category.map(() => {
        return `category ILIKE $${paramIndex++}`;
      });
      whereConditions += ` AND (${categoryConditions.join(' OR ')})`;
      filters.category.forEach(cat => queryParams.push(`%${cat}%`));
    }

    // Фильтр по статусу принятия (массив значений 0, 1, 2)
    if (filters.seen_status && filters.seen_status.length > 0) {
      const seenPlaceholders = filters.seen_status.map(() => `$${paramIndex++}`).join(', ');
      whereConditions += ` AND seen IN (${seenPlaceholders})`;
      filters.seen_status.forEach(status => queryParams.push(status));
    }

    // Фильтр "только с ущербом"
    if (filters.damage_only) {
      whereConditions += ` AND fee >= 1000.0`;
    }

    // Фильтр по типу доклада
    if (filters.report_type && filters.report_type.length > 0) {
      const reportTypePlaceholders = filters.report_type.map(() => `$${paramIndex++}`).join(', ');
      whereConditions += ` AND report_type IN (${reportTypePlaceholders})`;
      filters.report_type.forEach(type => queryParams.push(type));
    }

    // Фильтр по приоритету
    if (filters.priority && filters.priority.length > 0) {
      const priorityPlaceholders = filters.priority.map(() => `$${paramIndex++}`).join(', ');
      whereConditions += ` AND priority IN (${priorityPlaceholders})`;
      filters.priority.forEach(priority => queryParams.push(priority));
    }

    // Фильтр по статусу задачи
    if (filters.status && filters.status.length > 0) {
      const statusPlaceholders = filters.status.map(() => `$${paramIndex++}`).join(', ');
      whereConditions += ` AND status IN (${statusPlaceholders})`;
      filters.status.forEach(status => queryParams.push(status));
    }

    // Фильтр по датам
    if (filters.date_from) {
      whereConditions += ` AND event_date >= $${paramIndex++}`;
      queryParams.push(filters.date_from);
    }

    if (filters.date_to) {
      whereConditions += ` AND event_date <= $${paramIndex++}`;
      queryParams.push(filters.date_to);
    }

    // Поиск по тексту
    if (filters.search) {
      whereConditions += ` AND (
        message_text ILIKE $${paramIndex} OR 
        bitrix_num::text ILIKE $${paramIndex} OR 
        vkh_num ILIKE $${paramIndex}
      )`;
      queryParams.push(`%${filters.search}%`);
      paramIndex++;
    }
    
    // Применяем одинаковые условия к обеим запросам
    complaintsQuery += whereConditions;
    checksQuery += whereConditions;
    
    // Определяем какие таблицы включать
    const includeComplaints = !filters.types || filters.types.includes('Жалобы');
    const includeChecks = !filters.types || filters.types.includes('Проверки');
    
    let finalQuery = '';
    
    if (includeComplaints && includeChecks) {
      finalQuery = `(${complaintsQuery}) UNION ALL (${checksQuery}) ORDER BY event_date DESC, bitrix_num DESC, id DESC`;
    } else if (includeComplaints) {
      finalQuery = `${complaintsQuery} ORDER BY event_date DESC, bitrix_num DESC, id DESC`;
    } else if (includeChecks) {
      finalQuery = `${checksQuery} ORDER BY event_date DESC, bitrix_num DESC, id DESC`;
    } else {
      // Если не выбран ни один тип, возвращаем пустой результат
      return [];
    }

    return await queryMany(finalQuery, queryParams);
  }

  async getComplaintById(id: number, type?: string): Promise<any> {
    const tableName = type === 'Проверка' ? 'checks_list' : 'complaints_list';
    const selectQuery = `
      SELECT id, bitrix_num, vkh_num, message_text,
             report_type, seen, status, priority, resolution_final, category, event_date, fee,
             '${type || 'Жалоба'}' as record_type
      FROM ${tableName}
      WHERE id = $1
    `;
    return await queryOne(selectQuery, [id]);
  }

  async updateSeenStatus(id: number, seen: number, type?: string): Promise<void> {
    const tableName = type === 'Проверка' ? 'checks_list' : 'complaints_list';
    const updateQuery = `UPDATE ${tableName} SET seen = $1 WHERE id = $2`;
    await query(updateQuery, [seen, id]);
  }

  // Автоматически обновить seen с 0 на 1 при взаимодействии
  async autoUpdateSeenStatus(id: number, type?: string): Promise<void> {
    const tableName = type === 'Проверка' ? 'checks_list' : 'complaints_list';
    const updateQuery = `
      UPDATE ${tableName}
      SET seen = 1
      WHERE id = $1 AND seen = 0
    `;
    await query(updateQuery, [id]);
  }

  async updateReportType(id: number, reportType: number, type?: string): Promise<void> {
    const tableName = type === 'Проверка' ? 'checks_list' : 'complaints_list';
    const updateQuery = `UPDATE ${tableName} SET report_type = $1 WHERE id = $2`;
    await query(updateQuery, [reportType, id]);
  }

  async updatePriority(id: number, priority: number, type?: string): Promise<void> {
    const tableName = type === 'Проверка' ? 'checks_list' : 'complaints_list';
    const updateQuery = `UPDATE ${tableName} SET priority = $1 WHERE id = $2`;
    await query(updateQuery, [priority, id]);
  }

  async updateResolution(id: number, data: UpdateResolutionData, type?: string): Promise<void> {
    const tableName = type === 'Проверка' ? 'checks_list' : 'complaints_list';
    const updateQuery = `
      UPDATE ${tableName} 
      SET 
        resolution_final = $1,
        seen = $2
      WHERE id = $3
    `;
    
    await query(updateQuery, [
      data.resolution_final,
      data.seen,
      id
    ]);
  }

  async getResolutionTemplates(): Promise<any[]> {
    const query = 'SELECT id, value FROM resolution_templates ORDER BY id';
    return await queryMany(query);
  }

  async addResolutionTemplate(value: string): Promise<any> {
    // Получаем максимальный ID и добавляем 1
    const maxIdQuery = 'SELECT COALESCE(MAX(id), 0) + 1 as next_id FROM resolution_templates';
    const maxIdResult = await queryOne(maxIdQuery);
    const nextId = maxIdResult.next_id;
    
    const insertQuery = 'INSERT INTO resolution_templates (id, value) VALUES ($1, $2) RETURNING *';
    const result = await queryOne(insertQuery, [nextId, value]);
    return result;
  }

  async deleteResolutionTemplate(id: number): Promise<void> {
    const deleteQuery = 'DELETE FROM resolution_templates WHERE id = $1';
    await query(deleteQuery, [id]);
  }

  async getCategories(): Promise<string[]> {
    const query = `
      SELECT DISTINCT TRIM(UNNEST(STRING_TO_ARRAY(category, ';'))) AS category
      FROM (
        SELECT category FROM complaints_list
        UNION ALL
        SELECT category FROM checks_list
      ) combined
      WHERE category IS NOT NULL AND category != ''
      ORDER BY category
    `;
    
    const result = await queryMany(query);
    return result.map(row => row.category);
  }

  async getStatistics(): Promise<{
    total: number;
    seen: number;
    withResolution: number;
    byReportType: Record<number, number>;
  }> {
    // Общая статистика
    const statsQuery = `
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN seen = true THEN 1 END) as seen,
        COUNT(CASE WHEN resolution_final IS NOT NULL THEN 1 END) as with_resolution
      FROM complaints_list
    `;
    
    const stats = await queryOne(statsQuery);

    // Статистика по типам докладов
    const reportTypeQuery = `
      SELECT report_type, COUNT(*) as count
      FROM complaints_list
      GROUP BY report_type
      ORDER BY report_type
    `;
    
    const reportTypeStats = await queryMany(reportTypeQuery);
    const byReportType: Record<number, number> = {};
    
    reportTypeStats.forEach(row => {
      byReportType[row.report_type] = parseInt(row.count);
    });

    return {
      total: parseInt(stats.total),
      seen: parseInt(stats.seen),
      withResolution: parseInt(stats.with_resolution),
      byReportType,
    };
  }
}