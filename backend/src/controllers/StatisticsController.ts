import { Request, Response } from 'express';
import { StatisticsService, StatisticsFilters } from '../services/StatisticsService';
import { ActionLogService } from '../services/ActionLogService';
import { createError } from '../middleware/errorHandler';
import * as XLSX from 'xlsx';

export class StatisticsController {
  private statisticsService: StatisticsService;
  private actionLogService: ActionLogService;

  constructor() {
    this.statisticsService = new StatisticsService();
    this.actionLogService = new ActionLogService();
  }

  // Получение статистики
  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const filters: StatisticsFilters = {
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        columns: req.query.columns ? (req.query.columns as string).split(',').map(item => {
          const num = Number(item);
          return isNaN(num) ? item : num; // Если не число, возвращаем как строку (филиал)
        }) : undefined,
        branches: req.query.branches ? (req.query.branches as string).split(',') : undefined,
        routes: req.query.routes ? (req.query.routes as string).split(',') : undefined,
        categories: req.query.categories ? (req.query.categories as string).split(',') : undefined,
        tables: req.query.tables ? (req.query.tables as string).split(',') : undefined,
        types: req.query.types ? (req.query.types as string).split(',') : undefined,
      };

      const statistics = await this.statisticsService.getStatistics(filters);

      res.json({
        success: true,
        data: statistics,
        message: `Статистика получена. Всего записей: ${statistics.totalCount}`,
      });
    } catch (error) {
      console.error('Error getting statistics:', error);
      throw createError(500, 'Ошибка получения статистики');
    }
  }

  // Получение связи колонн и площадок
  async getColumnBranches(req: Request, res: Response): Promise<void> {
    try {
      const columnBranches = await this.statisticsService.getColumnBranches();

      res.json({
        success: true,
        data: columnBranches,
        message: `Найдено ${columnBranches.length} связей колонн и площадок`,
      });
    } catch (error) {
      console.error('Error getting column branches:', error);
      throw createError(500, 'Ошибка получения связей колонн и площадок');
    }
  }

  // Получение списка маршрутов (с учетом типов)
  async getRoutes(req: Request, res: Response): Promise<void> {
    try {
      const tables = req.query.tables ? (req.query.tables as string).split(',') : undefined;
      const types = req.query.types ? (req.query.types as string).split(',') : undefined;
      
      const routes = await this.statisticsService.getCombinedRoutes(types, tables);

      res.json({
        success: true,
        data: routes,
        message: `Найдено ${routes.length} маршрутов`,
      });
    } catch (error) {
      console.error('Error getting routes:', error);
      throw createError(500, 'Ошибка получения списка маршрутов');
    }
  }

  // Получение списка категорий (с учетом типов)
  async getStatisticsCategories(req: Request, res: Response): Promise<void> {
    try {
      const tables = req.query.tables ? (req.query.tables as string).split(',') : undefined;
      const types = req.query.types ? (req.query.types as string).split(',') : undefined;
      
      const categories = await this.statisticsService.getCombinedCategories(types, tables);

      res.json({
        success: true,
        data: categories,
        message: `Найдено ${categories.length} категорий`,
      });
    } catch (error) {
      console.error('Error getting statistics categories:', error);
      throw createError(500, 'Ошибка получения списка категорий');
    }
  }

  // Получение списка площадок
  async getBranches(req: Request, res: Response): Promise<void> {
    try {
      const branches = await this.statisticsService.getBranches();

      res.json({
        success: true,
        data: branches,
        message: `Найдено ${branches.length} площадок`,
      });
    } catch (error) {
      console.error('Error getting branches:', error);
      throw createError(500, 'Ошибка получения списка площадок');
    }
  }

  // Получение маршрутов по выбранным колоннам/площадкам (с учетом типов)
  async getRoutesByColumns(req: Request, res: Response): Promise<void> {
    try {
      const { columns, tables, types } = req.query;
      
      let parsedColumns: (number | string)[] | undefined;
      if (columns && typeof columns === 'string') {
        parsedColumns = columns.split(',').map(c => {
          const trimmed = c.trim();
          const num = parseInt(trimmed);
          return isNaN(num) ? trimmed : num;
        });
      }

      let parsedTables: string[] | undefined;
      if (tables && typeof tables === 'string') {
        parsedTables = tables.split(',').map(t => t.trim());
      }

      let parsedTypes: string[] | undefined;
      if (types && typeof types === 'string') {
        parsedTypes = types.split(',').map(t => t.trim());
      }

      const routes = parsedTypes 
        ? await this.statisticsService.getCombinedRoutes(parsedTypes, parsedTables)
        : await this.statisticsService.getRoutesByColumns(parsedColumns, parsedTables);

      res.json({
        success: true,
        data: routes,
        message: `Найдено ${routes.length} маршрутов`,
      });
    } catch (error) {
      console.error('Error getting routes by columns:', error);
      throw createError(500, 'Ошибка получения маршрутов по колоннам');
    }
  }

  // Экспорт данных в Excel
  async exportToExcel(req: Request, res: Response): Promise<void> {
    try {
      const filters: StatisticsFilters = {
        dateFrom: req.query.dateFrom as string,
        dateTo: req.query.dateTo as string,
        columns: req.query.columns ? (req.query.columns as string).split(',').map(item => {
          const num = Number(item);
          return isNaN(num) ? item : num;
        }) : undefined,
        branches: req.query.branches ? (req.query.branches as string).split(',') : undefined,
        routes: req.query.routes ? (req.query.routes as string).split(',') : undefined,
        categories: req.query.categories ? (req.query.categories as string).split(',') : undefined,
        tables: req.query.tables ? (req.query.tables as string).split(',') : undefined,
        types: req.query.types ? (req.query.types as string).split(',') : undefined,
      };

      const exportData = await this.statisticsService.getExportData(filters);

      // Формируем данные для Excel
      const worksheetData = exportData.map(row => ({
        'Дата события': row.event_date,
        'Тип': row.type,
        'Текст жалобы': row.complaint_text,
        'Маршрут': row.route_num,
        'Колонна': row.column_no,
        'Категория': row.category,
        'Номер задачи в Битрикс': row.bitrix_num || ''
      }));

      // Создаем рабочую книгу
      const workbook = XLSX.utils.book_new();
      const worksheet = XLSX.utils.json_to_sheet(worksheetData);
      
      // Устанавливаем ширину колонок
      const colWidths = [
        { wch: 12 }, // Дата события
        { wch: 10 }, // Тип
        { wch: 50 }, // Текст жалобы
        { wch: 10 }, // Маршрут
        { wch: 8 },  // Колонна
        { wch: 30 }, // Категория
        { wch: 15 }  // Номер задачи в Битрикс
      ];
      worksheet['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(workbook, worksheet, 'События');

      // Генерируем Excel файл
      const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });

      // Формируем имя файла с текущей датой
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const filename = `complaints_export_${dateStr}.xlsx`;

      // Устанавливаем заголовки для скачивания файла
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('Content-Length', buffer.length);

      // Логируем успешный экспорт
      await this.actionLogService.logStatisticsExport(
        filters,
        exportData.length,
        filename,
        req
      );

      // Отправляем файл
      res.send(buffer);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      throw createError(500, 'Ошибка экспорта данных в Excel');
    }
  }

}