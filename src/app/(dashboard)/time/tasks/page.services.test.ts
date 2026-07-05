import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  loadTasks, addTaskRequest, updateTaskRequest, completeTaskRequest, deleteTaskRequest,
  parseQuickTask,
} from './page.services';

let bodies: any[] = [];
let payload: any = { success: true };

beforeEach(() => {
  bodies = [];
  payload = { success: true };
  globalThis.fetch = (async (_url: any, init: any) => {
    bodies.push(JSON.parse(init.body));
    return { json: async () => payload } as any;
  }) as any;
});

test('loadTasks flattens week/month/year horizons into one list', async () => {
  payload = {
    success: true,
    tasks: [{ id: 1 }],
    horizons: { week: [{ id: 10 }], month: [{ id: 20 }], year: [{ id: 30 }] },
  };
  const { tasks, horizons } = await loadTasks();
  assert.deepEqual(bodies[0], { action: 'load' });
  assert.equal(tasks.length, 1);
  assert.deepEqual(horizons.map((h: any) => h.id), [10, 20, 30]);
});

test('loadTasks returns empties on an unsuccessful payload', async () => {
  payload = { success: false };
  assert.deepEqual(await loadTasks(), { tasks: [], horizons: [] });
});

test('addTaskRequest maps duration→duration_block and a chosen horizon to an int', async () => {
  payload = { success: true, task: { id: 5 } };
  const task = await addTaskRequest({ title: 'x', priority: 'urgent', duration: 45, horizonId: '12' });
  assert.deepEqual(bodies[0], { action: 'add_task', title: 'x', priority: 'urgent', duration_block: 45, horizon_id: 12 });
  assert.deepEqual(task, { id: 5 });
});

test('addTaskRequest sends a null horizon when none is linked, and returns null when rejected', async () => {
  payload = { success: false };
  const task = await addTaskRequest({ title: 'x', priority: 'free', duration: 25, horizonId: '' });
  assert.equal(bodies[0].horizon_id, null);
  assert.equal(task, null);
});

test('updateTaskRequest carries the id + the update action', async () => {
  payload = { success: true, task: { id: 9 } };
  await updateTaskRequest(9, { title: 'y', priority: 'medium', duration: 30, horizonId: '3' });
  assert.equal(bodies[0].action, 'update_task');
  assert.equal(bodies[0].id, 9);
  assert.equal(bodies[0].horizon_id, 3);
});

test('completeTaskRequest / deleteTaskRequest report server success as a boolean', async () => {
  payload = { success: true };
  assert.equal(await completeTaskRequest(1), true);
  payload = { success: false };
  assert.equal(await deleteTaskRequest(1), false);
});

test('parseQuickTask pulls a priority word + duration token out of the title', () => {
  assert.deepEqual(parseQuickTask('email client urgent 45m'), { title: 'email client', priority: 'urgent', duration: 45 });
});

test('parseQuickTask defaults to medium/25 when no tokens are present', () => {
  assert.deepEqual(parseQuickTask('call mom'), { title: 'call mom', priority: 'medium', duration: 25 });
});

test('parseQuickTask reads hours and clamps to the 5–120 range', () => {
  assert.deepEqual(parseQuickTask('free 2h deep work'), { title: 'deep work', priority: 'free', duration: 120 });
});

test('parseQuickTask keeps the raw string as title when tokens strip it empty', () => {
  assert.deepEqual(parseQuickTask('45m'), { title: '45m', priority: 'medium', duration: 45 });
});

test('parseQuickTask lets the last priority word by position win', () => {
  assert.equal(parseQuickTask('urgent then free later').priority, 'free');
});
