// Read-only checks using the same publishable key supplied to the browser.
// Never use a secret/service-role key here. No users or emails are created.
import assert from 'node:assert/strict';
const url = process.env.PUBLIC_SUPABASE_URL;
const key = process.env.PUBLIC_SUPABASE_PUBLISHABLE_KEY;
assert(url && key?.startsWith('sb_publishable_'), 'Use a project URL and publishable key');
const headers = { apikey: key };
const settingsResponse = await fetch(`${url}/auth/v1/settings`, { headers });
assert.equal(settingsResponse.status, 200);
const settings = await settingsResponse.json();
assert.equal(settings.external.email, true);
assert.equal(settings.mailer_autoconfirm, false, 'Email ownership confirmation must remain enabled');
for (const table of ['profiles', 'notification_preferences', 'notification_emails', 'email_verification_requests', 'email_delivery_logs']) {
  const response = await fetch(`${url}/rest/v1/${table}?select=*&limit=1`, { headers });
  const body = await response.json();
  assert([401, 403].includes(response.status), `${table}: expected access denial, got ${response.status}`);
  assert.equal(body.code, '42501', `${table}: expected PostgreSQL permission denial`);
  console.log(`PASS anonymous read denied: ${table}`);
}
console.log('PASS live email Auth configuration and anonymous DB access checks. Signed-in flows and mail delivery still require integration tests.');
