/**
 * Script to apply migration 014_session_outcomes.sql to Supabase
 *
 * Usage: DATABASE_URL=postgresql://... node scripts/apply-migration.js
 */

const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

// The database URL should be provided as an environment variable
// Format: postgresql://postgres.[project-ref]:[password]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  console.error('ERROR: DATABASE_URL environment variable is required');
  console.log('\nTo get your database URL:');
  console.log('1. Go to https://supabase.com/dashboard/project/lzjixdhzejnknhxpcnlc/settings/database');
  console.log('2. Copy the "Connection string" (URI format)');
  console.log('3. Run: DATABASE_URL="your-connection-string" node scripts/apply-migration.js');
  process.exit(1);
}

async function main() {
  const pool = new Pool({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to database...');
    const client = await pool.connect();
    console.log('Connected successfully!');

    // Read migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '014_session_outcomes.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log('Applying migration 014_session_outcomes.sql...');

    // Execute the full SQL file
    await client.query(sql);

    console.log('Migration applied successfully!');

    // Verify: check if table exists
    const result = await client.query(`
      SELECT COUNT(*) FROM scenario_outcomes
    `);
    console.log(`scenario_outcomes table has ${result.rows[0].count} rows`);

    client.release();
  } catch (error) {
    console.error('Error applying migration:', error.message);
    if (error.message.includes('already exists')) {
      console.log('Note: Some objects may already exist, which is OK.');
    }
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
