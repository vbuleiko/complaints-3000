import { Request, Response, NextFunction } from 'express';

export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const start = Date.now();
  
  // Логируем входящий запрос
  console.log(`🔄 ${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    contentLength: req.get('Content-Length'),
    timestamp: new Date().toISOString(),
  });

  // Перехватываем окончание ответа
  const originalSend = res.send;
  res.send = function(body: any) {
    const duration = Date.now() - start;
    
    // Логируем ответ
    console.log(`✅ ${req.method} ${req.url} - ${res.statusCode}`, {
      duration: `${duration}ms`,
      responseSize: Buffer.byteLength(body || '', 'utf8'),
      timestamp: new Date().toISOString(),
    });
    
    return originalSend.call(this, body);
  };

  next();
};