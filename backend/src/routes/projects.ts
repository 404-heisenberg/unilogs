import { Router } from 'express';
import { authenticate } from '../middleware/authenticate.js';
import { prisma } from '../auth.js';

const router = Router();

router.post('/', authenticate, async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: 'Project name is required!' });
  }

  try {
    const project = await prisma.project.create({
      data: {
        name: name,
        userId: req.userId,
      },
    });

    return res.status(201).json(project);
  } catch {
    return res.status(500).json({ error: 'Failed to create project' });
  }
});

router.get('/', authenticate, async (req, res) => {
  try {
    const projects = await prisma.project.findMany({
      where: {
        userId: req.userId,
      },
    });

    return res.status(200).json(projects);
  } catch {
    return res.status(500).json({ error: 'Failed to fetch projects' });
  }
});

export default router;
