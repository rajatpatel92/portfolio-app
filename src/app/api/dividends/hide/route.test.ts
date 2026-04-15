import test from 'node:test';
import assert from 'node:assert';
import fs from 'node:fs';
import path from 'node:path';

test('Security Check: POST /api/dividends/hide has auth() check', async () => {
  const filePath = path.resolve('src/app/api/dividends/hide/route.ts');
  const content = fs.readFileSync(filePath, 'utf8');

  // Check for auth import
  assert.ok(content.includes("import { auth } from '@/auth'") || content.includes('import { auth } from "@/auth"'), 'Should import auth from @/auth');

  // Check for auth() call in POST
  const postMatch = content.match(/export async function POST[\s\S]*?\{([\s\S]*?)\n[ ]*try/);
  assert.ok(postMatch, 'POST function body before try block not found');
  assert.ok(postMatch[1].includes('await auth()'), 'POST should call auth()');
  assert.ok(postMatch[1].includes('401'), 'POST should return 401 if unauthorized');
});

test('Security Check: DELETE /api/dividends/hide has auth() check', async () => {
  const filePath = path.resolve('src/app/api/dividends/hide/route.ts');
  const content = fs.readFileSync(filePath, 'utf8');

  // Check for auth() call in DELETE
  const deleteMatch = content.match(/export async function DELETE[\s\S]*?\{([\s\S]*?)\n[ ]*try/);
  assert.ok(deleteMatch, 'DELETE function body before try block not found');
  assert.ok(deleteMatch[1].includes('await auth()'), 'DELETE should call auth()');
  assert.ok(deleteMatch[1].includes('401'), 'DELETE should return 401 if unauthorized');
});
