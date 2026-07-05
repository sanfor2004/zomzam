import { test, mock, before, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

const db = {
  execute: mock.fn(async (sql: string, params?: any[]) => ({ insertId: 1, affectedRows: 1 })),
  query: mock.fn(async (sql: string, params?: any[]) => []),
  queryOne: mock.fn(async (sql: string, params?: any[]) => ({ id: 99 })),
};
mock.module('@/lib/db', { namedExports: db });

const userModel = {
  getUserById: mock.fn(async (id: number) => ({ id: 43, username: 'otheruser' })),
  pushStreamOrder: mock.fn(async (userId: number, orderName: string, params: any, touchLastSeen: boolean) => true),
};
mock.module('@/lib/models/user', {
  namedExports: {
    getUserById: userModel.getUserById,
    pushStreamOrder: userModel.pushStreamOrder,
    computeOnlineFields: () => ({ is_online: false }),
    DEFAULT_AVATAR: '/default.png',
  }
});

const apiAuth = {
  withAuth: (handler: any) => async (req: any) => {
    // Provide a mocked user directly to the inner handler
    const user = { id: 42, username: 'testuser' };
    return handler(req, user, {});
  },
};
mock.module('@/lib/api-auth', { namedExports: apiAuth });

let messagesRoute: any;
before(async () => {
  messagesRoute = await import('./route');
});

beforeEach(() => {
  db.execute.mock.resetCalls();
  db.query.mock.resetCalls();
  db.queryOne.mock.resetCalls();
  userModel.pushStreamOrder.mock.resetCalls();
});

test('GET thread marks messages read and pushes message_read to sender when not peeking', async () => {
  const req = {
    url: 'http://localhost/api/messages?action=thread&user_id=43',
    method: 'GET',
  };
  
  db.queryOne.mock.mockImplementationOnce(async () => ({ id: 1 })); // conversation
  db.execute.mock.mockImplementationOnce(async () => ({ insertId: 0, affectedRows: 2 })); // 2 messages marked read
  
  await messagesRoute.GET(req as any);
  
  assert.equal(db.execute.mock.calls.length, 1);
  const updateSql = db.execute.mock.calls[0].arguments[0] as string;
  assert.match(updateSql, /UPDATE messages SET read_at = NOW()/);
  
  assert.equal(userModel.pushStreamOrder.mock.calls.length, 1);
  const [targetUserId, orderName, params, touchLastSeen] = userModel.pushStreamOrder.mock.calls[0].arguments;
  assert.equal(targetUserId, 43); // Notifying the sender
  assert.equal(orderName, 'message_read');
  assert.equal(params.conversation_id, 1);
  assert.equal(params.reader_id, 42);
  assert.equal(touchLastSeen, false);
});

test('GET thread with peek=1 does NOT mark messages read or push stream order', async () => {
  const req = {
    url: 'http://localhost/api/messages?action=thread&user_id=43&peek=1',
    method: 'GET',
  };
  
  db.queryOne.mock.mockImplementationOnce(async () => ({ id: 1 }));
  
  await messagesRoute.GET(req as any);
  
  assert.equal(db.execute.mock.calls.length, 0); // No updates
  assert.equal(userModel.pushStreamOrder.mock.calls.length, 0); // No live notifications
});
