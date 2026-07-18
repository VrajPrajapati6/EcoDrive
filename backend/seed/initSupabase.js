const { pool } = require('../config/supabase');
const bcrypt = require('bcryptjs');

async function initDatabase() {
  console.log('Initializing Supabase tables...');
  try {
    // 1. Create organizations table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS organizations (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) UNIQUE NOT NULL,
        domain VARCHAR(255),
        code VARCHAR(50),
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "organizations" created or verified.');

    // 2. Create users table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        role VARCHAR(100) NOT NULL,
        organization_id UUID REFERENCES organizations(id) ON DELETE SET NULL,
        employee_id VARCHAR(100),
        phone VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `);
    console.log('✅ Table "users" created or verified.');

    // 3. Seed sample organizations
    const orgsToSeed = [
      { name: 'TechCorp Global', domain: 'techcorp.com', code: 'TCG' },
      { name: 'GreenPulse Labs', domain: 'greenpulse.io', code: 'GPL' },
      { name: 'Apex Innovations', domain: 'apex.org', code: 'APEX' },
      { name: 'Odoo Enterprise', domain: 'odoo.com', code: 'ODOO' }
    ];

    for (const org of orgsToSeed) {
      await pool.query(`
        INSERT INTO organizations (name, domain, code, is_active)
        VALUES ($1, $2, $3, true)
        ON CONFLICT (name) DO NOTHING;
      `, [org.name, org.domain, org.code]);
    }
    console.log('✅ Sample organizations seeded successfully.');

    // Fetch TechCorp Global ID for demo users
    const orgRes = await pool.query(`SELECT id FROM organizations WHERE name = $1`, ['TechCorp Global']);
    if (orgRes.rows.length > 0) {
      const techCorpId = orgRes.rows[0].id;
      const hashedPwd = await bcrypt.hash('password123', 10);

      // Seed demo admin
      await pool.query(`
        INSERT INTO users (email, password_hash, full_name, role, organization_id, employee_id, phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
      `, [
        'admin@techcorp.com',
        hashedPwd,
        'Sarah Jenkins (Company Admin)',
        'Company Administrator',
        techCorpId,
        'ADM-001',
        '+1 555-0199'
      ]);

      // Seed demo employee
      await pool.query(`
        INSERT INTO users (email, password_hash, full_name, role, organization_id, employee_id, phone)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash;
      `, [
        'employee@techcorp.com',
        hashedPwd,
        'Alex Rivera (Employee)',
        'Employee',
        techCorpId,
        'EMP-1042',
        '+1 555-0142'
      ]);
      console.log('✅ Demo accounts seeded: admin@techcorp.com & employee@techcorp.com (password: password123)');
    }

    console.log('🎉 Database initialization complete!');
  } catch (error) {
    console.error('❌ Error during database initialization:', error);
  } finally {
    pool.end();
  }
}

initDatabase();
