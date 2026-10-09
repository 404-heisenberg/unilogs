import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { listPanelsForUser } from '../services/stat-panel-service.js';

// Every saved panel across the user's projects, for the global dashboard.
// Creating and editing panels stays under /api/projects/:id/stat-panels.

const router = Router();

router.get('/', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    return res.status(200).json(await listPanelsForUser(userId));
  } catch (err) {
    console.error('GET /api/stat-panels error:', err);
    return res.status(500).json({ error: 'Failed to fetch panels' });
  }
});

export default router;
