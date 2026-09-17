import sql from 'mssql';
import dotenv from 'dotenv';
dotenv.config();

let nativeConn: any = null;
let tediousPool: sql.ConnectionPool | null = null;
let lastLogTime = 0;

function isLocalDbMode(): boolean {
  const server = (process.env.DB_SERVER || '').toLowerCase();
  const connStr = (process.env.DB_CONNECTION_STRING || '').toLowerCase();
  const trusted = process.env.DB_TRUSTED_CONNECTION === 'true';
  return server.includes('localdb') || connStr.includes('localdb') || trusted;
}

function getOdbcConnectionString(): string {
  if (process.env.DB_CONNECTION_STRING) {
    return process.env.DB_CONNECTION_STRING;
  }
  const server = process.env.DB_SERVER || '(localdb)\\MSSQLLocalDB';
  const database = process.env.DB_DATABASE || process.env.DB_NAME || 'nextgencms';
  
  if (process.env.DB_USER && process.env.DB_PASSWORD && process.env.DB_TRUSTED_CONNECTION !== 'true') {
    return `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Uid=${process.env.DB_USER};Pwd=${process.env.DB_PASSWORD};`;
  }
  return `Driver={ODBC Driver 17 for SQL Server};Server=${server};Database=${database};Trusted_Connection=yes;`;
}

function getTediousConfig(): sql.config {
  const port = process.env.DB_PORT ? Number(process.env.DB_PORT) : 1433;
  let server = process.env.DB_SERVER || '127.0.0.1';
  if (server.toLowerCase().includes('localdb')) {
    server = '127.0.0.1';
  }

  return {
    server,
    port: isNaN(port) ? 1433 : port,
    database: process.env.DB_DATABASE || process.env.DB_NAME || 'nextgencms',
    user: process.env.DB_USER || 'election_user',
    password: process.env.DB_PASSWORD || 'Election@2026#Secure',
    options: {
      encrypt: process.env.DB_ENCRYPT === 'true',
      trustServerCertificate: true,
      enableArithAbort: true,
    },
    pool: {
      max: 20,
      min: 0,
      idleTimeoutMillis: 30000,
    }
  };
}

async function getNativeConnection(): Promise<any> {
  if (nativeConn) {
    return nativeConn;
  }
  try {
    const { promises: msPromises } = await import('msnodesqlv8');
    const connStr = getOdbcConnectionString();
    nativeConn = await msPromises.open(connStr);
    const dbName = process.env.DB_DATABASE || 'nextgencms';
    console.log(`[Database] Connected successfully to Microsoft SQL Server (LocalDB): ${dbName}`);
    return nativeConn;
  } catch (err: any) {
    nativeConn = null;
    throw err;
  }
}

async function getTediousPool(): Promise<sql.ConnectionPool> {
  if (tediousPool && tediousPool.connected) {
    return tediousPool;
  }
  const config = getTediousConfig();
  try {
    tediousPool = await new sql.ConnectionPool(config).connect();
    console.log(`[Database] Connected successfully to Microsoft SQL Server (TCP): ${config.database}`);
    return tediousPool;
  } catch (error: any) {
    if (config.server === 'localhost') {
      try {
        const fallbackConfig = { ...config, server: '127.0.0.1' };
        tediousPool = await new sql.ConnectionPool(fallbackConfig).connect();
        console.log(`[Database] Connected successfully to Microsoft SQL Server via 127.0.0.1: ${fallbackConfig.database}`);
        return tediousPool;
      } catch {}
    }
    throw error;
  }
}

function prepareParamQuery(sqlText: string, params?: Record<string, any>): { text: string; values: any[] } {
  if (!params || Object.keys(params).length === 0) {
    return { text: sqlText, values: [] };
  }
  const values: any[] = [];
  const text = sqlText.replace(/@([a-zA-Z0-9_]+)/g, (match, paramName) => {
    if (paramName in params) {
      const val = params[paramName];
      values.push(val === undefined ? null : val);
      return '?';
    }
    return match;
  });
  return { text, values };
}

export async function query<T = any>(queryString: string, params?: Record<string, any>): Promise<T[]> {
  if (isLocalDbMode()) {
    try {
      const conn = await getNativeConnection();
      const prepared = prepareParamQuery(queryString, params);
      const res = await conn.promises.query(prepared.text, prepared.values);
      return (res.first || []) as T[];
    } catch (nativeErr: any) {
      logDbError(nativeErr);
      throw nativeErr;
    }
  }

  // Standard TCP mode
  try {
    const pool = await getTediousPool();
    const request = pool.request();
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        request.input(key, value === undefined ? null : value);
      }
    }
    const result = await request.query(queryString);
    return result.recordset as T[];
  } catch (err: any) {
    logDbError(err);
    throw err;
  }
}

export async function execute(queryString: string, params?: Record<string, any>): Promise<any> {
  return await query(queryString, params);
}

function logDbError(error: any) {
  const now = Date.now();
  if (now - lastLogTime > 5000) {
    console.error(`[Database] Connection Error:`, error?.message || error);
    lastLogTime = now;
  }
}

export { sql };

