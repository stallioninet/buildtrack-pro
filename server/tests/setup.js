import { app } from '../src/index.js';
import request from 'supertest';

// Helper to create an authenticated agent (persists cookies across requests)
export async function loginAs(email, password = 'password123') {
  const agent = request.agent(app);

  // Login — session.regenerate creates a new session ID, agent keeps the new cookie
  const loginRes = await agent
    .post('/api/auth/login')
    .send({ email, password });

  if (loginRes.status !== 200) {
    throw new Error(`Login failed: ${loginRes.status} - ${JSON.stringify(loginRes.body)}`);
  }

  // After login, fetch CSRF token from the new session
  const meRes = await agent.get('/api/auth/me');
  const csrfToken = meRes.body.csrfToken;

  // Return a wrapper that auto-adds CSRF token to mutation requests
  return {
    agent,
    user: loginRes.body.user,
    csrfToken,
    // Convenience methods that auto-set CSRF token
    post: (url) => agent.post(url).set('X-CSRF-Token', csrfToken || ''),
    patch: (url) => agent.patch(url).set('X-CSRF-Token', csrfToken || ''),
    del: (url) => agent.delete(url).set('X-CSRF-Token', csrfToken || ''),
    get: (url) => agent.get(url),
  };
}

export { app };
