import mysql from 'mysql2/promise';
import type { EventEmitter } from 'events';

// Prevent multiple connection pools in development hot-reloads
declare global {
  var mysqlPool: mysql.Pool | undefined;
}

function createPool(): mysql.Pool {
  const p = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306'),
    database: process.env.DB_NAME || 'zomzam_db',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASS || '',
    charset: process.env.DB_CHARSET || 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
    enableKeepAlive: true,
    keepAliveInitialDelay: 10000,
  });

  // enableKeepAlive pings idle pooled connections in the background, outside
  // any query's promise chain. If the remote host (shared MySQL hosting) drops
  // an idle connection first, that ping fails and emits 'error' on the pool —
  // with no listener, Node treats it as an uncaught exception and kills the
  // whole serverless function (surfaces as Vercel's generic crash page, not a
  // graceful JSON 500 from our route handlers). Log instead of crashing.
  // (mysql2's Pool type omits 'error' from its `.on()` overloads even though
  // it's a real EventEmitter at runtime — cast to call it.)
  (p as unknown as EventEmitter).on('error', (err: Error) => {
    console.error('MySQL pool error:', err);
  });

  return p;
}

const pool = globalThis.mysqlPool || createPool();

if (process.env.NODE_ENV !== 'production') {
  globalThis.mysqlPool = pool;
}

export default pool;

/**
 * Execute a query that returns multiple rows
 */
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  try {
    const [rows] = await pool.execute(sql, params);
    return rows as T[];
  } catch (error: any) {
    console.error('Database query error:', error);
    throw new Error(`DB Query Failed: ${error.message}`);
  }
}

/**
 * Execute a query that returns a single row, or null if no row matches.
 * Throws on DB errors — null means "not found", never "something went wrong".
 */
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  try {
    const [rows] = await pool.execute(sql, params);
    const results = rows as T[];
    return results.length > 0 ? results[0] : null;
  } catch (error: any) {
    console.error('Database queryOne error:', error);
    throw new Error(`DB Query Failed: ${error.message}`);
  }
}

/**
 * Execute an insert/update/delete operation
 */
export async function execute(sql: string, params?: any[]): Promise<mysql.ResultSetHeader> {
  try {
    const [result] = await pool.execute(sql, params);
    return result as mysql.ResultSetHeader;
  } catch (error: any) {
    console.error('Database execution error:', error);
    throw new Error(`DB Execution Failed: ${error.message}`);
  }
}

/**
 * Helper to run code within a transaction
 */
export async function transaction<T>(callback: (connection: mysql.PoolConnection) => Promise<T>): Promise<T> {
  const connection = await pool.getConnection();
  await connection.beginTransaction();
  try {
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
