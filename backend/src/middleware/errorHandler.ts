import { Request, Response, NextFunction } from 'express';

export interface ApiError extends Error {
  statusCode?: number;
  code?: string;
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Внутренняя ошибка сервера';

  // PostgreSQL ошибки
  if (err.code) {
    switch (err.code) {
      case '23505': // unique_violation
        statusCode = 409;
        message = 'Запись уже существует';
        break;
      case '23503': // foreign_key_violation
        statusCode = 400;
        message = 'Нарушение связности данных';
        break;
      case '23502': // not_null_violation
        statusCode = 400;
        message = 'Обязательное поле не заполнено';
        break;
      case '42P01': // undefined_table
        statusCode = 500;
        message = 'Ошибка структуры базы данных';
        break;
      case '42703': // undefined_column
        statusCode = 500;
        message = 'Ошибка структуры базы данных';
        break;
      case 'ECONNREFUSED':
        statusCode = 503;
        message = 'База данных недоступна';
        break;
      case 'ETIMEDOUT':
        statusCode = 504;
        message = 'Превышено время ожидания базы данных';
        break;
    }
  }

  // Логируем ошибку
  console.error(`💥 Ошибка API [${statusCode}]:`, {
    message: err.message,
    code: err.code,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
    url: req.url,
    method: req.method,
    ip: req.ip,
    userAgent: req.get('User-Agent'),
  });

  // Отправляем ответ клиенту
  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && {
      error: {
        code: err.code,
        stack: err.stack,
      },
    }),
  });
};

export const asyncHandler = (fn: Function) => (req: Request, res: Response, next: NextFunction) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};

export const createError = (statusCode: number, message: string, code?: string): ApiError => {
  const error = new Error(message) as ApiError;
  error.statusCode = statusCode;
  error.code = code;
  return error;
};