import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, loginAs } from './setup.js';

describe('Auth API', () => {
  describe('POST /api/auth/login', () => {
    it('should login with valid credentials', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pm@buildtrack.com', password: 'password123' });

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.user.email).toBe('pm@buildtrack.com');
      expect(res.body.user.role).toBe('pm');
      expect(res.body.user.password_hash).toBeUndefined();
    });

    it('should reject invalid password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pm@buildtrack.com', password: 'wrongpassword' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Invalid email or password');
    });

    it('should reject non-existent email', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'nobody@example.com', password: 'password123' });

      expect(res.status).toBe(401);
    });

    it('should reject missing fields', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'pm@buildtrack.com' });

      expect(res.status).toBe(400);
    });

    it('should reject invalid email format', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({ email: 'notanemail', password: 'password123' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 for unauthenticated request', async () => {
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('should return user and CSRF token when authenticated', async () => {
      const session = await loginAs('pm@buildtrack.com');
      const res = await session.get('/api/auth/me');

      expect(res.status).toBe(200);
      expect(res.body.user).toBeDefined();
      expect(res.body.csrfToken).toBeDefined();
      expect(typeof res.body.csrfToken).toBe('string');
      expect(res.body.csrfToken.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('should logout successfully', async () => {
      const session = await loginAs('pm@buildtrack.com');
      const res = await session.post('/api/auth/logout').send();

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Logged out');

      // Verify session is destroyed
      const meRes = await session.get('/api/auth/me');
      expect(meRes.status).toBe(401);
    });
  });

  describe('POST /api/auth/change-password', () => {
    it('should reject incorrect current password', async () => {
      const session = await loginAs('engineer@buildtrack.com');
      const res = await session.post('/api/auth/change-password')
        .send({ current_password: 'wrongpass', new_password: 'newpassword123' });

      expect(res.status).toBe(401);
      expect(res.body.error).toBe('Current password is incorrect');
    });

    it('should reject short new password', async () => {
      const session = await loginAs('engineer@buildtrack.com');
      const res = await session.post('/api/auth/change-password')
        .send({ current_password: 'password123', new_password: 'short' });

      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Validation failed');
    });
  });
});

describe('CSRF Protection', () => {
  it('should reject POST without CSRF token', async () => {
    // Login first (without the helper, so we don't auto-set CSRF)
    const agent = request.agent(app);
    await agent.post('/api/auth/login').send({ email: 'pm@buildtrack.com', password: 'password123' });

    // Try to create a comment without CSRF token
    const res = await agent
      .post('/api/comments')
      .send({ content: 'test', entity_type: 'task', entity_id: 1 });

    expect(res.status).toBe(403);
    expect(res.body.error).toBe('Invalid or missing CSRF token');
  });

  it('should allow POST with valid CSRF token', async () => {
    const session = await loginAs('pm@buildtrack.com');

    const res = await session.post('/api/comments')
      .send({ content: 'test comment from CSRF test', entity_type: 'task', entity_id: 1 });

    expect(res.status).toBe(201);
  });
});

describe('Rate Limiting', () => {
  it('should include rate limit headers', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pm@buildtrack.com', password: 'password123' });

    expect(res.headers['ratelimit-limit']).toBeDefined();
    expect(res.headers['ratelimit-remaining']).toBeDefined();
  });
});

describe('Input Validation', () => {
  it('should reject login with password too short', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'pm@buildtrack.com', password: '12345' });

    expect(res.status).toBe(400);
    expect(res.body.details).toBeDefined();
    expect(res.body.details[0].field).toBe('password');
  });

  it('should reject registration with invalid email', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'not-email', password: 'password123', name: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });

  it('should reject team member with invalid role', async () => {
    const session = await loginAs('owner@buildtrack.com');
    const res = await session.post('/api/auth/team')
      .send({ email: 'test@test.com', password: 'password123', name: 'Test', role: 'superadmin' });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation failed');
  });
});

describe('Security Headers', () => {
  it('should include security headers', async () => {
    const res = await request(app).get('/api/health');

    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['x-xss-protection']).toBe('1; mode=block');
  });
});
