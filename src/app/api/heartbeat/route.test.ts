import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const db = {
  queryOne: mock.fn(async (sql: string, params?: any[]) => null),
  execute: mock.fn(async (sql: string, params?: any[]) => ({ insertId: 1, affectedRows: 1 })),
  query: mock.fn(async (sql: string, params?: any[]) => []),
};
mock.module('@/lib/db', { namedExports: db });

const userModel = {
  updateOnlineStatus: mock.fn(async (userId: number, isIdle: number) => true),
  getNotifications: mock.fn(async (userId: number): Promise<any[]> => []),
};
mock.module('@/lib/models/user', {
  namedExports: {
    updateOnlineStatus: userModel.updateOnlineStatus,
    getNotifications: userModel.getNotifications,
  }
});

// withAuth gates the route and injects the verified session user as the 2nd
// arg — the mock skips the gate and hands the handler a fixed test user.
const apiAuth = {
  withAuth: (fn: any) => (req: any) => fn(req, { id: 42, username: 'testuser' }),
};
mock.module('@/lib/api-auth', { namedExports: apiAuth });

const liveSync = {
  drainLiveSync: mock.fn(async () => ({ messages: [], notifications: [], posts: [], social: [] })),
};
mock.module('@/lib/live-sync', { namedExports: liveSync });

const rateLimit = {
  rateLimit: mock.fn(async () => true),
};
mock.module('@/lib/rate-limit', { namedExports: rateLimit });

let heartbeatRoute: any;
before(async () => {
  heartbeatRoute = await import('./route');
});

beforeEach(() => {
  userModel.updateOnlineStatus.mock.resetCalls();
  userModel.getNotifications.mock.resetCalls();
  liveSync.drainLiveSync.mock.resetCalls();
  rateLimit.rateLimit.mock.resetCalls();
});

test('heartbeat marks user IDLE when init is false', async () => {
  const req = {
    json: async () => ({ init: false }),
    url: 'http://localhost/api/heartbeat',
  };
  
  await heartbeatRoute.POST(req as any);
  
  assert.equal(userModel.updateOnlineStatus.mock.calls.length, 1);
  const [userId, isIdle] = userModel.updateOnlineStatus.mock.calls[0].arguments;
  assert.equal(userId, 42);
  assert.equal(isIdle, 1); // 1 = idle
});

test('bootstrap heartbeat (init: true) marks user ACTIVE', async () => {
  const req = {
    json: async () => ({ init: true }),
    url: 'http://localhost/api/heartbeat',
  };
  
  await heartbeatRoute.POST(req as any);
  
  assert.equal(userModel.updateOnlineStatus.mock.calls.length, 1);
  const [userId, isIdle] = userModel.updateOnlineStatus.mock.calls[0].arguments;
  assert.equal(userId, 42);
  assert.equal(isIdle, 0); // 0 = active
});

test('bootstrap heartbeat returns notification bootstrap payload', async () => {
  userModel.getNotifications.mock.mockImplementationOnce(async () => [{ id: 1, is_read: 0 }, { id: 2, is_read: 1 }]);
  const req = {
    json: async () => ({ init: true }),
    url: 'http://localhost/api/heartbeat',
  };
  
  const response = await heartbeatRoute.POST(req as any);
  const json = await response.json();
  
  assert.equal(userModel.getNotifications.mock.calls.length, 1);
  assert.ok(json.data.notifications_bootstrap);
  assert.equal(json.data.notifications_bootstrap.count, 1); // Only 1 unread
  assert.equal(json.data.notifications_bootstrap.items.length, 2);
});
