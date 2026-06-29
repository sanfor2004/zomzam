import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { loadIdeasData, addIdeaRequest, updateIdeaRequest, deleteIdeaRequest } from './page.services';

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

test('loadIdeasData flattens horizons and returns ideas/tasks', async () => {
  payload = {
    success: true,
    ideas: [{ id: 1 }], tasks: [{ id: 2 }],
    horizons: { week: [{ id: 10 }], month: [{ id: 20 }], year: [] },
  };
  const { ideas, tasks, horizons } = await loadIdeasData();
  assert.equal(ideas.length, 1);
  assert.equal(tasks.length, 1);
  assert.deepEqual(horizons.map((h: any) => h.id), [10, 20]);
});

test('loadIdeasData returns empties on an unsuccessful payload', async () => {
  payload = { success: false };
  assert.deepEqual(await loadIdeasData(), { ideas: [], tasks: [], horizons: [] });
});

test('addIdeaRequest maps link ids to the api field names and returns the idea', async () => {
  payload = { success: true, idea: { id: 9 } };
  const idea = await addIdeaRequest({ content: 'hi', linkedTaskId: 3, linkedHorizonId: null });
  assert.deepEqual(bodies[0], { action: 'add_idea', content: 'hi', linked_task_id: 3, linked_horizon_id: null });
  assert.deepEqual(idea, { id: 9 });
});

test('addIdeaRequest returns null when the server rejects', async () => {
  payload = { success: false };
  assert.equal(await addIdeaRequest({ content: 'x', linkedTaskId: null, linkedHorizonId: null }), null);
});

test('updateIdeaRequest carries the id + update action and reports a boolean', async () => {
  payload = { success: true };
  assert.equal(await updateIdeaRequest(5, { content: 'y', linkedTaskId: null, linkedHorizonId: 7 }), true);
  assert.equal(bodies[0].action, 'update_idea');
  assert.equal(bodies[0].id, 5);
  assert.equal(bodies[0].linked_horizon_id, 7);
});

test('deleteIdeaRequest reports server success', async () => {
  payload = { success: false };
  assert.equal(await deleteIdeaRequest(1), false);
});
