import { Router } from 'express';
import type { Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../auth.js';
import { Prisma } from '../generated/prisma/client.js';

// The dashboard layout, stored on the user so it follows them across
// devices. The frontend owns which widgets exist, so the server checks the
// shape and nothing more: an unknown built-in id is the frontend's to drop.

const router = Router();

const MAX_WIDGETS = 100;
// A built-in widget name (`summary`, `whatsLeft`) or a saved panel.
const WIDGET_ID = /^(?:[a-zA-Z]{1,40}|statPanel:\d{1,10})$/;

type WidgetState = { id: string; visible: boolean; size: 'standard' | 'wide' };

/** The layout, or an error message for a 400. */
function parseLayout(raw: unknown): WidgetState[] | string {
  if (!Array.isArray(raw)) return 'layout must be an array';
  if (raw.length > MAX_WIDGETS) return `layout can hold at most ${MAX_WIDGETS} widgets`;

  const seen = new Set<string>();
  const layout: WidgetState[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return 'each widget must be an object';
    const { id, visible, size } = item as Record<string, unknown>;
    if (typeof id !== 'string' || !WIDGET_ID.test(id)) return 'each widget needs a valid id';
    if (seen.has(id)) return `widget ${id} appears more than once`;
    if (typeof visible !== 'boolean') return 'visible must be true or false';
    if (size !== 'standard' && size !== 'wide') return 'size must be standard or wide';
    seen.add(id);
    // Rebuilt rather than stored as sent, so stray keys never reach the database.
    layout.push({ id, visible, size });
  }
  return layout;
}

router.get('/layout', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { dashboardLayout: true },
    });
    if (!user) return res.status(404).json({ error: 'User not found' });

    // null means "never saved", which the frontend treats as the default
    // layout - and as the moment to promote any layout kept in the browser.
    return res.status(200).json({ layout: user.dashboardLayout ?? null });
  } catch (err) {
    console.error('GET /api/dashboard/layout error:', err);
    return res.status(500).json({ error: 'Failed to fetch dashboard layout' });
  }
});

router.put('/layout', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = req.userId;
    if (!userId) return res.status(401).json({ error: 'Unauthorized' });

    const layout = parseLayout(req.body?.layout);
    if (typeof layout === 'string') return res.status(400).json({ error: layout });

    await prisma.user.update({
      where: { id: userId },
      data: { dashboardLayout: layout as unknown as Prisma.InputJsonArray },
    });

    return res.status(200).json({ layout });
  } catch (err) {
    console.error('PUT /api/dashboard/layout error:', err);
    return res.status(500).json({ error: 'Failed to save dashboard layout' });
  }
});

export default router;
