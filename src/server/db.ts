import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

const dbConfig: sql.config = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_DATABASE || process.env.DB_NAME || 'nextgencms',
  user: process.env.DB_USER || 'election_user',
  password: process.env.DB_PASSWORD || 'Election@2026#Secure',
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true', // true for azure, false for local
    trustServerCertificate: true, // required for local dev
    enableArithAbort: true,
  },
  pool: {
    max: 20,
    min: 0,
    idleTimeoutMillis: 30000,
  }
};

let pool: sql.ConnectionPool | null = null;
let lastLogTime = 0;

export async function getDbPool(): Promise<sql.ConnectionPool> {
  if (pool && pool.connected) {
    return pool;
  }
  try {
    pool = await new sql.ConnectionPool(dbConfig).connect();
    console.log(`[Database] Connected successfully to MS SQL Server database: ${dbConfig.database}`);
    return pool;
  } catch (error: any) {
    const now = Date.now();
    if (now - lastLogTime > 5000) {
      console.error(`[Database] Connection notice: Unable to connect to local SQL database (${error.message?.split('\n')[0] || 'Login failed'}).`);
      lastLogTime = now;
    }
    const cleanError = new Error('Database service unavailable. Please verify local SQL Server setup in SSMS.');
    throw cleanError;
  }
}

export async function query<T = any>(queryString: string, params?: Record<string, any>): Promise<T[]> {
  const p = await getDbPool();
  const request = p.request();
  
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  const result = await request.query(queryString);
  return result.recordset as T[];
}

export async function execute(queryString: string, params?: Record<string, any>): Promise<sql.IResult<any>> {
  const p = await getDbPool();
  const request = p.request();
  
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      request.input(key, value);
    }
  }

  return await request.query(queryString);
}

export { sql };
