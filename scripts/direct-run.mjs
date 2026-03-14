#!/usr/bin/env node
/**
 * 🔧 Direct Migration Runner - Background Alchemy Pro
 * 
 * מריץ מיגרציות ישירות דרך Supabase Auth + RPC
 * (לא צריך access token - רק email/password של אדמין)
 * 
 * שימוש:
 *   node scripts/direct-run.mjs pending              # הרצת מיגרציות ממתינות
 *   node scripts/direct-run.mjs file "path.sql"      # הרצת קובץ SQL
 *   node scripts/direct-run.mjs sql "SELECT 1"       # הרצת SQL ישיר
 *   node scripts/direct-run.mjs all                   # כל המיגרציות מ-supabase/migrations
 *   node scripts/direct-run.mjs status                # סטטוס מיגרציות
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import readline from 'readline';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.join(__dirname, '..');

// ── Supabase Config ─────────────────────────────────
const SUPABASE_URL = 'https://suyrxqgiszktpziizklu.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN1eXJ4cWdpc3prdHB6aWl6a2x1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM1MDk0MTMsImV4cCI6MjA4OTA4NTQxM30.Ec294EwIwDP_xNHLa7CJeHp2AiK9wRWOxr9Z1LZaBz4';

// Admin credentials
const ADMIN_EMAIL = 'jj1212t@gmail.com';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Colors ──────────────────────────────────────────
const c = {
  reset: '\x1b[0m', green: '\x1b[32m', red: '\x1b[31m',
  yellow: '\x1b[33m', cyan: '\x1b[36m', bold: '\x1b[1m', dim: '\x1b[2m',
};

function log(msg) { console.log(msg); }
function ok(msg) { log(`${c.green}✅ ${msg}${c.reset}`); }
function err(msg) { log(`${c.red}❌ ${msg}${c.reset}`); }
function info(msg) { log(`${c.cyan}ℹ️  ${msg}${c.reset}`); }

// ── Prompt for password ─────────────────────────────
function askPassword() {
  return new Promise((resolve) => {
    // Check env first
    if (process.env.SUPABASE_ADMIN_PASSWORD) {
      return resolve(process.env.SUPABASE_ADMIN_PASSWORD);
    }

    // Check .env.local
    const envLocalPath = path.join(ROOT, '.env.local');
    if (fs.existsSync(envLocalPath)) {
      const content = fs.readFileSync(envLocalPath, 'utf-8');
      const match = content.match(/SUPABASE_ADMIN_PASSWORD=(.+)/);
      if (match) return resolve(match[1].trim());
    }

    // Ask user
    const rl = readline.createInterface({ input: process.stdin, output: process.stderr });
    rl.question(`🔑 הכנס סיסמה עבור ${ADMIN_EMAIL}: `, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

// ── Login ───────────────────────────────────────────
async function login(password) {
  log('🔐 מתחבר כאדמין...');
  
  const { data, error } = await supabase.auth.signInWithPassword({
    email: ADMIN_EMAIL,
    password: password,
  });

  if (error) {
    err(`כניסה נכשלה: ${error.message}`);
    return false;
  }

  ok(`מחובר כ: ${data.user.email}`);
  return true;
}

// ── Run Migration via RPC ───────────────────────────
async function runMigration(name, sql) {
  log(`\n🚀 מריץ: ${name}`);
  log('─'.repeat(50));

  const { data, error } = await supabase.rpc('execute_safe_migration', {
    p_migration_name: name,
    p_migration_sql: sql,
  });

  if (error) {
    err(`נכשל: ${error.message}`);
    
    // If RPC function doesn't exist, provide setup instructions
    if (error.message.includes('execute_safe_migration') || error.code === '42883') {
      log('');
      info('הפונקציה execute_safe_migration לא קיימת בדאטהבייס!');
      info('הרץ את הקובץ scripts/setup-db.sql דרך Supabase Dashboard:');
      log(`  ${c.cyan}https://supabase.com/dashboard/project/suyrxqgiszktpziizklu/sql${c.reset}`);
      log('');
    }
    return { success: false, error: error.message };
  }

  if (data && data.success) {
    ok('הושלם בהצלחה!');
    return { success: true, data };
  } else {
    // Check for "already exists" type errors
    const errMsg = data?.error || 'Unknown error';
    if (errMsg.includes('already exists')) {
      log(`  ${c.dim}(כבר קיים - ממשיך)${c.reset}`);
      return { success: true, data };
    }
    err(`נכשל: ${errMsg}`);
    return { success: false, error: errMsg };
  }
}

// ── Run All Migrations from supabase/migrations ────
async function runAllMigrations() {
  const dir = path.join(ROOT, 'supabase', 'migrations');
  if (!fs.existsSync(dir)) {
    err('תיקיית migrations לא נמצאה');
    return;
  }

  const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
  if (files.length === 0) {
    info('אין קבצי migration');
    return;
  }

  info(`נמצאו ${files.length} קבצי migration`);
  let success = 0, failed = 0;

  for (const file of files) {
    const sql = fs.readFileSync(path.join(dir, file), 'utf-8');
    const name = path.basename(file, '.sql');
    const result = await runMigration(name, sql);
    if (result.success) success++; else failed++;
  }

  log(`\n  ${c.bold}סיכום: ${c.green}${success} הצליחו${c.reset}, ${failed > 0 ? c.red : c.dim}${failed} נכשלו${c.reset}`);
}

// ── Run SQL File ────────────────────────────────────
async function runFile(filePath) {
  const fullPath = path.resolve(filePath);
  if (!fs.existsSync(fullPath)) {
    err(`הקובץ לא נמצא: ${fullPath}`);
    process.exit(1);
  }

  const sql = fs.readFileSync(fullPath, 'utf-8');
  const name = path.basename(filePath, '.sql');
  await runMigration(name, sql);
}

// ── Run Inline SQL ──────────────────────────────────
async function runSQL(sql, name) {
  await runMigration(name || `direct_${Date.now()}`, sql);
}

// ── Migration Status ────────────────────────────────
async function showStatus() {
  const { data, error } = await supabase
    .from('migration_logs')
    .select('name, status, executed_at, error_message')
    .order('executed_at', { ascending: false })
    .limit(20);

  if (error) {
    err(`שגיאה: ${error.message}`);
    return;
  }

  if (!data || data.length === 0) {
    info('אין לוגים של מיגרציות');
    return;
  }

  info(`${data.length} מיגרציות אחרונות:`);
  log('');
  for (const row of data) {
    const icon = row.status === 'completed' ? `${c.green}✅` : `${c.red}❌`;
    const date = new Date(row.executed_at).toLocaleString('he-IL');
    log(`  ${icon} ${row.name}${c.reset}  ${c.dim}${date}${c.reset}`);
    if (row.error_message) {
      log(`     ${c.red}${row.error_message}${c.reset}`);
    }
  }
}

// ── Main ────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'all';

  log('═'.repeat(50));
  log('   🔧 Direct Migration Runner');
  log('═'.repeat(50));

  const password = await askPassword();
  if (!password) {
    err('לא הוזנה סיסמה');
    process.exit(1);
  }

  const loggedIn = await login(password);
  if (!loggedIn) {
    process.exit(1);
  }

  switch (command) {
    case 'all':
    case 'migrations':
      await runAllMigrations();
      break;

    case 'file':
      if (!args[1]) { err('חסר נתיב. שימוש: node scripts/direct-run.mjs file "path.sql"'); process.exit(1); }
      await runFile(args[1]);
      break;

    case 'sql':
      if (!args[1]) { err('חסר SQL. שימוש: node scripts/direct-run.mjs sql "SELECT 1"'); process.exit(1); }
      await runSQL(args[1], args[2]);
      break;

    case 'status':
      await showStatus();
      break;

    case 'pending':
      const pendingPath = path.join(ROOT, 'public', 'pending-migrations.json');
      if (fs.existsSync(pendingPath)) {
        const content = JSON.parse(fs.readFileSync(pendingPath, 'utf-8'));
        const pending = (content.migrations || []).filter(m => m.status === 'pending');
        if (pending.length === 0) { info('אין מיגרציות ממתינות'); break; }
        info(`${pending.length} מיגרציות ממתינות`);
        for (const m of pending) {
          const result = await runMigration(m.name, m.sql);
          m.status = result.success ? 'completed' : 'failed';
          m.executedAt = new Date().toISOString();
          if (!result.success) m.errorMessage = result.error;
        }
        fs.writeFileSync(pendingPath, JSON.stringify(content, null, 2));
      } else {
        info('אין קובץ pending-migrations.json');
      }
      break;

    default:
      info('פקודות:');
      log('  all      - הרץ את כל המיגרציות מ-supabase/migrations');
      log('  file     - הרץ קובץ SQL');
      log('  sql      - הרץ SQL ישיר');
      log('  status   - סטטוס מיגרציות');
      log('  pending  - הרץ מיגרציות ממתינות');
  }

  await supabase.auth.signOut();
  log('\n🏁 סיום!');
}

main().catch(e => {
  err(e.message);
  process.exit(1);
});
