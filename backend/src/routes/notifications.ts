import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '../services/notification-service.js';

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const feed = await listNotifications(userId);
    return res.status(200).json(feed);
  } catch (err) {
    console.error('GET /api/notifications error:', err);
    return res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.post('/read-all', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const updated = await markAllNotificationsRead(userId);
    return res.status(200).json({ updated });
  } catch (err) {
    console.error('POST /api/notifications/read-all error:', err);
    return res.status(500).json({ error: 'Failed to mark notifications read' });
  }
});

router.post('/:id/read', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const id = parseInt(String(req.params.id), 10);
    if (Number.isNaN(id)) {
      return res.status(400).json({ error: 'id must be a valid integer' });
    }

    const notification = await markNotificationRead(userId, id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    return res.status(200).json(notification);
  } catch (err) {
    console.error('POST /api/notifications/:id/read error:', err);
    return res.status(500).json({ error: 'Failed to mark notification read' });
  }
});

export default router;
