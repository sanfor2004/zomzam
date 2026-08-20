import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  fetchUserPrefs, savePreferences, fetchNotionSettings,
  saveNotionSettings, syncNotion, changePassword, deleteAccount, formatLiveClock,
} from './page.services';

let lastUrl: any;
let lastInit: any;
let payload: any;

beforeEach(() => {
  lastUrl = undefined;
  lastInit = undefined;
  payload = { success: true };
  globalThis.fetch = (async (url: any, init: any) => {
    lastUrl = url;
    lastInit = init;
    return { json: async () => payload } as any;
  }) as any;
});

const body = () => JSON.parse(lastInit.body);

test('fetchUserPrefs normalizes fields with defaults', async () => {
  payload = { success: true, authenticated: true, user: { timezone: 'Asia/Dubai', notifications_enabled: 1 } };
  const p = await fetchUserPrefs();
  assert.equal(p?.timezone, 'Asia/Dubai');
  assert.equal(p?.primaryCurrency, 'EGP'); // missing → default
  assert.equal(p?.notificationsEnabled, true);
});

test('fetchUserPrefs returns null when not authenticated', async () => {
  payload = { success: true, authenticated: false };
  assert.equal(await fetchUserPrefs(), null);
});

test('savePreferences maps camelCase input to the snake_case API body', async () => {
  await savePreferences({ timezone: 'UTC', notificationsEnabled: true, primaryCurrency: 'USD', secondaryCurrency: 'EUR' });
  assert.match(lastUrl, /action=update_settings/);
  assert.deepEqual(body(), {
    timezone: 'UTC', notifications_enabled: true, primary_currency: 'USD', secondary_currency: 'EUR',
  });
});


test('fetchNotionSettings returns settings or null', async () => {
  payload = { success: true, settings: { NOTION_API_KEY: 'secret' } };
  assert.deepEqual(await fetchNotionSettings(), { NOTION_API_KEY: 'secret' });
  payload = { success: true }; // no settings field
  assert.equal(await fetchNotionSettings(), null);
});

test('saveNotionSettings posts the update_settings action with the settings', async () => {
  await saveNotionSettings({ NOTION_API_KEY: 'x' });
  assert.equal(body().action, 'update_settings');
  assert.deepEqual(body().settings, { NOTION_API_KEY: 'x' });
});

test('syncNotion surfaces stats on success and error on failure', async () => {
  payload = { success: true, stats: { tasks: 3, links: 2 } };
  const ok = await syncNotion();
  assert.equal(ok.success, true);
  assert.deepEqual(ok.stats, { tasks: 3, links: 2 });
  payload = { success: false, error: 'no token' };
  assert.equal((await syncNotion()).error, 'no token');
});

test('changePassword maps to current_password/new_password body', async () => {
  await changePassword('old', 'new');
  assert.deepEqual(body(), { current_password: 'old', new_password: 'new' });
});

test('deleteAccount sends the password and DELETE method', async () => {
  payload = { success: false, message: 'wrong password' };
  const r = await deleteAccount('pw');
  assert.equal(lastInit.method, 'DELETE');
  assert.equal(body().password, 'pw');
  assert.equal(r.message, 'wrong password');
});

test('formatLiveClock formats a fixed instant and returns "" on a bad timezone', () => {
  const at = new Date('2026-06-29T12:00:00Z');
  const s = formatLiveClock('UTC', at);
  assert.match(s, /12:00:00 PM/);
  assert.match(s, /Jun 29, 2026/);
  assert.equal(formatLiveClock('Not/AZone', at), '');
});
