// db.js - PostgreSQL client using 'pg' (No Prisma)
import pg from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const { Pool } = pg;
const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  ssl: connectionString && (connectionString.includes('neon.tech') || connectionString.includes('sslmode=require') || process.env.NODE_ENV === 'production')
    ? { rejectUnauthorized: false }
    : false
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle PostgreSQL client:', err);
});

// Auto-initialize tables if they do not exist
export const initDB = async () => {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "User" (
        id TEXT PRIMARY KEY,
        username TEXT NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        role TEXT DEFAULT 'USER',
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );

      CREATE TABLE IF NOT EXISTS "Post" (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        content TEXT NOT NULL,
        published BOOLEAN DEFAULT FALSE,
        "authorId" TEXT REFERENCES "User"(id) ON DELETE CASCADE,
        "createdAt" TIMESTAMP DEFAULT NOW(),
        "updatedAt" TIMESTAMP DEFAULT NOW()
      );
    `);
    console.log('✅ PostgreSQL connected and schema verified.');
  } catch (error) {
    console.error('⚠️ Database initialization error:', error.message);
  }
};

// Immediately verify connection & tables
initDB();

export const query = (text, params) => pool.query(text, params);
export default pool;
