#!/usr/bin/env node
/**
 * 🚀 Background Alchemy Pro - Deploy Script
 * 
 * מריץ מיגרציות ומעלה Edge Functions ל-Supabase
 * 
 * שימוש:
 *   node scripts/deploy-all.mjs                    # הכל - מיגרציות + Edge Functions
 *   node scripts/deploy-all.mjs migrations          # רק מיגרציות
 *   node scripts/deploy-all.mjs functions           # רק Edge Functions
 *   node scripts/deploy-all.mjs sql "SELECT 1"     # הרצת SQL ישיר
 *   node scripts/deploy-all.mjs file "path.sql"    # הרצת קובץ SQL
 */

import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, basename } from 'path';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');

// ── Config ──────────────────────────────────────────
const PROJECT_REF = 'suyrxqgiszktpziizklu';
const MGMT_API = 'https://api.supabase.com/v1';

// ── Colors ──────────────────────────────────────────
const c = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
};

function log(msg) { console.log(msg); }
function ok(msg) { log(`${c.green}✅ ${msg}${c.reset}`); }
function err(msg) { log(`${c.red}❌ ${msg}${c.reset}`); }
function info(msg) { log(`${c.cyan}ℹ️  ${msg}${c.reset}`); }
function warn(msg) { log(`${c.yellow}⚠️  ${msg}${c.reset}`); }
function header(msg) {
  log('');
  log(`${c.bold}${'═'.repeat(56)}${c.reset}`);
  log(`${c.bold}   🔧 ${msg}${c.reset}`);
  log(`${c.bold}${'═'.repeat(56)}${c.reset}`);
}

// ── Get Access Token ────────────────────────────────
function getAccessToken() {
  // 1. From environment variable
  if (process.env.SUPABASE_ACCESS_TOKEN) {
    return process.env.SUPABASE_ACCESS_TOKEN;
  }

  // 2. From .env.local file
  const envLocalPath = join(ROOT, '.env.local');
  if (existsSync(envLocalPath)) {
    const envContent = readFileSync(envLocalPath, 'utf-8');
    const match = envContent.match(/SUPABASE_ACCESS_TOKEN=(.+)/);
    if (match) return match[1].trim();
  }

  // 3. Instructions
  err('לא נמצא SUPABASE_ACCESS_TOKEN!');
  log('');
  info('כדי לקבל Access Token:');
  log(`  1. היכנס ל: ${c.cyan}https://supabase.com/dashboard/account/tokens${c.reset}`);
  log(`  2. לחץ "Generate new token"`);
  log(`  3. העתק את הטוקן`);
  log('');
  info('אפשרות א - משתנה סביבה:');
  log(`  ${c.yellow}$env:SUPABASE_ACCESS_TOKEN = "sbp_your_token_here"${c.reset}`);
  log(`  ${c.yellow}node scripts/deploy-all.mjs${c.reset}`);
  log('');
  info('אפשרות ב - שמור בקובץ .env.local:');
  log(`  ${c.yellow}SUPABASE_ACCESS_TOKEN=sbp_your_token_here${c.reset}`);
  log('');
  process.exit(1);
}

// ── Run SQL via Management API ──────────────────────
async function runSQL(token, sql, label = 'SQL') {
  const url = `${MGMT_API}/projects/${PROJECT_REF}/database/query`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ query: sql }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`${label} failed (${response.status}): ${errorText}`);
  }

  const result = await response.json();
  return result;
}

// ── Run Migrations ──────────────────────────────────
async function runMigrations(token) {
  header('הרצת מיגרציות');
  
  const migrationsDir = join(ROOT, 'supabase', 'migrations');
  if (!existsSync(migrationsDir)) {
    warn('תיקיית migrations לא נמצאה');
    return;
  }

  const files = readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  if (files.length === 0) {
    warn('אין קבצי migration');
    return;
  }

  info(`נמצאו ${files.length} קבצי migration`);
  log('');

  let success = 0;
  let failed = 0;

  for (const file of files) {
    const filePath = join(migrationsDir, file);
    const sql = readFileSync(filePath, 'utf-8');
    const shortName = file.substring(0, 50) + (file.length > 50 ? '...' : '');
    
    process.stdout.write(`  🔄 ${shortName} ... `);
    
    try {
      await runSQL(token, sql, file);
      log(`${c.green}✅${c.reset}`);
      success++;
    } catch (e) {
      log(`${c.red}❌${c.reset}`);
      // Check if it's a "already exists" error - that's OK
      if (e.message.includes('already exists')) {
        log(`     ${c.dim}(כבר קיים - ממשיך)${c.reset}`);
        success++;
      } else {
        log(`     ${c.red}${e.message.substring(0, 200)}${c.reset}`);
        failed++;
      }
    }
  }

  log('');
  log(`  ${c.bold}סיכום: ${c.green}${success} הצליחו${c.reset}, ${failed > 0 ? c.red : c.dim}${failed} נכשלו${c.reset}`);
}

// ── Deploy Edge Functions ───────────────────────────
async function deployFunctions(token) {
  header('דיפלוי Edge Functions');
  
  const functionsDir = join(ROOT, 'supabase', 'functions');
  if (!existsSync(functionsDir)) {
    warn('תיקיית functions לא נמצאה');
    return;
  }

  const functions = readdirSync(functionsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name);

  if (functions.length === 0) {
    warn('אין Edge Functions');
    return;
  }

  info(`נמצאו ${functions.length} Edge Functions לדיפלוי`);
  log('');

  // Set the token for Supabase CLI
  const env = { ...process.env, SUPABASE_ACCESS_TOKEN: token };
  
  let success = 0;
  let failed = 0;

  for (const funcName of functions) {
    process.stdout.write(`  🚀 ${funcName} ... `);
    
    try {
      execSync(
        `npx supabase functions deploy ${funcName} --no-verify-jwt --project-ref ${PROJECT_REF}`,
        { cwd: ROOT, env, stdio: 'pipe', timeout: 120000 }
      );
      log(`${c.green}✅${c.reset}`);
      success++;
    } catch (e) {
      log(`${c.red}❌${c.reset}`);
      const stderr = e.stderr?.toString() || e.message;
      log(`     ${c.red}${stderr.substring(0, 200)}${c.reset}`);
      failed++;
    }
  }

  log('');
  log(`  ${c.bold}סיכום: ${c.green}${success} הצליחו${c.reset}, ${failed > 0 ? c.red : c.dim}${failed} נכשלו${c.reset}`);
}

// ── List Functions Status ───────────────────────────
async function listFunctions(token) {
  header('סטטוס Edge Functions');
  
  const url = `${MGMT_API}/projects/${PROJECT_REF}/functions`;
  
  const response = await fetch(url, {
    headers: { 'Authorization': `Bearer ${token}` },
  });

  if (!response.ok) {
    err(`שגיאה בשליפת רשימה: ${response.status}`);
    return;
  }

  const functions = await response.json();
  
  if (functions.length === 0) {
    warn('אין Edge Functions מדופלויות');
    return;
  }

  info(`${functions.length} Edge Functions מדופלויות:`);
  log('');
  
  for (const fn of functions) {
    const status = fn.status === 'ACTIVE' ? `${c.green}● ACTIVE${c.reset}` : `${c.red}● ${fn.status}${c.reset}`;
    log(`  ${status}  ${fn.slug}`);
  }
}

// ── Run Single SQL File ─────────────────────────────
async function runFile(token, filePath) {
  header(`הרצת קובץ SQL`);
  
  const resolvedPath = join(ROOT, filePath);
  if (!existsSync(resolvedPath)) {
    err(`הקובץ לא נמצא: ${resolvedPath}`);
    process.exit(1);
  }

  const sql = readFileSync(resolvedPath, 'utf-8');
  info(`קובץ: ${basename(filePath)}`);
  info(`גודל: ${sql.length} תווים`);
  log('');

  try {
    const result = await runSQL(token, sql, basename(filePath));
    ok('הקובץ הורץ בהצלחה!');
    if (Array.isArray(result) && result.length > 0) {
      log('');
      log(`  ${c.dim}תוצאה:${c.reset}`);
      console.table(result.slice(0, 20));
    }
  } catch (e) {
    err(e.message);
  }
}

// ── Run Inline SQL ──────────────────────────────────
async function runInlineSQL(token, sql) {
  header('הרצת SQL');
  info(`Query: ${sql.substring(0, 100)}`);
  log('');

  try {
    const result = await runSQL(token, sql, 'inline');
    ok('הצליח!');
    if (Array.isArray(result) && result.length > 0) {
      console.table(result.slice(0, 50));
    } else {
      log(`  ${c.dim}(אין תוצאות)${c.reset}`);
    }
  } catch (e) {
    err(e.message);
  }
}

// ── Main ────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  header('Background Alchemy Pro - Deploy');
  info(`Project: ${PROJECT_REF}`);
  info(`Command: ${command}`);

  const token = getAccessToken();
  ok('Access Token נמצא');

  switch (command) {
    case 'all':
      await runMigrations(token);
      await deployFunctions(token);
      await listFunctions(token);
      break;

    case 'migrations':
    case 'migrate':
      await runMigrations(token);
      break;

    case 'functions':
    case 'deploy':
      await deployFunctions(token);
      await listFunctions(token);
      break;

    case 'status':
    case 'list':
      await listFunctions(token);
      break;

    case 'sql':
      if (!args[1]) { err('חסר SQL query. שימוש: node scripts/deploy-all.mjs sql "SELECT 1"'); process.exit(1); }
      await runInlineSQL(token, args[1]);
      break;

    case 'file':
      if (!args[1]) { err('חסר נתיב לקובץ. שימוש: node scripts/deploy-all.mjs file "path.sql"'); process.exit(1); }
      await runFile(token, args[1]);
      break;

    default:
      err(`פקודה לא מוכרת: ${command}`);
      log('');
      info('פקודות זמינות:');
      log('  all         - מיגרציות + Edge Functions (ברירת מחדל)');
      log('  migrations  - רק מיגרציות');
      log('  functions   - רק Edge Functions');
      log('  status      - סטטוס Edge Functions');
      log('  sql "..."   - הרצת SQL ישיר');
      log('  file "..."  - הרצת קובץ SQL');
      process.exit(1);
  }

  log('');
  log(`${c.bold}🏁 סיום!${c.reset}`);
}

main().catch(e => {
  err(e.message);
  process.exit(1);
});
