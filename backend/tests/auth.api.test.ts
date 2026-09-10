import { afterAll, afterEach, describe, expect, it } from 'vitest';
import { randomUUID } from 'node:crypto';
import {
  createAuthenticatedUser,
  deleteTestUsers,
  disconnectTestDatabase,
  getApiClient,
} from './helpers/api.js';

afterEach(deleteTestUsers);
afterAll(disconnectTestDatabase);

const testEmailPrefix = 'test-api-';

function uniqueEmail() {
  return `${testEmailPrefix}${randomUUID()}@example.test`;
}

describe('auth routes', () => {
  describe('POST /api/auth/signup', () => {
    it('signs up a new user', async () => {
      const api = await getApiClient();
      const email = uniqueEmail();

      const response = await api.post('/api/auth/signup').send({
        email,
        password: 'test-password-123',
        name: 'Test User',
      });

      expect(response.status).toBeLessThan(400);
    });

    it('rejects duplicate email signup', async () => {
      const api = await getApiClient();
      const email = uniqueEmail();

      await api.post('/api/auth/signup').send({
        email,
        password: 'test-password-123',
        name: 'First User',
      });

      const duplicate = await api.post('/api/auth/signup').send({
        email,
        password: 'test-password-456',
        name: 'Second User',
      });

      expect(duplicate.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/auth/signin', () => {
    it('signs in with correct credentials and sets a session cookie', async () => {
      const api = await getApiClient();
      const email = uniqueEmail();
      const password = 'test-password-123';

      await api.post('/api/auth/signup').send({ email, password, name: 'Test User' });

      const response = await api.post('/api/auth/signin').send({ email, password });

      expect(response.status).toBe(200);
      expect(response.headers['set-cookie']).toBeDefined();
    });

    it('rejects signin with wrong password', async () => {
      const api = await getApiClient();
      const email = uniqueEmail();

      await api.post('/api/auth/signup').send({
        email,
        password: 'test-password-123',
        name: 'Test User',
      });

      const response = await api.post('/api/auth/signin').send({
        email,
        password: 'wrong-password',
      });

      expect(response.status).toBeGreaterThanOrEqual(400);
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('returns a reset token for an existing user', async () => {
      const api = await getApiClient();
      const email = uniqueEmail();

      await api.post('/api/auth/signup').send({
        email,
        password: 'test-password-123',
        name: 'Test User',
      });

      const response = await api.post('/api/auth/forgot-password').send({ email });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
      expect(typeof response.body.token).toBe('string');
    });

    it('returns 400 for a non-existent user', async () => {
      const api = await getApiClient();

      const response = await api
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@example.test' });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('resets the password with a valid token', async () => {
      const api = await getApiClient();
      const email = uniqueEmail();
      const password = 'test-password-123';

      await api.post('/api/auth/signup').send({ email, password, name: 'Test User' });

      const forgot = await api.post('/api/auth/forgot-password').send({ email });
      expect(forgot.status).toBe(200);
      const token = forgot.body.token;
      expect(typeof token).toBe('string');

      const reset = await api
        .post('/api/auth/reset-password')
        .send({ token, newPassword: 'new-password-456' });
      expect(reset.status).toBe(200);
      expect(reset.body).toEqual({ message: 'Password reset successfully' });
    });

    it('rejects an invalid token', async () => {
      const api = await getApiClient();

      const response = await api
        .post('/api/auth/reset-password')
        .send({ token: 'invalid-token', newPassword: 'new-password-456' });

      expect(response.status).toBe(400);
      expect(response.body).toEqual({ error: 'Invalid or expired token' });
    });

    it('rejects missing token or password', async () => {
      const api = await getApiClient();

      const responses = await Promise.all([
        api.post('/api/auth/reset-password').send({ newPassword: 'new-password-456' }),
        api.post('/api/auth/reset-password').send({ token: 'some-token' }),
        api.post('/api/auth/reset-password').send({}),
      ]);

      for (const response of responses) {
        expect(response.status).toBe(400);
      }
    });
  });

  describe('DELETE /api/auth/account', () => {
    it('deletes the authenticated user account', async () => {
      const { agent, password } = await createAuthenticatedUser();

      const response = await agent.delete('/api/auth/account').send({ password });

      expect(response.status).toBe(200);
      expect(response.body).toEqual({ message: 'Account deleted successfully' });
    });

    it('rejects account deletion without a password', async () => {
      const { agent } = await createAuthenticatedUser();

      const response = await agent.delete('/api/auth/account').send({});

      expect(response.status).toBe(400);
      expect(response.body).toEqual({
        error: 'Password is required to delete your account',
      });
    });
  });
});
