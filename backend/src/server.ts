import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import { createComplaintRoutes } from './routes/complaints';
import { createStatisticsRoutes } from './routes/statistics';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

// Загружаем переменные окружения
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Настройка доверия прокси для работы с ngrok
app.set('trust proxy', true);

// Middleware для безопасности
app.use(helmet({
  crossOriginEmbedderPolicy: false,
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
}));

// Настройка CORS
app.use(cors({
  origin: [
    'http://localhost:3000',
    'http://localhost:3005',
    'https://colt-winning-caiman.ngrok-free.app',
    process.env.CORS_ORIGIN
  ].filter(Boolean), // Убираем undefined значения
  credentials: true,
  optionsSuccessStatus: 200,
}));

// Сжатие ответов
app.use(compression());

// Ограничение количества запросов
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 минут
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || (process.env.NODE_ENV === 'development' ? '1000' : '100')), // больше запросов для разработки
  message: {
    error: 'Слишком много запросов, попробуйте позже',
    success: false,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', limiter);

// Парсинг JSON
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Логирование запросов
app.use(requestLogger);

// Проверка здоровья приложения
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Сервер работает нормально',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// API маршруты
app.use('/api', createComplaintRoutes());
app.use('/api', createStatisticsRoutes());

// 404 обработчик
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Маршрут не найден',
    path: req.originalUrl,
  });
});

// Обработчик ошибок
app.use(errorHandler);

// Запуск сервера
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Сервер запущен на порту ${PORT}`);
  console.log(`📊 API доступен по адресу: http://localhost:${PORT}/api`);
  console.log(`🏥 Проверка здоровья: http://localhost:${PORT}/health`);
  console.log(`🌍 Окружение: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🌐 Доступен извне на всех интерфейсах: 0.0.0.0:${PORT}`);
});

// Обработка необработанных исключений
process.on('uncaughtException', (error) => {
  console.error('💥 Необработанное исключение:', error);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('💥 Необработанное отклонение промиса:', reason);
  console.error('На промисе:', promise);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 Получен сигнал SIGTERM, завершаем работу...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 Получен сигнал SIGINT, завершаем работу...');
  process.exit(0);
});

export default app;