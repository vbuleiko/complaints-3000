import { queryMany, queryOne, analyticsQueryMany } from '../config/database';
import { AnalyticsService } from './AnalyticsService';

export interface StatisticsFilters {
  dateFrom?: string;
  dateTo?: string;
  columns?: (number | string)[]; // Поддерживаем как номера колонн, так и названия филиалов
  branches?: string[];
  routes?: string[];
  categories?: string[];
  tables?: string[];
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
  type: string;
}

export class StatisticsService {
  private readonly TABLE_NAMES = ['ob', 'data_01_30', 'data_01_40', 'data_01_07'];
  private readonly CHECKS_TABLE = 'checks_workflow.checks';
  private analyticsService: AnalyticsService;
  private categoriesMappingCache: Map<string, string> | null = null;

  constructor() {
    this.analyticsService = new AnalyticsService();
  }

  // Получение связи между колоннами и площадками
  async getColumnBranches(): Promise<ColumnBranch[]> {
    try {
      // Пробуем различные варианты названий столбцов
      let query = `
        SELECT column_no, branch 
        FROM branch 
        ORDER BY column_no
      `;
      
      try {
        const result = await queryMany(query);
        return result.map(item => ({
          column_no: item.column_no,
          branch_name: item.branch
        }));
      } catch (error) {
        console.log('Ошибка получения связей колонн и площадок:', error);
        // Возвращаем резервные данные с тремя площадками
        return this.getFallbackColumnBranches();
      }
    } catch (error) {
      console.log('Ошибка получения связей колонн и площадок:', error);
      // Возвращаем резервные данные с тремя площадками
      return this.getFallbackColumnBranches();
    }
  }

  // Резервные данные для связи колонн и площадок (актуальные из таблицы branch)
  private getFallbackColumnBranches(): ColumnBranch[] {
    return [
      { column_no: 1, branch_name: 'Витебский' },
      { column_no: 2, branch_name: 'Витебский' },
      { column_no: 3, branch_name: 'Витебский' },
      { column_no: 4, branch_name: 'Горская' },
      { column_no: 5, branch_name: 'Горская' },
      { column_no: 6, branch_name: 'Горская' },
      { column_no: 7, branch_name: 'Горская' },
      { column_no: 8, branch_name: 'Горская' },
      { column_no: 9, branch_name: 'Зеленогорск' },
      { column_no: 10, branch_name: 'Витебский' },
      { column_no: 11, branch_name: 'Витебский' },
      { column_no: 12, branch_name: 'Горская' },
      { column_no: 13, branch_name: 'Горская' },
      { column_no: 14, branch_name: 'Горская' }
    ];
  }

  // Получение списка площадок
  async getBranches(): Promise<string[]> {
    try {
      const columnBranches = await this.getColumnBranches();
      const uniqueBranches = Array.from(new Set(columnBranches.map(cb => cb.branch_name)));
      return uniqueBranches.sort();
    } catch (error) {
      console.log('Ошибка получения списка площадок:', error);
      return ['Витебский', 'Горская', 'Зеленогорск'];
    }
  }

  // Получение списка всех маршрутов из всех таблиц
  async getRoutes(tables?: string[]): Promise<string[]> {
    const tablesToQuery = tables && tables.length > 0 ? tables : this.TABLE_NAMES;
    let allRoutes = new Set<string>();

    for (const table of tablesToQuery) {
      try {
        const query = `
          SELECT DISTINCT UNNEST(STRING_TO_ARRAY(route_num, ';')) as route
          FROM ${table}
          WHERE route_num IS NOT NULL AND route_num != ''
          ORDER BY route
        `;
        const routes = await queryMany(query);
        routes.forEach(r => {
          if (r.route && r.route.trim()) {
            allRoutes.add(r.route.trim());
          }
        });
      } catch (error) {
        console.log(`Ошибка получения маршрутов из таблицы ${table}:`, error);
      }
    }

    return Array.from(allRoutes).sort();
  }

  // Получение маршрутов по выбранным колоннам/площадкам
  async getRoutesByColumns(columns?: (number | string)[], tables?: string[]): Promise<string[]> {
    if (!columns || columns.length === 0) {
      return this.getRoutes(tables);
    }

    try {
      // Получаем актуальное распределение
      const latestDistribution = await queryOne(`
        SELECT id FROM distribution_set 
        ORDER BY effective_from DESC 
        LIMIT 1
      `);
      
      if (!latestDistribution) {
        console.log('Не найдено актуальное распределение маршрутов');
        return this.getRoutes(tables);
      }

      const columnBranches = await this.getColumnBranches();
      const columnBranchMap = new Map(columnBranches.map(cb => [cb.column_no, cb.branch_name]));
      
      // Разделяем колонны и филиалы
      const directColumns = columns.filter(c => typeof c === 'number') as number[];
      const branches = columns.filter(c => typeof c === 'string') as string[];
      
      let allColumns: number[] = [...directColumns];
      
      // Добавляем колонны для филиалов
      if (branches.length > 0) {
        const branchColumnMap = new Map<string, number[]>();
        columnBranchMap.forEach((branchName, columnNo) => {
          if (!branchColumnMap.has(branchName)) {
            branchColumnMap.set(branchName, []);
          }
          branchColumnMap.get(branchName)!.push(columnNo);
        });
        
        for (const branchName of branches) {
          const branchColumns = branchColumnMap.get(branchName) || [];
          allColumns.push(...branchColumns);
        }
      }
      
      // Убираем дубликаты
      allColumns = [...new Set(allColumns)];
      
      if (allColumns.length === 0) {
        return [];
      }

      // Получаем маршруты для выбранных колонн
      const placeholders = allColumns.map((_, index) => `$${index + 2}`).join(',');
      const routes = await queryMany(`
        SELECT DISTINCT route 
        FROM route_assignment 
        WHERE distribution_id = $1 AND column_number IN (${placeholders})
        ORDER BY route
      `, [latestDistribution.id, ...allColumns]);

      return routes.map(r => r.route).sort();
    } catch (error) {
      console.log('Ошибка получения маршрутов по колоннам:', error);
      // Возвращаем все маршруты в случае ошибки
      return this.getRoutes(tables);
    }
  }

  // Получение списка всех категорий из всех таблиц
  async getCategories(tables?: string[]): Promise<string[]> {
    const tablesToQuery = tables && tables.length > 0 ? tables : this.TABLE_NAMES;
    let allCategories = new Set<string>();

    for (const table of tablesToQuery) {
      try {
        const query = `
          SELECT DISTINCT TRIM(UNNEST(STRING_TO_ARRAY(category, ';'))) as cat
          FROM ${table}
          WHERE category IS NOT NULL AND category != ''
          ORDER BY cat
        `;
        const categories = await queryMany(query);
        categories.forEach(c => {
          if (c.cat && c.cat.trim()) {
            allCategories.add(c.cat.trim());
          }
        });
      } catch (error) {
        console.log(`Ошибка получения категорий из таблицы ${table}:`, error);
      }
    }

    return Array.from(allCategories).sort();
  }

  // Построение WHERE условий для фильтрации по датам
  private buildDateCondition(filters: StatisticsFilters, table: string): { condition: string; params: any[]; paramIndex: number } {
    let condition = '';
    const params: any[] = [];
    let paramIndex = 1;

    if (filters.dateFrom || filters.dateTo) {
      if (table === 'data_01_30') {
        // Для data_01_30 сначала пробуем event_date, потом vkh_num
        condition += ' AND (';
        
        if (filters.dateFrom) {
          condition += `(event_date >= $${paramIndex} OR 
            (event_date IS NULL AND 
             SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})') IS NOT NULL AND 
             TO_DATE(SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY') >= $${paramIndex}))`;
          params.push(filters.dateFrom);
          paramIndex++;
        }
        
        if (filters.dateTo) {
          if (filters.dateFrom) condition += ' AND ';
          condition += `(event_date <= $${paramIndex} OR 
            (event_date IS NULL AND 
             SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})') IS NOT NULL AND 
             TO_DATE(SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY') <= $${paramIndex}))`;
          params.push(filters.dateTo);
          paramIndex++;
        }
        
        condition += ')';
      } else {
        // Для остальных таблиц только vkh_num
        condition += ' AND ';
        
        if (filters.dateFrom && filters.dateTo) {
          condition += `SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})') IS NOT NULL AND 
            TO_DATE(SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY') 
            BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
          params.push(filters.dateFrom, filters.dateTo);
          paramIndex += 2;
        } else if (filters.dateFrom) {
          condition += `SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})') IS NOT NULL AND 
            TO_DATE(SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY') >= $${paramIndex}`;
          params.push(filters.dateFrom);
          paramIndex++;
        } else if (filters.dateTo) {
          condition += `SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})') IS NOT NULL AND 
            TO_DATE(SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY') <= $${paramIndex}`;
          params.push(filters.dateTo);
          paramIndex++;
        }
      }
    }

    return { condition, params, paramIndex };
  }

  // Получение статистики
  async getStatistics(filters: StatisticsFilters): Promise<StatisticsData> {
    const result: StatisticsData = {
      byColumns: [],
      byBranches: [],
      byRoutes: [],
      byCategories: [],
      byDates: [],
      totalCount: 0
    };

    // Получаем данные о связи колонн и площадок
    const columnBranches = await this.getColumnBranches();
    const columnBranchMap = new Map(columnBranches.map(cb => [cb.column_no, cb.branch_name]));

    // Определяем какие типы данных запрашивать
    const includeComplaints = !filters.types || filters.types.includes('complaint');
    const includeChecks = !filters.types || filters.types.includes('check');

    // Обрабатываем данные жалоб
    if (includeComplaints) {
      const tablesToQuery = filters.tables && filters.tables.length > 0 ? filters.tables : this.TABLE_NAMES;
      for (const table of tablesToQuery) {
        try {
          await this.aggregateTableStatistics(table, filters, result, columnBranchMap);
        } catch (error) {
          console.log(`Ошибка получения статистики из таблицы ${table}:`, error);
        }
      }
    }

    // Обрабатываем данные проверок
    if (includeChecks) {
      try {
        await this.aggregateChecksStatistics(filters, result);
      } catch (error) {
        console.log(`Ошибка получения статистики из таблицы ${this.CHECKS_TABLE}:`, error);
      }
    }

    // Сортируем результаты
    result.byColumns.sort((a, b) => a.column_no - b.column_no);
    result.byBranches.sort((a, b) => b.count - a.count);
    result.byRoutes.sort((a, b) => b.count - a.count);
    result.byCategories.sort((a, b) => b.count - a.count);
    result.byDates.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return result;
  }

  // Получение детализированных данных для экспорта
  async getExportData(filters: StatisticsFilters): Promise<ExportDataRow[]> {
    const result: ExportDataRow[] = [];

    // Определяем какие типы данных экспортировать
    const includeComplaints = !filters.types || filters.types.includes('complaint');
    const includeChecks = !filters.types || filters.types.includes('check');

    // Экспортируем данные жалоб
    if (includeComplaints) {
      const tablesToQuery = filters.tables && filters.tables.length > 0 ? filters.tables : this.TABLE_NAMES;
      for (const table of tablesToQuery) {
        try {
          await this.getTableExportData(table, filters, result);
        } catch (error) {
          console.log(`Ошибка получения данных экспорта из таблицы ${table}:`, error);
        }
      }
    }

    // Экспортируем данные проверок
    if (includeChecks) {
      try {
        await this.getChecksExportData(filters, result);
      } catch (error) {
        console.log(`Ошибка получения данных экспорта из таблицы ${this.CHECKS_TABLE}:`, error);
      }
    }

    return result;
  }

  // Получение данных экспорта из одной таблицы
  private async getTableExportData(
    table: string,
    filters: StatisticsFilters,
    result: ExportDataRow[]
  ): Promise<void> {
    let baseQuery = '';
    let params: any[] = [];
    let paramIndex = 1;

    // Добавляем условие по дате для экспорта
    let whereCondition = '';
    const tablePrefix = table === 'data_01_30' ? '' : 't.';
    
    if (filters.dateFrom || filters.dateTo) {
      if (table === 'data_01_30') {
        // Для data_01_30 сначала пробуем event_date, потом vkh_num
        whereCondition += ' AND (';
        
        if (filters.dateFrom) {
          whereCondition += `(event_date >= $${paramIndex} OR 
            (event_date IS NULL AND 
             SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})') IS NOT NULL AND 
             TO_DATE(SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY') >= $${paramIndex}))`;
          params.push(filters.dateFrom);
          paramIndex++;
        }
        
        if (filters.dateTo) {
          if (filters.dateFrom) whereCondition += ' AND ';
          whereCondition += `(event_date <= $${paramIndex} OR 
            (event_date IS NULL AND 
             SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})') IS NOT NULL AND 
             TO_DATE(SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY') <= $${paramIndex}))`;
          params.push(filters.dateTo);
          paramIndex++;
        }
        
        whereCondition += ')';
      } else {
        // Для остальных таблиц только vkh_num с префиксом
        whereCondition += ' AND ';
        
        if (filters.dateFrom && filters.dateTo) {
          whereCondition += `SUBSTRING(${tablePrefix}vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})') IS NOT NULL AND 
            TO_DATE(SUBSTRING(${tablePrefix}vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY') 
            BETWEEN $${paramIndex} AND $${paramIndex + 1}`;
          params.push(filters.dateFrom, filters.dateTo);
          paramIndex += 2;
        } else if (filters.dateFrom) {
          whereCondition += `SUBSTRING(${tablePrefix}vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})') IS NOT NULL AND 
            TO_DATE(SUBSTRING(${tablePrefix}vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY') >= $${paramIndex}`;
          params.push(filters.dateFrom);
          paramIndex++;
        } else if (filters.dateTo) {
          whereCondition += `SUBSTRING(${tablePrefix}vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})') IS NOT NULL AND 
            TO_DATE(SUBSTRING(${tablePrefix}vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY') <= $${paramIndex}`;
          params.push(filters.dateTo);
          paramIndex++;
        }
      }
    }

    // Фильтр по колоннам (включая фильтрацию по филиалам)
    if (filters.columns && filters.columns.length > 0) {
      // Получаем актуальную карту колонн и филиалов
      const columnBranches = await this.getColumnBranches();
      const columnBranchMap = new Map(columnBranches.map(cb => [cb.column_no, cb.branch_name]));
      
      // Разделяем колонны и филиалы
      const columns = filters.columns.filter(c => typeof c === 'number') as number[];
      const branches = filters.columns.filter(c => typeof c === 'string') as string[];
      
      let allColumns: number[] = [...columns];
      
      // Добавляем колонны для филиалов
      if (branches.length > 0) {
        const branchColumnMap = new Map<string, number[]>();
        columnBranchMap.forEach((branchName, columnNo) => {
          if (!branchColumnMap.has(branchName)) {
            branchColumnMap.set(branchName, []);
          }
          branchColumnMap.get(branchName)!.push(columnNo);
        });
        
        for (const branchName of branches) {
          const branchColumns = branchColumnMap.get(branchName) || [];
          allColumns.push(...branchColumns);
        }
      }
      
      // Убираем дубликаты
      allColumns = [...new Set(allColumns)];
      
      if (allColumns.length > 0) {
        const columnConditions = allColumns.map(() => `${table === 'data_01_30' ? '' : 't.'}column_no = $${paramIndex++}`);
        whereCondition += ` AND (${columnConditions.join(' OR ')})`;
        params.push(...allColumns);
      }
    }

    // Фильтр по маршрутам (учитываем multiple через ;)
    if (filters.routes && filters.routes.length > 0) {
      const routePrefix = table === 'data_01_30' ? '' : 't.';
      const routeConditions = filters.routes.map(() => {
        const currentIndex = paramIndex;
        paramIndex += 3;
        return `(${routePrefix}route_num LIKE $${currentIndex} OR ${routePrefix}route_num LIKE $${currentIndex + 1} OR ${routePrefix}route_num LIKE $${currentIndex + 2})`;
      });
      whereCondition += ` AND (${routeConditions.join(' OR ')})`;
      
      filters.routes.forEach(route => {
        params.push(`${route}%`, `%;${route}%`, `%;${route}`);
      });
    }

    // Фильтр по категориям (учитываем multiple через ;)
    if (filters.categories && filters.categories.length > 0) {
      const categoryPrefix = table === 'data_01_30' ? '' : 't.';
      const categoryConditions = filters.categories.map(() => {
        const currentIndex = paramIndex;
        paramIndex += 3;
        return `(${categoryPrefix}category LIKE $${currentIndex} OR ${categoryPrefix}category LIKE $${currentIndex + 1} OR ${categoryPrefix}category LIKE $${currentIndex + 2})`;
      });
      whereCondition += ` AND (${categoryConditions.join(' OR ')})`;
      
      filters.categories.forEach(category => {
        params.push(`${category}%`, `%;${category}%`, `%;${category}`);
      });
    }

    // Строим запрос в зависимости от таблицы
    if (table === 'data_01_30') {
      // Для data_01_30 номер битрикса в bitrix_secondary
      baseQuery = `
        SELECT 
          COALESCE(
            DATE(event_date), 
            TO_DATE(SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY')
          ) as event_date,
          message_text as complaint_text,
          route_num,
          column_no,
          category,
          bitrix_secondary as bitrix_num
        FROM ${table} 
        WHERE 1=1${whereCondition}
        ORDER BY event_date DESC
      `;
    } else {
      // Для остальных таблиц ищем номер битрикса через inbox
      baseQuery = `
        SELECT 
          TO_DATE(SUBSTRING(t.vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY') as event_date,
          t.message_text as complaint_text,
          t.route_num,
          t.column_no,
          t.category,
          i.bitrix_num
        FROM ${table} t
        LEFT JOIN inbox i ON t.vkh_num = i.vkh_num
        WHERE 1=1${whereCondition}
        ORDER BY event_date DESC
      `;
    }

    const rows = await queryMany(baseQuery, params);

    for (const row of rows) {
      result.push({
        event_date: row.event_date ? row.event_date.toISOString().split('T')[0] : '',
        complaint_text: row.complaint_text || '',
        route_num: row.route_num || '',
        column_no: parseInt(row.column_no) || 0,
        category: row.category || '',
        bitrix_num: row.bitrix_num || null,
        type: 'Жалоба'
      });
    }
  }

  // Агрегация статистики по одной таблице
  private async aggregateTableStatistics(
    table: string, 
    filters: StatisticsFilters, 
    result: StatisticsData, 
    columnBranchMap: Map<number, string>
  ): Promise<void> {
    let baseQuery = `FROM ${table} WHERE 1=1`;
    let params: any[] = [];
    let paramIndex = 1;

    // Добавляем условие по дате
    const dateCondition = this.buildDateCondition(filters, table);
    baseQuery += dateCondition.condition;
    params.push(...dateCondition.params);
    paramIndex = dateCondition.paramIndex;

    // Фильтр по колоннам (включая фильтрацию по филиалам)
    if (filters.columns && filters.columns.length > 0) {
      // Разделяем колонны и филиалы
      const columns = filters.columns.filter(c => typeof c === 'number') as number[];
      const branches = filters.columns.filter(c => typeof c === 'string') as string[];
      
      let allColumns: number[] = [...columns];
      
      // Добавляем колонны для филиалов
      if (branches.length > 0) {
        const branchColumnMap = new Map<string, number[]>();
        columnBranchMap.forEach((branchName, columnNo) => {
          if (!branchColumnMap.has(branchName)) {
            branchColumnMap.set(branchName, []);
          }
          branchColumnMap.get(branchName)!.push(columnNo);
        });
        
        for (const branchName of branches) {
          const branchColumns = branchColumnMap.get(branchName) || [];
          allColumns.push(...branchColumns);
        }
      }
      
      // Убираем дубликаты
      allColumns = [...new Set(allColumns)];
      
      if (allColumns.length > 0) {
        const columnConditions = allColumns.map(() => `column_no = $${paramIndex++}`);
        baseQuery += ` AND (${columnConditions.join(' OR ')})`;
        params.push(...allColumns);
      }
    }

    // Фильтр по маршрутам (учитываем multiple через ;)
    if (filters.routes && filters.routes.length > 0) {
      const routeConditions = filters.routes.map(() => {
        const currentIndex = paramIndex;
        paramIndex += 3;
        return `(route_num LIKE $${currentIndex} OR route_num LIKE $${currentIndex + 1} OR route_num LIKE $${currentIndex + 2})`;
      });
      baseQuery += ` AND (${routeConditions.join(' OR ')})`;
      
      filters.routes.forEach(route => {
        params.push(`${route}%`, `%;${route}%`, `%;${route}`);
      });
    }

    // Фильтр по категориям (учитываем multiple через ;)
    if (filters.categories && filters.categories.length > 0) {
      const categoryConditions = filters.categories.map(() => {
        const currentIndex = paramIndex;
        paramIndex += 3;
        return `(category LIKE $${currentIndex} OR category LIKE $${currentIndex + 1} OR category LIKE $${currentIndex + 2})`;
      });
      baseQuery += ` AND (${categoryConditions.join(' OR ')})`;
      
      filters.categories.forEach(category => {
        params.push(`${category}%`, `%;${category}%`, `%;${category}`);
      });
    }

    // Получаем общий count
    const countResult = await queryOne(`SELECT COUNT(*) as total ${baseQuery}`, params);
    result.totalCount += parseInt(countResult.total);

    // Статистика по колоннам
    const columnStats = await queryMany(
      `SELECT column_no, COUNT(*) as count ${baseQuery} AND column_no IS NOT NULL GROUP BY column_no`, 
      params
    );
    
    for (const stat of columnStats) {
      const columnNo = parseInt(stat.column_no);
      const existing = result.byColumns.find(item => item.column_no === columnNo);
      if (existing) {
        existing.count += parseInt(stat.count);
      } else {
        result.byColumns.push({
          column_no: columnNo,
          count: parseInt(stat.count),
          branch_name: columnBranchMap.get(columnNo)
        });
      }
    }

    // Статистика по площадкам (через колонны)
    for (const stat of columnStats) {
      // Преобразуем column_no из строки в число для поиска в Map
      const columnNo = parseInt(stat.column_no);
      const branchName = columnBranchMap.get(columnNo);
      if (branchName) {
        const existing = result.byBranches.find(item => item.branch_name === branchName);
        if (existing) {
          existing.count += parseInt(stat.count);
        } else {
          result.byBranches.push({
            branch_name: branchName,
            count: parseInt(stat.count)
          });
        }
      }
    }

    // Статистика по маршрутам
    const routeStats = await queryMany(
      `SELECT TRIM(UNNEST(STRING_TO_ARRAY(route_num, ';'))) as route_num, COUNT(*) as count 
       ${baseQuery} AND route_num IS NOT NULL AND route_num != '' 
       GROUP BY TRIM(UNNEST(STRING_TO_ARRAY(route_num, ';')))`, 
      params
    );
    
    for (const stat of routeStats) {
      if (stat.route_num && stat.route_num.trim()) {
        const existing = result.byRoutes.find(item => item.route_num === stat.route_num);
        if (existing) {
          existing.count += parseInt(stat.count);
        } else {
          result.byRoutes.push({
            route_num: stat.route_num,
            count: parseInt(stat.count)
          });
        }
      }
    }

    // Статистика по категориям
    const categoryStats = await queryMany(
      `SELECT TRIM(UNNEST(STRING_TO_ARRAY(category, ';'))) as category, COUNT(*) as count 
       ${baseQuery} AND category IS NOT NULL AND category != '' 
       GROUP BY TRIM(UNNEST(STRING_TO_ARRAY(category, ';')))`, 
      params
    );
    
    for (const stat of categoryStats) {
      if (stat.category && stat.category.trim()) {
        const existing = result.byCategories.find(item => item.category === stat.category);
        if (existing) {
          existing.count += parseInt(stat.count);
        } else {
          result.byCategories.push({
            category: stat.category,
            count: parseInt(stat.count)
          });
        }
      }
    }

    // Статистика по датам
    let dateQuery = '';
    if (table === 'data_01_30') {
      dateQuery = `
        SELECT 
          COALESCE(
            DATE(event_date), 
            TO_DATE(SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY')
          ) as date, 
          COUNT(*) as count 
        ${baseQuery} AND (
          event_date IS NOT NULL OR 
          SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})') IS NOT NULL
        )
        GROUP BY COALESCE(
          DATE(event_date), 
          TO_DATE(SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY')
        )
      `;
    } else {
      dateQuery = `
        SELECT 
          TO_DATE(SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY') as date, 
          COUNT(*) as count 
        ${baseQuery} AND SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})') IS NOT NULL
        GROUP BY TO_DATE(SUBSTRING(vkh_num FROM ' от ([0-9]{2}\\.[0-9]{2}\\.[0-9]{4})'), 'DD.MM.YYYY')
      `;
    }

    const dateStats = await queryMany(dateQuery, params);
    
    for (const stat of dateStats) {
      if (stat.date) {
        const dateStr = new Date(stat.date).toISOString().split('T')[0];
        const existing = result.byDates.find(item => item.date === dateStr);
        if (existing) {
          existing.count += parseInt(stat.count);
        } else {
          result.byDates.push({
            date: dateStr,
            count: parseInt(stat.count)
          });
        }
      }
    }
  }

  // Агрегация статистики по проверкам (checks) из ANALYTICS_DB
  private async aggregateChecksStatistics(filters: StatisticsFilters, result: StatisticsData): Promise<void> {
    const { condition: whereCondition, params } = await this.buildChecksCondition(filters);
    
    // Получаем карту колонн к площадкам
    const columnBranches = await this.getColumnBranches();
    const columnBranchMap = new Map(columnBranches.map(cb => [cb.column_no, cb.branch_name]));
    
    // Счетчик общего количества
    const totalQuery = `SELECT COUNT(*) as total FROM ${this.CHECKS_TABLE} WHERE 1=1 ${whereCondition}`;
    const totalResult = await analyticsQueryMany(totalQuery, params);
    result.totalCount += parseInt(totalResult[0]?.total || '0');

    // Статистика по колоннам 
    const columnsQuery = `
      SELECT 
        CAST(REGEXP_REPLACE(column_num, '[^0-9]', '', 'g') AS INTEGER) as column_no, 
        COUNT(*) as count 
      FROM ${this.CHECKS_TABLE} 
      WHERE 1=1 ${whereCondition} AND column_num IS NOT NULL AND column_num ~ 'Колонна № [0-9]+'
      GROUP BY CAST(REGEXP_REPLACE(column_num, '[^0-9]', '', 'g') AS INTEGER)
    `;
    const columnsStats = await analyticsQueryMany(columnsQuery, params);
    
    for (const stat of columnsStats) {
      const columnNo = parseInt(stat.column_no);
      const existing = result.byColumns.find(item => item.column_no === columnNo);
      if (existing) {
        existing.count += parseInt(stat.count);
      } else {
        result.byColumns.push({
          column_no: columnNo,
          count: parseInt(stat.count),
          branch_name: columnBranchMap.get(columnNo)
        });
      }
      
      // Обновляем статистику по площадкам
      const branchName = columnBranchMap.get(columnNo);
      if (branchName) {
        const existingBranch = result.byBranches.find(item => item.branch_name === branchName);
        if (existingBranch) {
          existingBranch.count += parseInt(stat.count);
        } else {
          result.byBranches.push({
            branch_name: branchName,
            count: parseInt(stat.count)
          });
        }
      }
    }

    // Статистика по маршрутам
    const routesQuery = `
      SELECT route as route_num, COUNT(*) as count 
      FROM ${this.CHECKS_TABLE} 
      WHERE 1=1 ${whereCondition} AND route IS NOT NULL AND route != ''
      GROUP BY route
    `;
    const routesStats = await analyticsQueryMany(routesQuery, params);
    
    for (const stat of routesStats) {
      const existing = result.byRoutes.find(item => item.route_num === stat.route_num);
      if (existing) {
        existing.count += parseInt(stat.count);
      } else {
        result.byRoutes.push({
          route_num: stat.route_num,
          count: parseInt(stat.count)
        });
      }
    }

    // Статистика по категориям через code_of_viol mapping
    const categoriesQuery = `
      SELECT cm.category, COUNT(*) as count 
      FROM ${this.CHECKS_TABLE} c
      LEFT JOIN checks_mapping cm ON c.code_of_viol = cm.code_of_viol
      WHERE 1=1 ${whereCondition} AND c.code_of_viol IS NOT NULL AND cm.category IS NOT NULL
      GROUP BY cm.category
    `;
    
    // Выполняем запрос к ANALYTICS_DB, но с JOIN к основной базе данных  
    // Нужно создать временное решение через отдельные запросы
    const checksWithCodes = await analyticsQueryMany(`
      SELECT code_of_viol, COUNT(*) as count 
      FROM ${this.CHECKS_TABLE} 
      WHERE 1=1 ${whereCondition} AND code_of_viol IS NOT NULL AND code_of_viol != ''
      GROUP BY code_of_viol
    `, params);
    
    // Получаем mapping из кэша (код -> категория)
    const categoryToCodeMap = await this.loadCategoriesMapping();
    const codeToCategory = new Map([...categoryToCodeMap.entries()].map(([category, code]) => [code, category]));
    
    // Объединяем данные
    const categoriesStats = checksWithCodes.map(item => ({
      category: codeToCategory.get(item.code_of_viol),
      count: parseInt(item.count)
    })).filter(item => item.category); // Убираем записи без категории
    
    for (const stat of categoriesStats) {
      const existing = result.byCategories.find(item => item.category === stat.category);
      if (existing) {
        existing.count += parseInt(stat.count);
      } else {
        result.byCategories.push({
          category: stat.category,
          count: parseInt(stat.count)
        });
      }
    }

    // Статистика по датам
    const dateQuery = `
      SELECT DATE(date_of_event) as date, COUNT(*) as count 
      FROM ${this.CHECKS_TABLE} 
      WHERE 1=1 ${whereCondition} AND date_of_event IS NOT NULL
      GROUP BY DATE(date_of_event)
    `;
    const dateStats = await analyticsQueryMany(dateQuery, params);
    
    for (const stat of dateStats) {
      if (stat.date) {
        const dateStr = new Date(stat.date).toISOString().split('T')[0];
        const existing = result.byDates.find(item => item.date === dateStr);
        if (existing) {
          existing.count += parseInt(stat.count);
        } else {
          result.byDates.push({
            date: dateStr,
            count: parseInt(stat.count)
          });
        }
      }
    }
  }

  // Построение WHERE условий для таблицы checks
  // Загрузка и кэширование mapping категорий
  private async loadCategoriesMapping(): Promise<Map<string, string>> {
    if (!this.categoriesMappingCache) {
      const mappings = await queryMany('SELECT code_of_viol, category FROM checks_mapping');
      console.log('Loading category mappings:', mappings);
      this.categoriesMappingCache = new Map(mappings.map(m => [m.category, m.code_of_viol]));
      console.log('Constructed cache entries:', [...this.categoriesMappingCache.entries()]);
    }
    return this.categoriesMappingCache;
  }

  private async buildChecksCondition(filters: StatisticsFilters): Promise<{ condition: string; params: any[] }> {
    let condition = '';
    const params: any[] = [];
    let paramIndex = 1;

    // Фильтр по датам 
    if (filters.dateFrom || filters.dateTo) {
      if (filters.dateFrom) {
        condition += ` AND date_of_event >= $${paramIndex}`;
        params.push(filters.dateFrom);
        paramIndex++;
      }
      if (filters.dateTo) {
        condition += ` AND date_of_event <= $${paramIndex}`;
        params.push(filters.dateTo);
        paramIndex++;
      }
    }

    // Фильтр по колоннам (включая фильтрацию по площадкам)
    if (filters.columns && filters.columns.length > 0) {
      // Получаем карту колонн к площадкам
      const columnBranches = await this.getColumnBranches();
      const columnBranchMap = new Map(columnBranches.map(cb => [cb.column_no, cb.branch_name]));
      
      // Разделяем колонны и площадки
      const columns = filters.columns.filter(c => typeof c === 'number') as number[];
      const branches = filters.columns.filter(c => typeof c === 'string') as string[];
      
      let allColumns: number[] = [...columns];
      
      // Добавляем колонны для площадок
      if (branches.length > 0) {
        const branchColumnMap = new Map<string, number[]>();
        columnBranchMap.forEach((branchName, columnNo) => {
          if (!branchColumnMap.has(branchName)) {
            branchColumnMap.set(branchName, []);
          }
          branchColumnMap.get(branchName)!.push(columnNo);
        });
        
        for (const branchName of branches) {
          const branchColumns = branchColumnMap.get(branchName) || [];
          allColumns.push(...branchColumns);
        }
      }
      
      // Убираем дубликаты
      allColumns = [...new Set(allColumns)];
      
      if (allColumns.length > 0) {
        const columnConditions = allColumns.map((columnNo) => 
          `column_num = 'Колонна № ${columnNo}'`
        ).join(' OR ');
        condition += ` AND (${columnConditions})`;
      }
    }

    // Фильтр по маршрутам
    if (filters.routes && filters.routes.length > 0) {
      const routePlaceholders = filters.routes.map(() => `$${paramIndex++}`).join(',');
      condition += ` AND route IN (${routePlaceholders})`;
      params.push(...filters.routes);
    }

    // Фильтр по категориям через code_of_viol mapping (используем кэш)
    if (filters.categories && filters.categories.length > 0) {
      // Используем кэшированный mapping
      const mappingCache = await this.loadCategoriesMapping();
      const codes: string[] = [];
      
      for (const category of filters.categories) {
        const code = mappingCache.get(category);
        if (code) {
          codes.push(code);
        }
      }
      
      if (codes.length > 0) {
        const codePlaceholders = codes.map(() => `$${paramIndex++}`).join(',');
        condition += ` AND code_of_viol IN (${codePlaceholders})`;
        params.push(...codes);
      } else {
        // If categories were requested but no mapping codes found, return no results
        // This prevents returning unfiltered data when specific categories are requested
        condition += ` AND 1=0`; // This will always return false, making the query return 0 results
      }
    }

    return { condition, params };
  }

  // Получение данных экспорта из таблицы checks
  private async getChecksExportData(filters: StatisticsFilters, result: ExportDataRow[]): Promise<void> {
    const { condition: whereCondition, params } = await this.buildChecksCondition(filters);

    const query = `
      SELECT 
        date_of_event as event_date,
        oper_analysis as complaint_text,
        route as route_num,
        CASE 
          WHEN column_num ~ '^Колонна № [0-9]+$' 
          THEN CAST(REGEXP_REPLACE(column_num, '[^0-9]', '', 'g') AS INTEGER)
          ELSE NULL
        END as column_no,
        code_of_viol,
        task_num_bitrix as bitrix_num
      FROM ${this.CHECKS_TABLE} 
      WHERE 1=1 ${whereCondition}
      ORDER BY date_of_event DESC
    `;

    const data = await analyticsQueryMany(query, params);
    
    // Получаем mapping для категорий из кэша
    const categoryToCodeMap = await this.loadCategoriesMapping();
    const codeToCategory = new Map([...categoryToCodeMap.entries()].map(([category, code]) => [code, category]));
    
    for (const row of data) {
      result.push({
        event_date: row.event_date ? new Date(row.event_date).toISOString().split('T')[0] : '',
        complaint_text: row.complaint_text || '',
        route_num: row.route_num || '',
        column_no: row.column_no || 0,
        category: codeToCategory.get(row.code_of_viol) || '',
        bitrix_num: row.bitrix_num || null,
        type: 'Проверка'
      });
    }
  }

  // Методы для работы с проверками (checks)
  
  // Получить маршруты для проверок из ANALYTICS_DB
  async getRoutesForChecks(types?: string[]): Promise<string[]> {
    if (!types || !types.includes('Проверки')) {
      return [];
    }
    
    try {
      return await this.analyticsService.getRoutesForChecks();
    } catch (error) {
      console.error('Ошибка получения маршрутов для проверок:', error);
      return [];
    }
  }

  // Получить колонны для проверок из ANALYTICS_DB
  async getColumnsForChecks(types?: string[]): Promise<Array<{column_no: number, branch_name?: string}>> {
    if (!types || !types.includes('Проверки')) {
      return [];
    }
    
    try {
      const checksColumns = await this.analyticsService.getColumnsForChecks();
      
      // Получаем карту колонн и филиалов из основной базы
      const columnBranches = await this.getColumnBranches();
      const columnBranchMap = new Map(columnBranches.map(cb => [cb.column_no, cb.branch_name]));
      
      return checksColumns.map(col => ({
        column_no: col.column_no!,
        branch_name: columnBranchMap.get(col.column_no!)
      }));
    } catch (error) {
      console.error('Ошибка получения колонн для проверок:', error);
      return [];
    }
  }

  // Объединить маршруты из жалоб и проверок
  async getCombinedRoutes(types?: string[], tables?: string[]): Promise<string[]> {
    const routes = new Set<string>();
    
    // Добавляем маршруты из обычных таблиц (жалобы)
    if (!types || types.includes('Жалобы')) {
      const complaintsRoutes = await this.getRoutes(tables);
      complaintsRoutes.forEach(route => routes.add(route));
    }
    
    // Добавляем маршруты из проверок
    if (!types || types.includes('Проверки')) {
      const checksRoutes = await this.getRoutesForChecks(types);
      checksRoutes.forEach(route => routes.add(route));
    }
    
    return Array.from(routes).sort();
  }

  // Объединить категории из жалоб и проверок  
  async getCombinedCategories(types?: string[], tables?: string[]): Promise<string[]> {
    const categories = new Set<string>();
    
    // Добавляем категории из обычных таблиц (жалобы)
    if (!types || types.includes('complaint')) {
      const complaintsCategories = await this.getCategories(tables);
      complaintsCategories.forEach(category => categories.add(category));
    }
    
    // Добавляем категории из проверок через mapping таблицу (из кэша)
    if (!types || types.includes('check')) {
      const categoryToCodeMap = await this.loadCategoriesMapping();
      for (const category of categoryToCodeMap.keys()) {
        if (category) {
          categories.add(category);
        }
      }
    }
    
    return Array.from(categories).sort();
  }
}