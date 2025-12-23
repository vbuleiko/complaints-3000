import { Request, Response } from 'express';
import { ComplaintsService } from '../services/ComplaintsService';
import { ActionLogService } from '../services/ActionLogService';
import { createError } from '../middleware/errorHandler';

export class ComplaintsController {
  private complaintsService: ComplaintsService;
  private actionLogService: ActionLogService;

  constructor() {
    this.complaintsService = new ComplaintsService();
    this.actionLogService = new ActionLogService();
  }

  async getComplaints(req: Request, res: Response): Promise<void> {
    try {
      const { category, seen_status, report_type, search, date_from, date_to, damage_only, types, priority, status } = req.query;

      const filters = {
        category: category ? String(category).split(',') : undefined,
        seen_status: seen_status !== undefined && seen_status !== '' ?
          String(seen_status).split(',').map(s => parseInt(s.trim())).filter(s => !isNaN(s)) :
          undefined,
        report_type: report_type !== undefined && report_type !== '' ?
          String(report_type).split(',').map(t => parseInt(t.trim())).filter(t => !isNaN(t)) :
          [0], // По умолчанию "Не требуется"
        search: search ? String(search) : undefined,
        date_from: date_from ? String(date_from) : undefined,
        date_to: date_to ? String(date_to) : undefined,
        damage_only: damage_only === 'true',
        types: types ? String(types).split(',') : undefined,
        priority: priority !== undefined && priority !== '' ?
          String(priority).split(',').map(p => parseInt(p.trim())).filter(p => !isNaN(p)) :
          undefined,
        status: status !== undefined && status !== '' ?
          String(status).split(',').map(s => s.trim() === 'true') :
          undefined,
      };

      const complaints = await this.complaintsService.getComplaints(filters);

      res.json({
        success: true,
        data: complaints,
        message: `Найдено ${complaints.length} жалоб`,
      });
    } catch (error) {
      throw createError(500, 'Ошибка получения списка жалоб');
    }
  }

  async updateSeenStatus(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { seen, type } = req.body;

      if (![0, 1, 2].includes(seen)) {
        throw createError(400, 'Параметр seen должен быть 0, 1 или 2');
      }

      const complaintId = parseInt(id);

      // Получаем текущие данные для логирования
      const currentComplaint = await this.complaintsService.getComplaintById(complaintId, type);
      if (!currentComplaint) {
        throw createError(404, 'Запись не найдена');
      }

      // Обновляем статус
      await this.complaintsService.updateSeenStatus(complaintId, seen, type);

      const seenLabels = {
        0: 'Не требуется',
        1: 'Не принято',
        2: 'Принято'
      };

      // Определяем таблицу для логирования
      const tableName = type === 'Проверка' ? 'checks_list' : 'complaints_list';

      // Логируем изменение
      await this.actionLogService.logComplaintUpdate(
        complaintId,
        tableName,
        'seen',
        currentComplaint.seen,
        seen,
        req,
        this.actionLogService.createComplaintAdditionalData(currentComplaint)
      );

      res.json({
        success: true,
        message: `Статус изменен на "${seenLabels[seen as keyof typeof seenLabels]}"`,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('400')) {
        throw error;
      }
      throw createError(500, 'Ошибка обновления статуса просмотра');
    }
  }

  async updateReportType(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { report_type, type } = req.body;

      if (![0, 1, 2].includes(report_type)) {
        throw createError(400, 'Тип доклада должен быть 0, 1 или 2');
      }

      const complaintId = parseInt(id);

      // Получаем текущие данные для логирования
      const currentComplaint = await this.complaintsService.getComplaintById(complaintId, type);
      if (!currentComplaint) {
        throw createError(404, 'Запись не найдена');
      }

      // Автоматически обновляем seen с 0 на 1 при взаимодействии
      await this.complaintsService.autoUpdateSeenStatus(complaintId, type);

      // Обновляем тип доклада
      await this.complaintsService.updateReportType(complaintId, report_type, type);

      const typeNames = {
        0: 'Не требуется',
        1: 'Битрикс',
        2: 'Устно',
      };

      // Определяем таблицу для логирования
      const tableName = type === 'Проверка' ? 'checks_list' : 'complaints_list';

      // Логируем изменение
      await this.actionLogService.logComplaintUpdate(
        complaintId,
        tableName,
        'report_type',
        currentComplaint.report_type,
        report_type,
        req,
        this.actionLogService.createComplaintAdditionalData(currentComplaint, {
          old_type_label: this.actionLogService.getReportTypeLabel(currentComplaint.report_type),
          new_type_label: this.actionLogService.getReportTypeLabel(report_type)
        })
      );

      res.json({
        success: true,
        message: `Тип доклада изменен на "${typeNames[report_type as keyof typeof typeNames]}"`,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('400')) {
        throw error;
      }
      throw createError(500, 'Ошибка обновления типа доклада');
    }
  }

  async updatePriority(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { priority, type } = req.body;

      if (![0, 1, 2].includes(priority)) {
        throw createError(400, 'Приоритет должен быть 0, 1 или 2');
      }

      const complaintId = parseInt(id);

      // Получаем текущие данные для логирования
      const currentComplaint = await this.complaintsService.getComplaintById(complaintId, type);
      if (!currentComplaint) {
        throw createError(404, 'Запись не найдена');
      }

      // Автоматически обновляем seen с 0 на 1 при взаимодействии
      await this.complaintsService.autoUpdateSeenStatus(complaintId, type);

      // Обновляем приоритет
      await this.complaintsService.updatePriority(complaintId, priority, type);

      const priorityNames = {
        0: 'Низкий',
        1: 'Средний',
        2: 'Высокий',
      };

      // Определяем таблицу для логирования
      const tableName = type === 'Проверка' ? 'checks_list' : 'complaints_list';

      // Логируем изменение
      await this.actionLogService.logComplaintUpdate(
        complaintId,
        tableName,
        'priority',
        currentComplaint.priority,
        priority,
        req,
        this.actionLogService.createComplaintAdditionalData(currentComplaint, {
          old_priority_label: priorityNames[currentComplaint.priority as keyof typeof priorityNames],
          new_priority_label: priorityNames[priority as keyof typeof priorityNames]
        })
      );

      res.json({
        success: true,
        message: `Приоритет изменен на "${priorityNames[priority as keyof typeof priorityNames]}"`,
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('400')) {
        throw error;
      }
      throw createError(500, 'Ошибка обновления приоритета');
    }
  }

  async updateResolution(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;
      const { resolution_final, seen, type } = req.body;

      if (!resolution_final) {
        throw createError(400, 'Финальная резолюция обязательна для заполнения');
      }

      const complaintId = parseInt(id);

      // Получаем текущие данные для логирования
      const currentComplaint = await this.complaintsService.getComplaintById(complaintId, type);
      if (!currentComplaint) {
        throw createError(404, 'Запись не найдена');
      }

      // Автоматически обновляем seen с 0 на 1 при взаимодействии
      await this.complaintsService.autoUpdateSeenStatus(complaintId, type);

      const updateData = {
        resolution_final,
        seen: seen !== undefined ? seen : currentComplaint.seen, // Сохраняем текущий статус
      };

      // Обновляем резолюцию
      await this.complaintsService.updateResolution(complaintId, updateData, type);

      // Определяем таблицу для логирования
      const tableName = type === 'Проверка' ? 'checks_list' : 'complaints_list';
      
      // Логируем изменение резолюции
      await this.actionLogService.logComplaintUpdate(
        complaintId,
        tableName,
        'resolution_final',
        currentComplaint.resolution_final,
        resolution_final,
        req,
        this.actionLogService.createComplaintAdditionalData(currentComplaint, {
          resolution_length: resolution_final.length,
          also_updated_seen: updateData.seen !== currentComplaint.seen
        })
      );

      // Если также изменился статус просмотра, логируем и это изменение
      if (updateData.seen !== currentComplaint.seen) {
        await this.actionLogService.logComplaintUpdate(
          complaintId,
          tableName,
          'seen',
          currentComplaint.seen,
          updateData.seen,
          req,
          this.actionLogService.createComplaintAdditionalData(currentComplaint, {
            changed_with_resolution: true
          })
        );
      }

      res.json({
        success: true,
        message: 'Резолюция успешно обновлена',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('400')) {
        throw error;
      }
      throw createError(500, 'Ошибка обновления резолюции');
    }
  }

  async getResolutionTemplates(req: Request, res: Response): Promise<void> {
    try {
      const templates = await this.complaintsService.getResolutionTemplates();

      res.json({
        success: true,
        data: templates,
        message: `Найдено ${templates.length} шаблонов резолюций`,
      });
    } catch (error) {
      throw createError(500, 'Ошибка получения шаблонов резолюций');
    }
  }

  async addResolutionTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { value } = req.body;

      if (!value || typeof value !== 'string' || value.trim() === '') {
        throw createError(400, 'Значение шаблона обязательно для заполнения');
      }

      const template = await this.complaintsService.addResolutionTemplate(value.trim());

      res.json({
        success: true,
        data: template,
        message: 'Шаблон резолюции успешно добавлен',
      });
    } catch (error) {
      if (error instanceof Error && error.message.includes('400')) {
        throw error;
      }
      throw createError(500, 'Ошибка добавления шаблона резолюции');
    }
  }

  async deleteResolutionTemplate(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      await this.complaintsService.deleteResolutionTemplate(parseInt(id));

      res.json({
        success: true,
        message: 'Шаблон резолюции успешно удален',
      });
    } catch (error) {
      throw createError(500, 'Ошибка удаления шаблона резолюции');
    }
  }

  async getCategories(req: Request, res: Response): Promise<void> {
    try {
      const categories = await this.complaintsService.getCategories();

      res.json({
        success: true,
        data: categories,
        message: `Найдено ${categories.length} категорий`,
      });
    } catch (error) {
      throw createError(500, 'Ошибка получения категорий');
    }
  }

  async getStatistics(req: Request, res: Response): Promise<void> {
    try {
      const statistics = await this.complaintsService.getStatistics();

      res.json({
        success: true,
        data: statistics,
        message: 'Статистика успешно получена',
      });
    } catch (error) {
      throw createError(500, 'Ошибка получения статистики');
    }
  }
}