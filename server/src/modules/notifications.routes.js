import { Router } from 'express';
import { models } from '../config/database.js';
import { AppError, asyncHandler, ok } from '../lib/http.js';
import { requireAuth } from '../middleware/auth.js';

const router = Router();

router.use(requireAuth);

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const notifications = await models.Notification.findAll({
      where: { user_id: req.auth.userId },
      order: [['created_at', 'DESC']],
    });
    ok(res, notifications);
  }),
);

router.patch(
  '/read-all',
  asyncHandler(async (req, res) => {
    await models.Notification.update(
      { isRead: true },
      { where: { user_id: req.auth.userId, isRead: false } },
    );
    ok(res, { success: true });
  }),
);

router.patch(
  '/:notificationId/read',
  asyncHandler(async (req, res) => {
    const notification = await models.Notification.findOne({
      where: { id: req.params.notificationId, user_id: req.auth.userId },
    });

    if (!notification) {
      throw new AppError(404, 'NOTIFICATION_NOT_FOUND', 'Notification not found.');
    }

    notification.isRead = true;
    await notification.save();
    ok(res, notification);
  }),
);

export default router;
