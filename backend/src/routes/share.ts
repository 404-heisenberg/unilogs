import { Router } from 'express';
import { buildShareReport, verifyShareToken } from '../services/share-services.js';
import { buildCsv, buildMarkdown } from '../services/export-service.js';
import { shareRateLimit } from '../middleware/shareRateLimit.js';

const router = Router();

// One shape for every dead token - unknown, revoked and expired are
// indistinguishable, so the response never confirms a token once existed.
const NOT_FOUND = { error: 'Share link not found' };

function parseTagIds(value: unknown): number[] | undefined {
  if (typeof value !== 'string' || value.trim() === '') {
    return undefined;
  }

  const ids = value
    .split(',')
    .map((part) => Number(part.trim()))
    .filter((id) => Number.isInteger(id) && id > 0);

  return ids.length > 0 ? ids : undefined;
}

function sanitiseName(name: string): string {
  return name.replace(/[^a-zA-Z0-9-_]/g, '-');
}

router.get('/:token', shareRateLimit, async (req, res) => {
  try {
    const share = await verifyShareToken(String(req.params.token));
    if (!share) {
      return res.status(404).json(NOT_FOUND);
    }

    const report = await buildShareReport(share, { tagIds: parseTagIds(req.query.tagIds) });
    if (!report) {
      return res.status(404).json(NOT_FOUND);
    }

    return res.status(200).json(report);
  } catch (err) {
    console.error('GET /share/:token error:', err);
    return res.status(500).json({ error: 'Failed to load shared report' });
  }
});

router.get('/:token/export', shareRateLimit, async (req, res) => {
  try {
    const share = await verifyShareToken(String(req.params.token));
    if (!share) {
      return res.status(404).json(NOT_FOUND);
    }

    const format = req.query.format;
    if (format !== 'csv' && format !== 'md') {
      return res.status(400).json({ error: 'format must be csv or md' });
    }

    // No range/body overrides here: the token owns both, so the request cannot
    // widen what the link exposes. buildShareReport already strips bodies when
    // the token says so, and buildCsv/buildMarkdown key off the body property.
    const report = await buildShareReport(share);
    if (!report) {
      return res.status(404).json(NOT_FOUND);
    }

    const range = `${report.dateFrom.slice(0, 10)}-to-${report.dateTo.slice(0, 10)}`;
    const filename = `unilogs-${sanitiseName(report.project.name)}-${range}`;

    if (format === 'csv') {
      res.type('text/csv');
      res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
      return res.send(buildCsv(report.entries, report.fields));
    }

    res.type('text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.md"`);
    return res.send(buildMarkdown(report.entries, report.fields, report.project, range));
  } catch (err) {
    console.error('GET /share/:token/export error:', err);
    return res.status(500).json({ error: 'Failed to export shared report' });
  }
});

export default router;
