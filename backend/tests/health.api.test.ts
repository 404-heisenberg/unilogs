import { describe, expect, it } from 'vitest';
import { getApiClient } from './helpers/api.js';

describe('GET /api/health', () => {
  it('reports ok when the database is reachable', async () => {
    const api = await getApiClient();

    const response = await api.get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual(expect.objectContaining({ status: 'ok', database: 'connected' }));
  });
});
