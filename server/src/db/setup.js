import mysql from 'mysql2/promise';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { hashPassword } from '../utils/helpers.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function setup() {
  try {
    const connection = await mysql.createConnection({
      host: process.env.DB_HOST || 'localhost',
      user: process.env.DB_USER || 'root',
      password: process.env.DB_PASSWORD || '',
      port: process.env.DB_PORT || 3306
    });

    await connection.query(`CREATE DATABASE IF NOT EXISTS ${process.env.DB_NAME || 'ludu_aaddaa'}`);
    await connection.query(`USE ${process.env.DB_NAME || 'ludu_aaddaa'}`);
    
    const schema = fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8');
    const statements = schema.split(';').filter(s => s.trim());
    
    for (let stmt of statements) {
      if (stmt.trim()) await connection.query(stmt);
    }
    
    console.log('✅ Database schema created');
    
    // Create default admin
    const hashedPass = await hashPassword('admin123');
    await connection.query(
      `INSERT INTO agents (username, password, full_name, role) VALUES ('admin', ?, 'Super Admin', 'client')
       ON DUPLICATE KEY UPDATE password = ?`,
      [hashedPass, hashedPass]
    );
    
    console.log('✅ Default admin created: username: admin, password: admin123');
    await connection.end();
  } catch (error) {
    console.error('❌ Setup error:', error);
  }
}

setup();
