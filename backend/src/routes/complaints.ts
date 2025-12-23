import { Router } from 'express';
import { ComplaintsController } from '../controllers/ComplaintsController';
import { asyncHandler } from '../middleware/errorHandler';

export const createComplaintRoutes = (): Router => {
  const router = Router();
  const complaintsController = new ComplaintsController();

  // Маршруты для жалоб
  router.get('/complaints', asyncHandler(complaintsController.getComplaints.bind(complaintsController)));
  router.patch('/complaints/:id/seen', asyncHandler(complaintsController.updateSeenStatus.bind(complaintsController)));
  router.patch('/complaints/:id/report-type', asyncHandler(complaintsController.updateReportType.bind(complaintsController)));
  router.patch('/complaints/:id/priority', asyncHandler(complaintsController.updatePriority.bind(complaintsController)));
  router.patch('/complaints/:id/resolution', asyncHandler(complaintsController.updateResolution.bind(complaintsController)));

  // Маршруты для шаблонов резолюций
  router.get('/resolution-templates', asyncHandler(complaintsController.getResolutionTemplates.bind(complaintsController)));
  router.post('/resolution-templates', asyncHandler(complaintsController.addResolutionTemplate.bind(complaintsController)));
  router.delete('/resolution-templates/:id', asyncHandler(complaintsController.deleteResolutionTemplate.bind(complaintsController)));

  // Маршруты для категорий
  router.get('/categories', asyncHandler(complaintsController.getCategories.bind(complaintsController)));


  return router;
};