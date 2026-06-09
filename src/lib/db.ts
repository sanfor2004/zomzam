import mysql from 'mysql2/promise';

const pool = mysql.createPool({
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
 * Execute a query that returns a single row
 */
export async function queryOne<T = any>(sql: string, params?: any[]): Promise<T | null> {
  try {
    const [rows] = await pool.execute(sql, params);
    const results = rows as T[];
    return results.length > 0 ? results[0] : null;
  } catch (error: any) {
    console.error('Database queryOne error:', error);
    return null; // Suppress fatal DB exceptions cleanly like PHP model
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
