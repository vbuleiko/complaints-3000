import { Router } from 'express';
import { StatisticsController } from '../controllers/StatisticsController';
import { asyncHandler } from '../middleware/errorHandler';

export const createStatisticsRoutes = (): Router => {
  const router = Router();
  const statisticsController = new StatisticsController();

  // Маршрут для получения статистики
  router.get('/statistics', asyncHandler(statisticsController.getStatistics.bind(statisticsController)));
  
  // Маршрут для получения связи колонн и площадок
  router.get('/statistics/column-branches', asyncHandler(statisticsController.getColumnBranches.bind(statisticsController)));
  
  // Маршрут для получения списка маршрутов
  router.get('/statistics/routes', asyncHandler(statisticsController.getRoutes.bind(statisticsController)));
  
  // Маршрут для получения списка категорий (для статистики)
  router.get('/statistics/categories', asyncHandler(statisticsController.getStatisticsCategories.bind(statisticsController)));
  
  // Маршрут для получения списка площадок
  router.get('/statistics/branches', asyncHandler(statisticsController.getBranches.bind(statisticsController)));

  // Маршрут для получения маршрутов по колоннам/площадкам
  router.get('/statistics/routes-by-columns', asyncHandler(statisticsController.getRoutesByColumns.bind(statisticsController)));

  // Маршрут для экспорта данных в Excel
  router.get('/statistics/export', asyncHandler(statisticsController.exportToExcel.bind(statisticsController)));

  return router;
};