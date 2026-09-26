import {PGlite} from '@electric-sql/pglite';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const db=new PGlite(),a='00000000-0000-4000-8000-000000000001',b='00000000-0000-4000-8000-000000000002';
try{
await db.exec(`create role anon;create role authenticated;create role service_role bypassrls;create schema auth;create table auth.users(id uuid primary key,email text,email_confirmed_at timestamptz);create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;grant usage on schema auth to authenticated;`);
for(const f of ['202609100001_accounts.sql','202609230001_email_link_confirmation.sql'])await db.exec(await fs.readFile('supabase/migrations/'+f,'utf8'));
await db.query('insert into auth.users values($1,$2,now()),($3,$4,now())',[a,'owner@example.com',b,'other@example.com']);
const request=(uid,email,hash)=>db.query('select public.request_notification_email($1,$2,$3,$4)',[uid,email,hash,crypto.randomUUID()]);
const confirm=async hash=>(await db.query('select public.confirm_notification_email_link($1) as status',[hash])).rows[0].status;
await request(a,'new@example.com','a'.repeat(64));
assert.equal((await db.query('select email from public.notification_emails where user_id=$1',[a])).rows[0].email,'owner@example.com');
for(const role of ['anon','authenticated']){await db.exec('set role '+role);await assert.rejects(confirm('a'.repeat(64)));await assert.rejects(db.query('select * from public.email_verification_receipts'));await assert.rejects(db.query('select public.cancel_notification_email($1)',[a]));await db.exec('reset role')}
// No auth.uid/session exists; only the server-provided token hash determines the account.
assert.equal(await confirm('a'.repeat(64)),'verified');
assert.equal((await db.query('select email from public.notification_emails where user_id=$1',[a])).rows[0].email,'new@example.com');
assert.equal((await db.query('select email from public.notification_emails where user_id=$1',[b])).rows[0].email,'other@example.com');
assert.equal((await db.query('select email from auth.users where id=$1',[a])).rows[0].email,'owner@example.com');
assert.equal(await confirm('a'.repeat(64)),'already_verified');
await db.exec("update public.email_delivery_logs set created_at=now()-interval '2 minutes'");
await request(a,'next@example.com','b'.repeat(64));await db.exec("update public.email_delivery_logs set created_at=now()-interval '2 minutes'");
await request(a,'latest@example.com','c'.repeat(64));assert.equal(await confirm('b'.repeat(64)),'invalid');
await db.query('select public.cancel_notification_email($1)',[a]);assert.equal(await confirm('c'.repeat(64)),'invalid');
assert.equal((await db.query('select email from public.notification_emails where user_id=$1',[a])).rows[0].email,'new@example.com');
await db.exec("update public.email_delivery_logs set created_at=now()-interval '2 minutes'");await request(a,'final@example.com','d'.repeat(64));
await db.query("update public.email_verification_requests set expires_at=now()-interval '1 second' where user_id=$1",[a]);assert.equal(await confirm('d'.repeat(64)),'expired');
await db.query("update public.email_verification_requests set expires_at=now()+interval '1 minute' where user_id=$1",[a]);assert.equal(await confirm('d'.repeat(64)),'verified');
assert.equal(await confirm('a'.repeat(64)),'already_verified');assert.equal((await db.query('select email from public.notification_emails where user_id=$1',[a])).rows[0].email,'final@example.com','replay must never restore an old recipient');
await db.query('delete from auth.users where id=$1',[a]);assert.equal(await confirm('d'.repeat(64)),'invalid');assert.equal((await db.query('select * from public.email_verification_receipts')).rows.length,0);
assert.equal(await confirm(null),'invalid');
console.log('PASS: token-only confirmation, protected RPCs, unchanged login/other accounts, expiry, replacement, cancellation, harmless replay and deletion cleanup.');
}finally{await db.close()}
