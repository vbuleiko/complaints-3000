import { queryOne } from '../config/database';
import { Request } from 'express';

export interface ActionLogData {
  user_id?: string;
  user_session?: string;
  action_type: 'update_complaint' | 'export_statistics';
  action_subtype?: 'resolution' | 'seen_status' | 'report_type' | 'excel_download';
  complaint_id?: number;
  table_name?: string;
  field_name?: string;
  old_value?: string;
  new_value?: string;
  additional_data?: any;
  ip_address?: string;
  user_agent?: string;
}

export class ActionLogService {
  
  /**
   * Основной метод для логирования действий пользователей
   */
  async logAction(data: ActionLogData): Promise<void> {
    try {
      const query = `
        INSERT INTO user_action_logs (
          user_id, user_session, action_type, action_subtype, 
          complaint_id, table_name, field_name, old_value, new_value,
          additional_data, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `;

      const params = [
        data.user_id || null,
        data.user_session || null,
        data.action_type,
        data.action_subtype || null,
        data.complaint_id || null,
        data.table_name || null,
        data.field_name || null,
        data.old_value || null,
        data.new_value || null,
        data.additional_data ? JSON.stringify(data.additional_data) : null,
        data.ip_address || null,
        data.user_agent || null
      ];

      await queryOne(query, params);
    } catch (error) {
      console.error('Ошибка записи лога действия:', error);
      // Не прерываем основную операцию при ошибке логирования
    }
  }

  /**
   * Логирование изменений в жалобах
   */
  async logComplaintUpdate(
    complaintId: number,
    tableName: string,
    fieldName: string,
    oldValue: any,
    newValue: any,
    req?: Request,
    additionalData?: any
  ): Promise<void> {
    const actionSubtype = this.getActionSubtype(fieldName);
    
    const logData: ActionLogData = {
      user_id: this.extractUserId(req),
      user_session: this.extractSessionId(req),
      action_type: 'update_complaint',
      action_subtype: actionSubtype,
      complaint_id: complaintId,
      table_name: tableName,
      field_name: fieldName,
      old_value: this.valueToString(oldValue),
      new_value: this.valueToString(newValue),
      additional_data: additionalData,
      ip_address: this.extractIpAddress(req),
      user_agent: this.extractUserAgent(req)
    };

    await this.logAction(logData);
  }

  /**
   * Логирование экспорта статистики
   */
  async logStatisticsExport(
    filters: any,
    exportCount: number,
    filename: string,
    req?: Request
  ): Promise<void> {
    const logData: ActionLogData = {
      user_id: this.extractUserId(req),
      user_session: this.extractSessionId(req),
      action_type: 'export_statistics',
      action_subtype: 'excel_download',
      additional_data: {
        filters,
        export_count: exportCount,
        filename
      },
      ip_address: this.extractIpAddress(req),
      user_agent: this.extractUserAgent(req)
    };

    await this.logAction(logData);
  }

  /**
   * Определяет подтип действия на основе названия поля
   */
  private getActionSubtype(fieldName: string): 'resolution' | 'seen_status' | 'report_type' | undefined {
    switch (fieldName) {
      case 'resolution_text':
      case 'resolution_final':
      case 'add_comment':
        return 'resolution';
      case 'seen':
        return 'seen_status';
      case 'report_type':
        return 'report_type';
      default:
        return undefined;
    }
  }

  /**
   * Извлекает ID пользователя из запроса (можно адаптировать под вашу систему аутентификации)
   */
  private extractUserId(req?: Request): string | undefined {
    if (!req) return undefined;
    
    // Пока используем IP как идентификатор пользователя
    // В будущем можно заменить на настоящий user ID из сессии/токена
    return this.extractIpAddress(req);
  }

  /**
   * Извлекает ID сессии из запроса
   */
  private extractSessionId(req?: Request): string | undefined {
    if (!req) return undefined;
    
    // Можно использовать session ID из express-session или создать собственный
    return req.sessionID || req.headers['x-session-id'] as string;
  }

  /**
   * Извлекает IP адрес из запроса
   */
  private extractIpAddress(req?: Request): string | undefined {
    if (!req) return undefined;
    
    return (
      req.headers['x-forwarded-for'] as string ||
      req.headers['x-real-ip'] as string ||
      req.connection?.remoteAddress ||
      req.socket?.remoteAddress ||
      req.ip
    )?.split(',')[0]?.trim();
  }

  /**
   * Извлекает User-Agent из запроса
   */
  private extractUserAgent(req?: Request): string | undefined {
    return req?.headers['user-agent'];
  }

  /**
   * Конвертирует значение в строку для логирования
   */
  private valueToString(value: any): string | undefined {
    if (value === null || value === undefined) {
      return undefined;
    }
    
    if (typeof value === 'boolean') {
      return value.toString();
    }
    
    if (typeof value === 'object') {
      return JSON.stringify(value);
    }
    
    return String(value);
  }

  /**
   * Создает дополнительные данные для логирования изменений жалобы
   */
  createComplaintAdditionalData(complaint: any, changes: any = {}): any {
    return {
      bitrix_num: complaint?.bitrix_num,
      vkh_num: complaint?.vkh_num,
      message_text_preview: complaint?.message_text?.substring(0, 100),
      changes,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Получает человекочитаемое название для типа доклада
   */
  getReportTypeLabel(reportType: number): string {
    switch (reportType) {
      case 0: return 'Не требуется';
      case 1: return 'Битрикс';
      case 2: return 'Устно';
      default: return 'Неизвестно';
    }
  }
}