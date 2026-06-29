import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { getLeadsRequest, deleteLeadsBatchRequest, addLeadRequest, type NewLeadData } from './page.services';

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

const blankLead: NewLeadData = {
  name: 'X', email: '', phone: '', website: '', address: '',
  company: '', industry: '', notes: '', status: 'new', source: 'Manual Import',
};

test('getLeadsRequest returns success + leads', async () => {
  payload = { success: true, leads: [{ id: 1 }] };
  assert.deepEqual(await getLeadsRequest(), { success: true, leads: [{ id: 1 }] });
  assert.deepEqual(bodies[0], { action: 'get_leads' });
});

test('getLeadsRequest reports failure so the page keeps its current list', async () => {
  payload = { success: false };
  const r = await getLeadsRequest();
  assert.equal(r.success, false);
  assert.deepEqual(r.leads, []);
});

test('deleteLeadsBatchRequest sends the id array and passes the error through', async () => {
  payload = { success: false, error: 'denied' };
  const r = await deleteLeadsBatchRequest([1, 2, 3]);
  assert.deepEqual(bodies[0], { action: 'delete_leads_batch', ids: [1, 2, 3] });
  assert.equal(r.success, false);
  assert.equal(r.error, 'denied');
});

test('addLeadRequest wraps the lead payload and reports a boolean', async () => {
  payload = { success: true };
  assert.equal(await addLeadRequest(blankLead), true);
  assert.equal(bodies[0].action, 'add_lead');
  assert.equal(bodies[0].lead.name, 'X');
});
