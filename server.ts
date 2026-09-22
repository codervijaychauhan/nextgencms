import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import crypto from "crypto";
import { initializeApp, getApps } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { createRequire } from "module";
import { query, execute } from "./src/server/db";

const require = createRequire(import.meta.url);
const firebaseConfig = require("./firebase-applet-config.json");

// Initialize Firebase Admin for verifying Google / Firebase Auth ID tokens
if (getApps().length === 0) {
  initializeApp({
    projectId: firebaseConfig.projectId,
  });
}

const auth = getAuth();

const JWT_SECRET = process.env.JWT_SECRET || 'nextgen_cms_secure_secret_2026';

function hashPassword(password: string): string {
  return crypto.createHmac('sha256', JWT_SECRET).update(password).digest('hex');
}

function generateLocalToken(payload: { uid: string; email: string; name: string; role?: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60 })).toString('base64url');
  const signature = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  return `local.${header}.${data}.${signature}`;
}

function sanitizeError(error: any): string {
  if (!error) return 'An unexpected error occurred.';
  const msg = error instanceof Error ? error.message : String(error);
  
  if (msg.includes('Login failed') || msg.includes('ELOGIN') || msg.includes('login failed') || msg.includes('election_user')) {
    return 'Database connection failed. Please ensure SQL Server is running and credentials are valid.';
  }
  if (msg.includes('ConnectionError') || msg.includes('ESOCKET') || msg.includes('ETIMEOUT') || msg.includes('ECONNREFUSED') || msg.includes('service unavailable')) {
    return 'Database service is temporarily unavailable. Please verify local database status.';
  }
  if (msg.includes('Invalid object name') || msg.includes('dbo.') || msg.includes('Cannot find table')) {
    return 'Database table not found. Please execute the SQL setup script in SSMS.';
  }
  if (msg.includes('duplicate key') || msg.includes('PRIMARY KEY') || msg.includes('UNIQUE')) {
    return 'A record with this identifier already exists.';
  }
  if (msg.includes('REFERENCE') || msg.includes('FOREIGN KEY')) {
    return 'Cannot complete operation because related records exist.';
  }
  if (msg.includes('node_modules') || msg.includes('tedious') || msg.includes('SELECT ') || msg.includes('INSERT ') || msg.includes('UPDATE ') || msg.includes('DELETE ')) {
    return 'Unable to process database request at this time.';
  }

  return msg;
}

function verifyLocalToken(token: string): any {
  if (!token.startsWith('local.')) return null;
  const parts = token.slice(6).split('.');
  if (parts.length !== 3) return null;
  const [header, data, sig] = parts;
  const expectedSig = crypto.createHmac('sha256', JWT_SECRET).update(`${header}.${data}`).digest('base64url');
  if (sig !== expectedSig) return null;
  const payload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

function buildSafeInClause(
  rawVal: any,
  colPrefix: string,
  colExprs: string[],
  params: Record<string, any>
): string | null {
  if (!rawVal || rawVal === 'all') return null;
  const items = String(rawVal).split(',').map((s: string) => s.trim()).filter(Boolean);
  if (items.length === 0) return null;
  const paramNames = items.map((val: string, idx: number) => {
    const pName = `${colPrefix}_${idx}`;
    params[pName] = val;
    return `@${pName}`;
  });
  const inList = paramNames.join(', ');
  const orParts = colExprs.map(expr => `CAST(${expr} AS NVARCHAR(64)) IN (${inList})`);
  return orParts.length === 1 ? orParts[0] : `(${orParts.join(' OR ')})`;
}

async function getRequesterInfo(reqUser: any): Promise<{ isSuperAdmin: boolean; userRow: any }> {
  if (!reqUser) {
    return { isSuperAdmin: false, userRow: null };
  }

  const email = (reqUser.email || '').toLowerCase().trim();
  const uid = reqUser.uid || reqUser.user_id || reqUser.id || '';

  // 1. Check if root super admin by owner email
  if (email === 'vijaychauhanofficial01@gmail.com') {
    return { isSuperAdmin: true, userRow: null };
  }

  // 2. Query user from database by email or id
  let userRow: any = null;
  if (email || uid) {
    try {
      const rows = await query(
        `SELECT TOP 1 * FROM dbo.users WHERE (LOWER(email) = @email AND @email <> '') OR (id = @uid AND @uid <> '')`,
        { email, uid }
      );
      if (rows && rows.length > 0) {
        userRow = rows[0];
      }
    } catch (err) {
      console.warn('[getRequesterInfo] user query notice:', err);
    }
  }

  const role = userRow?.role || reqUser.role;
  const isSuperAdmin = role === 'super_admin' || email === 'vijaychauhanofficial01@gmail.com';

  return { isSuperAdmin, userRow };
}

// Auto-create users and user_invites tables if they don't exist
async function ensureAuthTables() {
  try {
    await execute(`
      IF OBJECT_ID(N'dbo.users', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.users (
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          password_hash VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'volunteer',
          assigned_booths NVARCHAR(MAX) NULL,
          rights NVARCHAR(MAX) DEFAULT '{}',
          state_id NVARCHAR(MAX) NULL,
          district_id NVARCHAR(MAX) NULL,
          constituency_id NVARCHAR(MAX) NULL,
          bio NVARCHAR(MAX) NULL,
          created_by NVARCHAR(255) NULL,
          disabled BIT NOT NULL DEFAULT 0,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME()
        );
        CREATE UNIQUE INDEX idx_users_email ON dbo.users(email);
      END
      ELSE
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'bio')
        BEGIN
          ALTER TABLE dbo.users ADD bio NVARCHAR(MAX) NULL;
        END
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'created_by')
        BEGIN
          ALTER TABLE dbo.users ADD created_by NVARCHAR(255) NULL;
        END
      END

      IF OBJECT_ID(N'dbo.user_invites', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.user_invites (
          id VARCHAR(64) NOT NULL PRIMARY KEY,
          email VARCHAR(255) NOT NULL,
          name VARCHAR(255) NOT NULL,
          role VARCHAR(50) DEFAULT 'volunteer',
          assigned_booths NVARCHAR(MAX) NULL,
          rights NVARCHAR(MAX) DEFAULT '{}',
          state_id VARCHAR(64) NULL,
          district_id VARCHAR(64) NULL,
          constituency_id VARCHAR(64) NULL,
          booth_id VARCHAR(64) NULL,
          token VARCHAR(128) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          created_by VARCHAR(64) NULL,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
          expires_at DATETIME2 NULL
        );
        CREATE INDEX idx_user_invites_email ON dbo.user_invites(email);
        CREATE INDEX idx_user_invites_token ON dbo.user_invites(token);
      END
    `);

    // Ensure all required columns exist on dbo.users for older database schemas
    await execute(`
      IF OBJECT_ID(N'dbo.users', N'U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'state_id')
          ALTER TABLE dbo.users ADD state_id NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'district_id')
          ALTER TABLE dbo.users ADD district_id NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'constituency_id')
          ALTER TABLE dbo.users ADD constituency_id NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'booth_id')
          ALTER TABLE dbo.users ADD booth_id NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'assigned_booths')
          ALTER TABLE dbo.users ADD assigned_booths NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'rights')
          ALTER TABLE dbo.users ADD rights NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'election_settings')
          ALTER TABLE dbo.users ADD election_settings NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'created_by')
          ALTER TABLE dbo.users ADD created_by NVARCHAR(255) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'disabled')
          ALTER TABLE dbo.users ADD disabled BIT NOT NULL DEFAULT 0;
      END
    `);

    // Ensure Master Global Super Admin account vijaychauhanofficial01@gmail.com exists with full permissions
    const superAdminEmail = 'vijaychauhanofficial01@gmail.com';
    const fullPermissions = JSON.stringify({
      voters: 'vcud',
      volunteers: 'vcud',
      mandals: 'vcud',
      booths: 'vcud',
      benefits: 'vcud',
      finance: 'vcud',
      whatsapp: 'vcud',
      surveys: 'vcud',
      predictions: 'vcud',
      users: 'vcud',
      survey_campaigns: 'vcud',
      demographics: 'vcud',
      elections: 'vcud'
    });

    const existingSuper = await query(`SELECT * FROM dbo.users WHERE LOWER(email) = @email`, { email: superAdminEmail });
    if (existingSuper.length === 0) {
      await execute(`
        INSERT INTO dbo.users (id, email, password_hash, name, role, assigned_booths, rights, disabled)
        VALUES ('usr_super_admin_vijay', @email, @pwd, 'Vijay Chauhan (Super Admin)', 'super_admin', '[]', @rights, 0)
      `, {
        email: superAdminEmail,
        pwd: hashPassword('Vijay@2026#GlobalAdmin'),
        rights: fullPermissions
      });
    } else {
      await execute(`
        UPDATE dbo.users 
        SET role = 'super_admin', rights = @rights, disabled = 0 
        WHERE LOWER(email) = @email
      `, {
        email: superAdminEmail,
        rights: fullPermissions
      });
    }
  } catch (err) {
    console.warn('[Database] ensureAuthTables notice:', err);
  }
}

async function ensureDemographicSchema() {
  try {
    await execute(`
      IF OBJECT_ID(N'dbo.states', N'U') IS NOT NULL AND COL_LENGTH('dbo.states', 'created_by') IS NULL
        ALTER TABLE dbo.states ADD created_by VARCHAR(128) NULL;

      IF OBJECT_ID(N'dbo.districts', N'U') IS NOT NULL AND COL_LENGTH('dbo.districts', 'created_by') IS NULL
        ALTER TABLE dbo.districts ADD created_by VARCHAR(128) NULL;

      IF OBJECT_ID(N'dbo.constituencies', N'U') IS NOT NULL AND COL_LENGTH('dbo.constituencies', 'created_by') IS NULL
        ALTER TABLE dbo.constituencies ADD created_by VARCHAR(128) NULL;

      IF OBJECT_ID(N'dbo.mandals', N'U') IS NOT NULL AND COL_LENGTH('dbo.mandals', 'created_by') IS NULL
        ALTER TABLE dbo.mandals ADD created_by VARCHAR(128) NULL;

      IF OBJECT_ID(N'dbo.booths', N'U') IS NOT NULL AND COL_LENGTH('dbo.booths', 'created_by') IS NULL
        ALTER TABLE dbo.booths ADD created_by VARCHAR(128) NULL;

      IF OBJECT_ID(N'dbo.voters', N'U') IS NOT NULL AND COL_LENGTH('dbo.voters', 'created_by') IS NULL
        ALTER TABLE dbo.voters ADD created_by VARCHAR(128) NULL;

      IF OBJECT_ID(N'dbo.voters', N'U') IS NOT NULL AND COL_LENGTH('dbo.voters', 'aadhar_number') IS NULL
        ALTER TABLE dbo.voters ADD aadhar_number VARCHAR(50) NULL;

      -- Drop any legacy foreign keys on voter/survey/sentiment/volunteer tables that block column altering
      DECLARE @dropSql NVARCHAR(MAX) = N'';
      
      SELECT @dropSql += N'ALTER TABLE ' + QUOTENAME(OBJECT_SCHEMA_NAME(parent_object_id)) + '.' + QUOTENAME(OBJECT_NAME(parent_object_id)) + ' DROP CONSTRAINT ' + QUOTENAME(name) + ';' + CHAR(10)
      FROM sys.foreign_keys
      WHERE parent_object_id IN (
        OBJECT_ID('dbo.voter_sentiments'),
        OBJECT_ID('dbo.volunteers'),
        OBJECT_ID('dbo.benefits'),
        OBJECT_ID('dbo.booth_agents'),
        OBJECT_ID('dbo.mandal_members'),
        OBJECT_ID('dbo.voters')
      );

      -- Drop any legacy non-primary key indexes on demographic ID columns
      SELECT @dropSql += N'DROP INDEX ' + QUOTENAME(i.name) + N' ON ' + QUOTENAME(OBJECT_SCHEMA_NAME(i.object_id)) + '.' + QUOTENAME(OBJECT_NAME(i.object_id)) + ';' + CHAR(10)
      FROM sys.indexes i
      JOIN sys.index_columns ic ON i.object_id = ic.object_id AND i.index_id = ic.index_id
      JOIN sys.columns c ON ic.object_id = c.object_id AND ic.column_id = c.column_id
      WHERE i.object_id IN (
        OBJECT_ID('dbo.voter_sentiments'),
        OBJECT_ID('dbo.volunteers'),
        OBJECT_ID('dbo.benefits'),
        OBJECT_ID('dbo.booth_agents'),
        OBJECT_ID('dbo.mandal_members'),
        OBJECT_ID('dbo.voters')
      ) AND c.name IN ('voter_id', 'voter_doc_id', 'witness_voter_doc_id', 'witness_voter_id', 'agent_volunteer_id', 'election_id', 'favored_party_id', 'booth_id', 'mandal_id', 'constituency_id', 'state_id', 'district_id')
        AND i.is_primary_key = 0;

      IF LEN(@dropSql) > 0
      BEGIN
        BEGIN TRY
          EXEC sp_executesql @dropSql;
        END TRY
        BEGIN CATCH END CATCH
      END

      -- Ensure columns exist and are typed as VARCHAR
      IF OBJECT_ID(N'dbo.voter_sentiments', N'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('dbo.voter_sentiments', 'survey_id') IS NULL
          ALTER TABLE dbo.voter_sentiments ADD survey_id VARCHAR(64) NULL;
        IF COL_LENGTH('dbo.voter_sentiments', 'survey_title') IS NULL
          ALTER TABLE dbo.voter_sentiments ADD survey_title VARCHAR(255) NULL;
        IF COL_LENGTH('dbo.voter_sentiments', 'custom_answers') IS NULL
          ALTER TABLE dbo.voter_sentiments ADD custom_answers NVARCHAR(MAX) NULL;
        IF COL_LENGTH('dbo.voter_sentiments', 'state_id') IS NULL
          ALTER TABLE dbo.voter_sentiments ADD state_id VARCHAR(64) NULL;
        IF COL_LENGTH('dbo.voter_sentiments', 'district_id') IS NULL
          ALTER TABLE dbo.voter_sentiments ADD district_id VARCHAR(64) NULL;
        IF COL_LENGTH('dbo.voter_sentiments', 'booth_id') IS NULL
          ALTER TABLE dbo.voter_sentiments ADD booth_id VARCHAR(64) NULL;
        IF COL_LENGTH('dbo.voter_sentiments', 'mobile') IS NULL
          ALTER TABLE dbo.voter_sentiments ADD mobile VARCHAR(50) NULL;
        IF COL_LENGTH('dbo.voter_sentiments', 'email') IS NULL
          ALTER TABLE dbo.voter_sentiments ADD email VARCHAR(255) NULL;
        IF COL_LENGTH('dbo.voter_sentiments', 'aadhar_number') IS NULL
          ALTER TABLE dbo.voter_sentiments ADD aadhar_number VARCHAR(50) NULL;

        BEGIN TRY ALTER TABLE dbo.voter_sentiments ALTER COLUMN favored_party_id VARCHAR(64) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.voter_sentiments ALTER COLUMN voter_id VARCHAR(128) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.voter_sentiments ALTER COLUMN election_id VARCHAR(64) NULL; END TRY BEGIN CATCH END CATCH
      END

      IF OBJECT_ID(N'dbo.volunteers', N'U') IS NOT NULL
      BEGIN
        BEGIN TRY ALTER TABLE dbo.volunteers ALTER COLUMN voter_doc_id VARCHAR(128) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.volunteers ALTER COLUMN voter_id VARCHAR(128) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.volunteers ALTER COLUMN assigned_booth_id VARCHAR(64) NULL; END TRY BEGIN CATCH END CATCH
      END

      IF OBJECT_ID(N'dbo.benefits', N'U') IS NOT NULL
      BEGIN
        BEGIN TRY ALTER TABLE dbo.benefits ALTER COLUMN voter_doc_id VARCHAR(128) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.benefits ALTER COLUMN voter_id VARCHAR(128) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.benefits ALTER COLUMN witness_voter_doc_id VARCHAR(128) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.benefits ALTER COLUMN witness_voter_id VARCHAR(128) NULL; END TRY BEGIN CATCH END CATCH
      END

      IF OBJECT_ID(N'dbo.booth_agents', N'U') IS NOT NULL
      BEGIN
        BEGIN TRY ALTER TABLE dbo.booth_agents ALTER COLUMN agent_volunteer_id VARCHAR(128) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.booth_agents ALTER COLUMN booth_id VARCHAR(64) NULL; END TRY BEGIN CATCH END CATCH
      END

      IF OBJECT_ID(N'dbo.mandal_members', N'U') IS NOT NULL
      BEGIN
        BEGIN TRY ALTER TABLE dbo.mandal_members ALTER COLUMN voter_id VARCHAR(128) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.mandal_members ALTER COLUMN mandal_id VARCHAR(64) NULL; END TRY BEGIN CATCH END CATCH
      END

      IF OBJECT_ID(N'dbo.voters', N'U') IS NOT NULL
      BEGIN
        BEGIN TRY ALTER TABLE dbo.voters ALTER COLUMN voter_id VARCHAR(128) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.voters ALTER COLUMN booth_id VARCHAR(64) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.voters ALTER COLUMN mandal_id VARCHAR(64) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.voters ALTER COLUMN constituency_id VARCHAR(64) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.voters ALTER COLUMN state_id VARCHAR(64) NULL; END TRY BEGIN CATCH END CATCH
        BEGIN TRY ALTER TABLE dbo.voters ALTER COLUMN district_id VARCHAR(64) NULL; END TRY BEGIN CATCH END CATCH
      END
    `);
  } catch (err) {
    console.warn('[Database] ensureDemographicSchema notice:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Run schema checks on startup
  ensureAuthTables().catch(() => {});
  ensureDemographicSchema().catch(() => {});

  // Middleware to authenticate requests via Firebase ID Token or Local Token
  const authenticateUser = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split('Bearer ')[1];

    // 1. Try local server token
    const localUser = verifyLocalToken(token);
    if (localUser) {
      (req as any).user = localUser;
      return next();
    }

    // 2. Try Firebase ID Token
    try {
      const decodedToken = await auth.verifyIdToken(token);
      (req as any).user = decodedToken;
      return next();
    } catch (firebaseErr: unknown) {
      // 3. Fallback JWT decode
      try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
          if (decoded.user_id || decoded.sub || decoded.email) {
            (req as any).user = {
              uid: decoded.user_id || decoded.sub,
              email: decoded.email,
              name: decoded.name || decoded.displayName || decoded.email?.split('@')[0] || 'User',
              picture: decoded.picture
            };
            return next();
          }
        }
      } catch {}

      const errorMessage = firebaseErr instanceof Error ? firebaseErr.message : String(firebaseErr);
      return res.status(401).json({ error: `Unauthorized: ${errorMessage}` });
    }
  };

  // Optional authentication for public/open endpoints or fallback
  const optionalAuth = async (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split('Bearer ')[1];
      const localUser = verifyLocalToken(token);
      if (localUser) {
        (req as any).user = localUser;
      } else {
        try {
          const decodedToken = await auth.verifyIdToken(token);
          (req as any).user = decodedToken;
        } catch {
          try {
            const payloadBase64 = token.split('.')[1];
            if (payloadBase64) {
              const decoded = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
              (req as any).user = {
                uid: decoded.user_id || decoded.sub,
                email: decoded.email,
                name: decoded.name || decoded.email?.split('@')[0] || 'User'
              };
            }
          } catch {}
        }
      }
    }
    next();
  };

  // ============================================================================
  // 0. Database Health Check & Diagnostics
  // ============================================================================
  app.get("/api/health/db", async (req, res) => {
    try {
      const dbInfo = await query(`
        SELECT 
          DB_NAME() as [database],
          SUSER_SNAME() as [connected_user],
          (SELECT COUNT(*) FROM dbo.users) as [total_users]
      `);

      const users = await query(`SELECT TOP 5 id, email, name, role, created_at FROM dbo.users ORDER BY created_at DESC`);

      res.json({
        status: 'CONNECTED_AND_SYNCED',
        message: 'Successfully communicating with local Microsoft SQL Server database',
        connection: dbInfo[0],
        totalUsersInDatabase: dbInfo[0]?.total_users || 0,
        recentUsers: users
      });
    } catch (err: any) {
      res.status(500).json({
        status: 'DISCONNECTED',
        message: 'Unable to communicate with local Microsoft SQL Server database',
        errorCode: err.code || 'ELOGIN',
        errorDetails: err.message?.split('\n')[0] || 'Login failed for user election_user',
        quickFixSteps: [
          "1. Open SQL Server Management Studio (SSMS).",
          "2. Connect to your SQL Server (Windows Authentication).",
          "3. Open and Execute C:\\nextgencms\\setup_nextgencms_mssql.sql",
          "4. Refresh http://localhost:3000/api/health/db"
        ]
      });
    }
  });

  // ============================================================================
  // 1. Auth & User Profile Sync with SQL Server
  // ============================================================================

  // Sync or create user profile in SQL Server on Google / Firebase login
  app.post("/api/auth/sync", authenticateUser, async (req, res) => {
    try {
      await ensureAuthTables();
      const user = (req as any).user;
      const uid = user.uid;
      const email = (user.email || '').trim().toLowerCase();
      const name = user.name || req.body.name || email.split('@')[0] || 'User';

      const existingUsers = await query(`SELECT * FROM dbo.users WHERE id = @id OR email = @email`, { id: uid, email });

      const isSuperAdmin = email === 'vijaychauhanofficial01@gmail.com';
      const defaultRights = isSuperAdmin 
        ? JSON.stringify({
            voters: 'vcud', users: 'vcud', demographics: 'vcud', elections: 'vcud',
            surveys: 'vcud', survey_campaigns: 'vcud', volunteers: 'vcud', booths: 'vcud', benefits: 'vcud',
            finance: 'vcud', whatsapp: 'vcud', mandals: 'vcud', predictions: 'vcud'
          })
        : JSON.stringify({});

      // Default role & permissions: Super Admin gets full rights, new users get 'guest' with NO permissions unless invited
      let assignedRole = isSuperAdmin ? 'super_admin' : 'guest';
      let assignedRights = isSuperAdmin ? defaultRights : '{}';
      let assignedBooths = '[]';
      let assignedStateId = null;
      let assignedDistrictId = null;
      let assignedConstituencyId = null;

      try {
        const invites = await query(`SELECT * FROM dbo.user_invites WHERE email = @email AND status = 'pending'`, { email });
        if (invites.length > 0) {
          const inv = invites[0];
          assignedRole = inv.role || assignedRole;
          assignedRights = inv.rights || assignedRights;
          assignedBooths = inv.assigned_booths || assignedBooths;
          assignedStateId = inv.state_id;
          assignedDistrictId = inv.district_id;
          assignedConstituencyId = inv.constituency_id;
          await execute(`UPDATE dbo.user_invites SET status = 'accepted' WHERE id = @id`, { id: inv.id });
        }
      } catch {}

      if (existingUsers.length === 0) {
        await execute(
          `INSERT INTO dbo.users (id, email, password_hash, name, role, assigned_booths, rights, state_id, district_id, constituency_id, disabled)
           VALUES (@id, @email, @password_hash, @name, @role, @assigned_booths, @rights, @state_id, @district_id, @constituency_id, 0)`,
          {
            id: uid,
            email,
            password_hash: hashPassword('Initial@12345'),
            name,
            role: assignedRole,
            assigned_booths: assignedBooths,
            rights: assignedRights,
            state_id: assignedStateId,
            district_id: assignedDistrictId,
            constituency_id: assignedConstituencyId
          }
        );
      } else {
        // If system owner, ensure super_admin role and full rights
        if (isSuperAdmin) {
          await execute(
            `UPDATE dbo.users SET role = 'super_admin', rights = @rights, name = @name WHERE id = @id`,
            { id: existingUsers[0].id, rights: defaultRights, name }
          );
        } else {
          await execute(
            `UPDATE dbo.users SET name = @name WHERE id = @id`,
            { id: existingUsers[0].id, name }
          );
        }
      }

      const userProfile = (await query(`SELECT * FROM dbo.users WHERE id = @id OR email = @email`, { id: uid, email }))[0];
      
      // Parse JSON fields
      let rightsObj = {};
      try { rightsObj = userProfile.rights ? JSON.parse(userProfile.rights) : {}; } catch {}
      let assignedBoothsArr = [];
      try { assignedBoothsArr = userProfile.assigned_booths ? JSON.parse(userProfile.assigned_booths) : []; } catch {}

      res.json({
        uid: userProfile.id,
        id: userProfile.id,
        username: userProfile.name,
        name: userProfile.name,
        email: userProfile.email,
        role: userProfile.role,
        permissions: rightsObj,
        rights: rightsObj,
        state_id: userProfile.state_id || '',
        district_id: userProfile.district_id || '',
        constituency_id: userProfile.constituency_id || '',
        stateId: userProfile.state_id || '',
        districtId: userProfile.district_id || '',
        constituencyId: userProfile.constituency_id || '',
        boothId: Array.isArray(assignedBoothsArr) ? assignedBoothsArr.join(',') : (userProfile.assigned_booths || ''),
        assigned_booths: assignedBoothsArr,
        bio: userProfile.bio || '',
        disabled: Boolean(userProfile.disabled),
        created_at: userProfile.created_at
      });
    } catch (error: any) {
      console.error('Error syncing auth profile in MSSQL:', error);
      const user = (req as any).user;
      const email = user?.email || '';
      const isSuperAdmin = email.toLowerCase() === 'vijaychauhanofficial01@gmail.com';
      const defaultRights = isSuperAdmin 
        ? {
            voters: 'vcud', users: 'vcud', demographics: 'vcud', elections: 'vcud',
            surveys: 'vcud', survey_campaigns: 'vcud', volunteers: 'vcud', booths: 'vcud', benefits: 'vcud',
            finance: 'vcud', whatsapp: 'vcud', mandals: 'vcud', predictions: 'vcud'
          }
        : {};
      res.json({
        uid: user?.uid || 'user',
        id: user?.uid || 'user',
        username: user?.name || email.split('@')[0] || 'User',
        name: user?.name || email.split('@')[0] || 'User',
        email: email,
        role: isSuperAdmin ? 'super_admin' : 'guest',
        permissions: defaultRights,
        rights: defaultRights,
        assigned_booths: [],
        disabled: false,
        created_at: new Date().toISOString()
      });
    }
  });

  // Local Password Login against MSSQL users table
  app.post("/api/auth/local-login", async (req, res) => {
    try {
      await ensureAuthTables();
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ error: 'Email and password are required.' });
      }

      const cleanEmail = email.trim().toLowerCase();
      const users = await query(`SELECT * FROM dbo.users WHERE email = @email`, { email: cleanEmail });
      if (users.length === 0) {
        return res.status(401).json({ error: 'No account found with this email. Please check your email or sign up.' });
      }

      const user = users[0];
      if (user.disabled) {
        return res.status(403).json({ error: 'This account has been disabled. Please contact your system administrator.' });
      }

      if (user.password_hash === 'pending_invite') {
        return res.status(401).json({ 
          error: 'Your invitation is pending password setup. Please click the invitation link sent to your email or use "Forgot Password" to set a password.' 
        });
      }

      if (user.password_hash === 'firebase_oauth') {
        return res.status(401).json({ 
          error: 'This account was registered using Google Sign-In. Please click "Continue with Google" or set a password via "Forgot Password".' 
        });
      }

      const hashed = hashPassword(password);
      const isMatch = (user.password_hash === hashed);

      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid email or password. Please verify your credentials and try again.' });
      }

      let rightsObj = {};
      try { rightsObj = user.rights ? JSON.parse(user.rights) : {}; } catch {}
      let boothsObj = [];
      try { boothsObj = user.assigned_booths ? JSON.parse(user.assigned_booths) : []; } catch {}

      const token = generateLocalToken({
        uid: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      });

      res.json({
        success: true,
        token,
        user: {
          uid: user.id,
          id: user.id,
          username: user.name,
          name: user.name,
          email: user.email,
          role: user.role,
          permissions: rightsObj,
          rights: rightsObj,
          assigned_booths: boothsObj,
          disabled: Boolean(user.disabled),
          created_at: user.created_at
        }
      });
    } catch (error: any) {
      console.error('Local login error:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Set / Update user password
  app.post("/api/auth/set-password", authenticateUser, async (req, res) => {
    try {
      await ensureAuthTables();
      const user = (req as any).user;
      const { password } = req.body;
      if (!password || password.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters long.' });
      }

      const hashed = hashPassword(password);
      await execute(`UPDATE dbo.users SET password_hash = @hash WHERE id = @id OR email = @email`, {
        hash: hashed,
        id: user.uid,
        email: (user.email || '').trim().toLowerCase()
      });

      res.json({ success: true, message: 'Password updated successfully in database.' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Sync password from Firebase Auth reset flow to SQL Server dbo.users table
  app.post("/api/auth/sync-password", async (req, res) => {
    try {
      await ensureAuthTables();
      const { email, password, newPassword } = req.body;
      const pwd = newPassword || password;
      if (!email || !pwd || pwd.length < 6) {
        return res.status(400).json({ error: 'Valid email and password (min 6 characters) are required.' });
      }

      const cleanEmail = String(email).trim().toLowerCase();
      const hashed = hashPassword(pwd);

      const existing = await query(`SELECT * FROM dbo.users WHERE email = @email`, { email: cleanEmail });
      if (existing.length > 0) {
        await execute(`UPDATE dbo.users SET password_hash = @hash WHERE email = @email`, {
          hash: hashed,
          email: cleanEmail
        });
      } else {
        const newId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await execute(
          `INSERT INTO dbo.users (id, email, password_hash, name, role, assigned_booths, rights, disabled)
           VALUES (@id, @email, @password_hash, @name, 'volunteer', '[]', '{}', 0)`,
          {
            id: newId,
            email: cleanEmail,
            password_hash: hashed,
            name: cleanEmail.split('@')[0]
          }
        );
      }

      res.json({ success: true, message: 'Password synchronized with SQL Server database.' });
    } catch (error: any) {
      console.error('Password sync error:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  const getRequesterInfo = async (reqUser: any) => {
    const reqUid = reqUser?.uid || reqUser?.user_id || reqUser?.sub || '';
    const reqEmail = (reqUser?.email || '').toLowerCase();
    const users = await query(`SELECT * FROM dbo.users WHERE id = @id OR LOWER(email) = @email`, { id: reqUid, email: reqEmail });
    const userRow = users[0];
    const role = userRow?.role || 'guest';
    const isSuperAdmin = role === 'super_admin' || reqEmail === 'vijaychauhanofficial01@gmail.com';
    const isAdmin = isSuperAdmin || role === 'admin' || role === 'manager';
    return { reqUid, reqEmail, userRow, role, isSuperAdmin, isAdmin };
  };

  // Admin Manual Password Reset (updates both Firebase Auth and SQL Server dbo.users)
  const handleAdminResetPassword = async (req: any, res: any) => {
    try {
      await ensureAuthTables();
      const caller = req.user;
      const { reqUid, reqEmail, isSuperAdmin, isAdmin } = await getRequesterInfo(caller);

      if (!isAdmin && !isSuperAdmin) {
        return res.status(403).json({ error: 'Forbidden: Admin or Super Admin privileges required.' });
      }

      const { uid, id, email, newPassword, password } = req.body;
      const pwd = newPassword || password;

      if (!pwd || typeof pwd !== 'string' || pwd.length < 6) {
        return res.status(400).json({ error: 'New password must be at least 6 characters long.' });
      }

      const targetIdentifier = uid || id || email;
      if (!targetIdentifier) {
        return res.status(400).json({ error: 'User UID or email is required.' });
      }

      // Find user in dbo.users
      const users = await query(
        `SELECT * FROM dbo.users WHERE id = @target OR email = @target`,
        { target: targetIdentifier }
      );

      const targetUser = users.length > 0 ? users[0] : null;
      if (targetUser && (targetUser.role === 'super_admin' || targetUser.email?.toLowerCase() === 'vijaychauhanofficial01@gmail.com') && !isSuperAdmin) {
        return res.status(403).json({ error: 'Security Violation: Only Super Admin can reset Super Admin passwords.' });
      }

      const targetEmail = targetUser ? targetUser.email : (email || null);
      const targetId = targetUser ? targetUser.id : (uid || id || null);

      // 1. Update in Firebase Auth
      let fbUpdated = false;
      try {
        if (targetId && !targetId.startsWith('usr_')) {
          await auth.updateUser(targetId, { password: pwd });
          fbUpdated = true;
        } else if (targetEmail) {
          try {
            const fbUser = await auth.getUserByEmail(targetEmail);
            await auth.updateUser(fbUser.uid, { password: pwd });
            fbUpdated = true;
          } catch (getErr: any) {
            if (getErr.code === 'auth/user-not-found') {
              await auth.createUser({
                email: targetEmail,
                password: pwd,
                displayName: targetUser?.name || targetEmail.split('@')[0]
              });
              fbUpdated = true;
            }
          }
        }
      } catch (fbErr) {
        console.warn('[Firebase Admin] Warning updating user password in Firebase:', fbErr);
      }

      // 2. Update in SQL Server dbo.users
      const hashed = hashPassword(pwd);
      if (targetEmail || targetId) {
        await execute(`UPDATE dbo.users SET password_hash = @hash WHERE email = @email OR id = @id`, {
          hash: hashed,
          email: targetEmail || '',
          id: targetId || ''
        });
      }

      res.json({ 
        success: true, 
        message: fbUpdated 
          ? 'Password updated in both Firebase Auth and SQL Server database.' 
          : 'Password updated in SQL Server database.' 
      });
    } catch (error: any) {
      console.error('Admin reset password error:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  };

  app.post("/api/admin/reset-password", authenticateUser, handleAdminResetPassword);
  app.post("/api/users/reset-password", authenticateUser, handleAdminResetPassword);

  // Invite User & Generate Invite Link
  app.post("/api/users/invite", authenticateUser, async (req, res) => {
    try {
      await ensureAuthTables();
      const sender = (req as any).user;
      const { reqUid, reqEmail, isSuperAdmin, isAdmin, userRow } = await getRequesterInfo(sender);
      let senderPerms: Record<string, string> = {};
      try { senderPerms = userRow?.rights ? (typeof userRow.rights === 'string' ? JSON.parse(userRow.rights) : userRow.rights) : {}; } catch {}
      const hasUserCreate = isAdmin || (senderPerms['users'] && senderPerms['users'].includes('c'));
      
      if (!hasUserCreate) {
        return res.status(403).json({ error: 'Forbidden: Insufficient privileges to invite users.' });
      }

      const { 
        name, 
        email, 
        role = 'volunteer', 
        permissions = {}, 
        rights = {}, 
        assigned_booths = [],
        state_id = null,
        district_id = null,
        constituency_id = null,
        booth_id = null
      } = req.body;

      if (!email || !name) {
        return res.status(400).json({ error: 'Name and email are required to generate an invitation.' });
      }

      const cleanEmail = email.trim().toLowerCase();

      // Regular Admin cannot assign Super Admin or Admin roles
      let targetRole = role;
      if (!isSuperAdmin && (targetRole === 'super_admin' || targetRole === 'admin')) {
        return res.status(403).json({ error: 'Only Super Admin can assign Admin or Super Admin roles.' });
      }

      // Filter permissions: Regular Admin cannot grant admin-related module rights
      let safePermissions = { ...(permissions || rights || {}) };
      if (!isSuperAdmin) {
        const adminModules = ['users', 'survey_campaigns', 'demographics', 'elections'];
        adminModules.forEach(m => delete safePermissions[m]);
      }

      const token = Buffer.from(crypto.randomBytes(24)).toString('hex');
      const inviteId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const rightsJson = JSON.stringify(safePermissions);
      const assignedBoothsJson = JSON.stringify(assigned_booths || (booth_id ? [booth_id] : []));
      const creatorIdentifier = reqUid || reqEmail || sender.uid || sender.email;

      // 1. Ensure user exists in Firebase Auth so password reset & invitations work seamlessly
      let firebaseUid = null;
      let firebaseResetLink = null;
      try {
        let fbUser;
        try {
          fbUser = await auth.getUserByEmail(cleanEmail);
        } catch (err: any) {
          if (err.code === 'auth/user-not-found') {
            fbUser = await auth.createUser({
              email: cleanEmail,
              displayName: name,
              emailVerified: false
            });
          }
        }
        if (fbUser) {
          firebaseUid = fbUser.uid;
          try {
            const host = req.get('host') || 'localhost:3000';
            const protocol = req.protocol || 'http';
            const actionCodeSettings = {
              url: `${protocol}://${host}/reset-password`,
              handleCodeInApp: true
            };
            firebaseResetLink = await auth.generatePasswordResetLink(cleanEmail, actionCodeSettings);
          } catch {
            try {
              firebaseResetLink = await auth.generatePasswordResetLink(cleanEmail);
            } catch {}
          }
        }
      } catch (fbErr) {
        console.warn('[Firebase Admin] Warning pre-creating user in Firebase Auth:', fbErr);
      }

      // 2. Insert invite in SQL Server
      await execute(`
        INSERT INTO dbo.user_invites (id, email, name, role, assigned_booths, rights, state_id, district_id, constituency_id, booth_id, token, status, created_by)
        VALUES (@id, @email, @name, @role, @assigned_booths, @rights, @state_id, @district_id, @constituency_id, @booth_id, @token, 'pending', @created_by)
      `, {
        id: inviteId,
        email: cleanEmail,
        name,
        role: targetRole,
        assigned_booths: assignedBoothsJson,
        rights: rightsJson,
        state_id,
        district_id,
        constituency_id,
        booth_id,
        token,
        created_by: creatorIdentifier
      });

      // 3. Create or update user in dbo.users
      const existingUser = await query(`SELECT * FROM dbo.users WHERE LOWER(email) = @email`, { email: cleanEmail });
      const finalUserId = firebaseUid || (existingUser.length > 0 ? existingUser[0].id : `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

      if (existingUser.length === 0) {
        await execute(`
          INSERT INTO dbo.users (id, email, password_hash, name, role, assigned_booths, rights, state_id, district_id, constituency_id, created_by, disabled)
          VALUES (@id, @email, @password_hash, @name, @role, @assigned_booths, @rights, @state_id, @district_id, @constituency_id, @created_by, 0)
        `, {
          id: finalUserId,
          email: cleanEmail,
          password_hash: 'pending_invite',
          name,
          role: targetRole,
          assigned_booths: assignedBoothsJson,
          rights: rightsJson,
          state_id,
          district_id,
          constituency_id,
          created_by: creatorIdentifier
        });
      } else {
        await execute(`
          UPDATE dbo.users 
          SET role = @role, rights = @rights, assigned_booths = @assigned_booths, state_id = @state_id, district_id = @district_id, constituency_id = @constituency_id
          WHERE LOWER(email) = @email
        `, {
          role: targetRole,
          rights: rightsJson,
          assigned_booths: assignedBoothsJson,
          state_id,
          district_id,
          constituency_id,
          email: cleanEmail
        });
      }

      const host = req.get('host') || 'localhost:3000';
      const protocol = req.protocol || 'http';
      const localInviteLink = `${protocol}://${host}/login?email=${encodeURIComponent(cleanEmail)}&invite=${token}`;
      const effectiveLink = firebaseResetLink || localInviteLink;

      res.json({
        success: true,
        message: `Invitation registered successfully for ${cleanEmail}`,
        inviteId,
        token,
        inviteLink: effectiveLink,
        localInviteLink,
        firebaseResetLink,
        email: cleanEmail,
        name,
        role: targetRole
      });
    } catch (error: any) {
      console.error('Error creating user invite:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Get current user profile
  app.get("/api/auth/me", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const reqEmail = (user.email || '').toLowerCase();
      const users = await query(`SELECT * FROM dbo.users WHERE id = @id OR LOWER(email) = @email`, { id: user.uid, email: reqEmail });
      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found in SQL database' });
      }
      const u = users[0];
      let rightsObj = {};
      try { rightsObj = u.rights ? JSON.parse(u.rights) : {}; } catch {}
      let assignedBooths = [];
      try { assignedBooths = u.assigned_booths ? JSON.parse(u.assigned_booths) : []; } catch {}
      let electionSettingsObj = {};
      try { electionSettingsObj = u.election_settings ? JSON.parse(u.election_settings) : {}; } catch {}

      res.json({
        uid: u.id,
        id: u.id,
        username: u.name,
        name: u.name,
        email: u.email,
        role: u.role,
        permissions: rightsObj,
        rights: rightsObj,
        state_id: u.state_id || '',
        district_id: u.district_id || '',
        constituency_id: u.constituency_id || '',
        stateId: u.state_id || '',
        districtId: u.district_id || '',
        constituencyId: u.constituency_id || '',
        boothId: Array.isArray(assignedBooths) ? assignedBooths.join(',') : (u.assigned_booths || ''),
        assigned_booths: assignedBooths,
        election_settings: electionSettingsObj,
        electionSettings: electionSettingsObj,
        bio: u.bio || '',
        disabled: Boolean(u.disabled),
        created_at: u.created_at
      });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // User Management CRUD
  app.get("/api/users", authenticateUser, async (req, res) => {
    try {
      const { reqUid, reqEmail, isSuperAdmin, isAdmin, userRow } = await getRequesterInfo((req as any).user);
      let permissions: Record<string, string> = {};
      try { permissions = userRow?.rights ? (typeof userRow.rights === 'string' ? JSON.parse(userRow.rights) : userRow.rights) : {}; } catch {}
      const hasUserView = isAdmin || (permissions['users'] && permissions['users'].includes('v'));

      if (!hasUserView) {
        return res.status(403).json({ error: 'Forbidden: Insufficient privileges to view users' });
      }

      let users;
      if (isSuperAdmin) {
        // Super Admin sees ALL users in the entire system
        users = await query(`SELECT id, email, name, role, rights, assigned_booths, disabled, state_id, district_id, constituency_id, booth_id, election_settings, bio, created_by, created_at FROM dbo.users ORDER BY created_at DESC`);
      } else {
        // Regular Admin sees users created by them OR subordinates (volunteers, managers, guests) - but not other admins/super admins
        users = await query(`
          SELECT id, email, name, role, rights, assigned_booths, disabled, state_id, district_id, constituency_id, booth_id, election_settings, bio, created_by, created_at 
          FROM dbo.users 
          WHERE (id = @reqUid OR LOWER(email) = @reqEmail)
             OR (created_by = @reqUid OR LOWER(created_by) = @reqEmail)
             OR (role IN ('volunteer', 'manager', 'guest') AND (created_by IS NULL OR created_by = ''))
          ORDER BY created_at DESC
        `, { reqUid, reqEmail });
      }

      const formatted = users.map(u => {
        let permissions = {};
        try { permissions = u.rights ? (typeof u.rights === 'string' ? JSON.parse(u.rights) : u.rights) : {}; } catch {}
        let assignedBooths: string[] = [];
        try { assignedBooths = u.assigned_booths ? (typeof u.assigned_booths === 'string' ? JSON.parse(u.assigned_booths) : u.assigned_booths) : []; } catch {}
        let electionSettingsObj = {};
        try { electionSettingsObj = u.election_settings ? JSON.parse(u.election_settings) : {}; } catch {}

        return {
          id: u.id,
          uid: u.id,
          email: u.email,
          username: u.name,
          name: u.name,
          role: u.role,
          permissions,
          rights: permissions,
          bio: u.bio || '',
          createdBy: u.created_by || '',
          stateId: u.state_id || '',
          districtId: u.district_id || '',
          constituencyId: u.constituency_id || '',
          boothId: Array.isArray(assignedBooths) && assignedBooths.length > 0 ? assignedBooths.join(',') : (u.booth_id || u.assigned_booths || ''),
          assigned_booths: Array.isArray(assignedBooths) ? assignedBooths : [],
          election_settings: electionSettingsObj,
          electionSettings: electionSettingsObj,
          disabled: Boolean(u.disabled),
          created_at: u.created_at
        };
      });
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/users/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { reqUid, reqEmail, isSuperAdmin, isAdmin, userRow } = await getRequesterInfo((req as any).user);
      let senderPermissions: Record<string, string> = {};
      try { senderPermissions = userRow?.rights ? (typeof userRow.rights === 'string' ? JSON.parse(userRow.rights) : userRow.rights) : {}; } catch {}
      const hasUserUpdate = isAdmin || (senderPermissions['users'] && senderPermissions['users'].includes('u'));

      if (!hasUserUpdate) {
        return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
      }

      const targetUsers = await query(`SELECT * FROM dbo.users WHERE id = @id OR LOWER(email) = LOWER(@id)`, { id });
      if (targetUsers.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const target = targetUsers[0];
      const targetId = target.id;

      // Scoping security: regular admin cannot modify other Admins or Super Admins
      if (!isSuperAdmin) {
        if ((target.role === 'super_admin' || target.role === 'admin') && target.id !== reqUid && target.email?.toLowerCase() !== reqEmail) {
          return res.status(403).json({ error: 'Only Super Admin can modify other Admin or Super Admin accounts.' });
        }
        if (req.body.role && (req.body.role === 'super_admin' || req.body.role === 'admin') && target.role !== req.body.role) {
          return res.status(403).json({ error: 'Only Super Admin can assign Admin or Super Admin roles.' });
        }
      }

      const { role, name, bio, permissions, rights, disabled, assigned_booths, state_id, district_id, constituency_id, booth_id, election_settings, electionSettings } = req.body;
      const permsData = permissions !== undefined ? permissions : rights;
      let rightsJson = null;

      if (permsData !== undefined) {
        let permsObj = typeof permsData === 'string' ? JSON.parse(permsData) : { ...permsData };
        if (!isSuperAdmin) {
          // Preserve existing admin module permissions from target user so regular admin cannot alter them
          let existingPerms: Record<string, string> = {};
          try { existingPerms = target.rights ? (typeof target.rights === 'string' ? JSON.parse(target.rights) : target.rights) : {}; } catch {}
          const adminModules = ['users', 'survey_campaigns', 'demographics', 'elections'];
          adminModules.forEach(m => {
            if (existingPerms[m]) {
              permsObj[m] = existingPerms[m];
            } else {
              delete permsObj[m];
            }
          });
        }
        rightsJson = JSON.stringify(permsObj);
      }

      const boothsData = assigned_booths !== undefined ? assigned_booths : (booth_id !== undefined ? (booth_id ? String(booth_id).split(',').map((s: string) => s.trim()).filter(Boolean) : []) : undefined);
      const assignedBoothsJson = boothsData !== undefined ? (typeof boothsData === 'string' ? boothsData : JSON.stringify(boothsData)) : null;
      const boothIdStr = booth_id !== undefined ? (booth_id || null) : (Array.isArray(boothsData) && boothsData.length > 0 ? boothsData.join(',') : null);

      // Consolidate election settings JSON
      const rawElectSettings = election_settings !== undefined ? election_settings : electionSettings;
      let electionSettingsJson: string | null = null;
      if (rawElectSettings !== undefined) {
        electionSettingsJson = typeof rawElectSettings === 'string' ? rawElectSettings : JSON.stringify(rawElectSettings);
      } else if (state_id !== undefined || district_id !== undefined || constituency_id !== undefined || booth_id !== undefined || assigned_booths !== undefined) {
        electionSettingsJson = JSON.stringify({
          state_id: state_id || null,
          district_id: district_id || null,
          constituency_id: constituency_id || null,
          booth_id: boothIdStr,
          assigned_booths: boothsData || []
        });
      }

      await execute(
        `UPDATE dbo.users 
         SET name = CASE WHEN @has_name = 1 THEN @name ELSE name END,
             role = CASE WHEN @has_role = 1 THEN @role ELSE role END,
             bio = CASE WHEN @has_bio = 1 THEN @bio ELSE bio END,
             rights = CASE WHEN @has_rights = 1 THEN @rights ELSE rights END,
             assigned_booths = CASE WHEN @has_booths = 1 THEN @assigned_booths ELSE assigned_booths END,
             booth_id = CASE WHEN @has_booths = 1 THEN @booth_id ELSE booth_id END,
             state_id = CASE WHEN @has_state = 1 THEN @state_id ELSE state_id END,
             district_id = CASE WHEN @has_district = 1 THEN @district_id ELSE district_id END,
             constituency_id = CASE WHEN @has_constituency = 1 THEN @constituency_id ELSE constituency_id END,
             election_settings = CASE WHEN @has_election_settings = 1 THEN @election_settings ELSE election_settings END,
             disabled = CASE WHEN @has_disabled = 1 THEN @disabled ELSE disabled END
         WHERE id = @targetId`,
        { 
          targetId, 
          name: name !== undefined ? String(name).trim() : null,
          has_name: name !== undefined ? 1 : 0,
          role: role !== undefined ? role : null,
          has_role: role !== undefined ? 1 : 0,
          bio: bio !== undefined ? bio : null,
          has_bio: bio !== undefined ? 1 : 0,
          rights: rightsJson,
          has_rights: rightsJson !== null ? 1 : 0,
          assigned_booths: assignedBoothsJson,
          booth_id: boothIdStr,
          has_booths: (assigned_booths !== undefined || booth_id !== undefined) ? 1 : 0,
          state_id: state_id !== undefined ? (state_id || null) : null,
          has_state: state_id !== undefined ? 1 : 0,
          district_id: district_id !== undefined ? (district_id || null) : null,
          has_district: district_id !== undefined ? 1 : 0,
          constituency_id: constituency_id !== undefined ? (constituency_id || null) : null,
          has_constituency: constituency_id !== undefined ? 1 : 0,
          election_settings: electionSettingsJson,
          has_election_settings: electionSettingsJson !== null ? 1 : 0,
          disabled: disabled !== undefined ? (disabled ? 1 : 0) : 0,
          has_disabled: disabled !== undefined ? 1 : 0
        }
      );
      res.json({ success: true, message: 'User updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/users/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { reqUid, reqEmail, isSuperAdmin, isAdmin, userRow } = await getRequesterInfo((req as any).user);
      let senderPermissions: Record<string, string> = {};
      try { senderPermissions = userRow?.rights ? (typeof userRow.rights === 'string' ? JSON.parse(userRow.rights) : userRow.rights) : {}; } catch {}
      const hasUserDelete = isAdmin || (senderPermissions['users'] && senderPermissions['users'].includes('d'));

      if (!hasUserDelete) {
        return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
      }

      const targetUsers = await query(`SELECT * FROM dbo.users WHERE id = @id`, { id });
      if (targetUsers.length === 0) {
        return res.status(404).json({ error: 'User not found' });
      }
      const target = targetUsers[0];

      if (target.email?.toLowerCase() === 'vijaychauhanofficial01@gmail.com') {
        return res.status(403).json({ error: 'Security Violation: Root Super Admin cannot be deleted.' });
      }

      if (!isSuperAdmin) {
        if (target.role === 'super_admin' || target.role === 'admin') {
          return res.status(403).json({ error: 'Only Super Admin can delete other Admin or Super Admin accounts.' });
        }
      }

      await execute(`DELETE FROM dbo.users WHERE id = @id`, { id });
      res.json({ success: true, message: 'User deleted' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // ============================================================================
  // 2. Demographics (States, Districts, Constituencies, Booths)
  // ============================================================================

  // States
  app.get("/api/states", optionalAuth, async (req, res) => {
    try {
      const states = await query(`
        SELECT s.*, 
          (SELECT COUNT(1) FROM dbo.districts d WHERE d.state_id = s.id) as districtCount 
        FROM dbo.states s 
        ORDER BY s.name ASC
      `);
      res.json(states);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/states", authenticateUser, async (req, res) => {
    try {
      const { id, name, code } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "State name is required." });
      }
      const trimmedName = String(name).trim();
      const stateCode = (code || trimmedName.substring(0, 3)).trim().toUpperCase();
      const userId = (req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || null;

      if (id && !isNaN(Number(id))) {
        await execute(`UPDATE dbo.states SET name = @name, code = @code WHERE id = @id`, { id: Number(id), name: trimmedName, code: stateCode });
        return res.json({ id: Number(id), name: trimmedName, code: stateCode });
      }
      const inserted = await query(
        `INSERT INTO dbo.states (name, code, created_by) OUTPUT INSERTED.* VALUES (@name, @code, @created_by)`, 
        { name: trimmedName, code: stateCode, created_by: userId }
      );
      res.json(inserted[0] || { name: trimmedName, code: stateCode, created_by: userId });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/states/:id", authenticateUser, async (req, res) => {
    try {
      const stateId = req.params.id;

      // 1. Unlink users and user invites referencing this state
      await execute(`UPDATE dbo.users SET state_id = NULL WHERE state_id = @stateId`, { stateId });
      await execute(`UPDATE dbo.user_invites SET state_id = NULL WHERE state_id = @stateId`, { stateId });

      // 2. Delete voter sentiments and welfare benefits for voters in this state
      await execute(`
        DELETE FROM dbo.voter_sentiments WHERE voter_id IN (
          SELECT CAST(v.id AS VARCHAR(64)) FROM dbo.voters v 
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          LEFT JOIN dbo.districts d ON v.district_id = d.id OR c.district_id = d.id
          WHERE v.state_id = @stateId OR c.state_id = @stateId OR d.state_id = @stateId
        ) OR voter_id IN (
          SELECT v.voter_id FROM dbo.voters v 
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          LEFT JOIN dbo.districts d ON v.district_id = d.id OR c.district_id = d.id
          WHERE v.state_id = @stateId OR c.state_id = @stateId OR d.state_id = @stateId
        ) OR state_id = @stateId
      `, { stateId });

      await execute(`
        DELETE FROM dbo.benefits WHERE voter_doc_id IN (
          SELECT CAST(v.id AS VARCHAR(64)) FROM dbo.voters v 
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          LEFT JOIN dbo.districts d ON v.district_id = d.id OR c.district_id = d.id
          WHERE v.state_id = @stateId OR c.state_id = @stateId OR d.state_id = @stateId
        ) OR voter_doc_id IN (
          SELECT v.voter_id FROM dbo.voters v 
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          LEFT JOIN dbo.districts d ON v.district_id = d.id OR c.district_id = d.id
          WHERE v.state_id = @stateId OR c.state_id = @stateId OR d.state_id = @stateId
        )
      `, { stateId });

      // 3. Delete volunteers
      await execute(`
        DELETE FROM dbo.volunteers WHERE voter_doc_id IN (
          SELECT CAST(v.id AS VARCHAR(64)) FROM dbo.voters v 
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          LEFT JOIN dbo.districts d ON v.district_id = d.id OR c.district_id = d.id
          WHERE v.state_id = @stateId OR c.state_id = @stateId OR d.state_id = @stateId
        ) OR voter_doc_id IN (
          SELECT v.voter_id FROM dbo.voters v 
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          LEFT JOIN dbo.districts d ON v.district_id = d.id OR c.district_id = d.id
          WHERE v.state_id = @stateId OR c.state_id = @stateId OR d.state_id = @stateId
        )
      `, { stateId });

      // 4. Delete booth agents for booths in this state
      await execute(`
        DELETE FROM dbo.booth_agents WHERE booth_id IN (
          SELECT b.id FROM dbo.booths b
          LEFT JOIN dbo.constituencies c ON b.constituency_id = c.id
          LEFT JOIN dbo.districts d ON c.district_id = d.id
          WHERE c.state_id = @stateId OR d.state_id = @stateId
        )
      `, { stateId });

      // 5. Delete voters in this state
      await execute(`
        DELETE FROM dbo.voters WHERE id IN (
          SELECT v.id FROM dbo.voters v 
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          LEFT JOIN dbo.districts d ON v.district_id = d.id OR c.district_id = d.id
          WHERE v.state_id = @stateId OR c.state_id = @stateId OR d.state_id = @stateId
        )
      `, { stateId });

      // 6. Delete booths in this state
      await execute(`
        DELETE FROM dbo.booths WHERE id IN (
          SELECT b.id FROM dbo.booths b
          LEFT JOIN dbo.constituencies c ON b.constituency_id = c.id
          LEFT JOIN dbo.districts d ON c.district_id = d.id
          WHERE c.state_id = @stateId OR d.state_id = @stateId
        )
      `, { stateId });

      // 7. Delete mandal members in mandals of this state
      await execute(`
        DELETE FROM dbo.mandal_members WHERE mandal_id IN (
          SELECT m.id FROM dbo.mandals m
          LEFT JOIN dbo.districts d ON m.district_id = d.id
          LEFT JOIN dbo.constituencies c ON m.constituency_id = c.id
          WHERE m.state_id = @stateId OR d.state_id = @stateId OR c.state_id = @stateId
        )
      `, { stateId });

      // 8. Delete mandals in this state
      await execute(`
        DELETE FROM dbo.mandals WHERE id IN (
          SELECT m.id FROM dbo.mandals m
          LEFT JOIN dbo.districts d ON m.district_id = d.id
          LEFT JOIN dbo.constituencies c ON m.constituency_id = c.id
          WHERE m.state_id = @stateId OR d.state_id = @stateId OR c.state_id = @stateId
        )
      `, { stateId });

      // 9. Delete constituencies in this state
      await execute(`
        DELETE FROM dbo.constituencies WHERE id IN (
          SELECT c.id FROM dbo.constituencies c
          LEFT JOIN dbo.districts d ON c.district_id = d.id
          WHERE c.state_id = @stateId OR d.state_id = @stateId
        )
      `, { stateId });

      // 10. Delete districts in this state
      await execute(`DELETE FROM dbo.districts WHERE state_id = @stateId`, { stateId });

      // 11. Finally delete the state
      await execute(`DELETE FROM dbo.states WHERE id = @stateId`, { stateId });
      res.json({ success: true, message: 'State and all dependent records deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Districts
  app.get("/api/districts", optionalAuth, async (req, res) => {
    try {
      const { stateId, stateIds } = req.query;
      let sqlQuery = `
        SELECT d.*, s.name as state_name,
          (SELECT COUNT(1) FROM dbo.constituencies c WHERE c.district_id = d.id) as constituencyCount
        FROM dbo.districts d 
        LEFT JOIN dbo.states s ON d.state_id = s.id
        WHERE 1=1
      `;
      const params: Record<string, any> = {};
      const stClause = buildSafeInClause(stateId || stateIds, 'dst_st', ['d.state_id', 's.id'], params);
      if (stClause) {
        sqlQuery += ` AND ${stClause}`;
      }
      sqlQuery += ` ORDER BY d.name ASC`;
      const districts = await query(sqlQuery, params);
      res.json(districts);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/districts", authenticateUser, async (req, res) => {
    try {
      const { id, name, state_id, stateId } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "District name is required." });
      }
      const rawStateId = state_id !== undefined ? state_id : stateId;
      if (!rawStateId || isNaN(Number(rawStateId))) {
        return res.status(400).json({ error: "Please select a valid parent state for this district." });
      }
      const numStateId = Number(rawStateId);
      const trimmedName = String(name).trim();
      const userId = (req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || null;

      if (id && !isNaN(Number(id))) {
        await execute(`UPDATE dbo.districts SET name = @name, state_id = @state_id WHERE id = @id`, { id: Number(id), name: trimmedName, state_id: numStateId });
        return res.json({ id: Number(id), name: trimmedName, state_id: numStateId });
      }
      const inserted = await query(
        `INSERT INTO dbo.districts (name, state_id, created_by) OUTPUT INSERTED.* VALUES (@name, @state_id, @created_by)`,
        { name: trimmedName, state_id: numStateId, created_by: userId }
      );
      res.json(inserted[0] || { name: trimmedName, state_id: numStateId, created_by: userId });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/districts/:id", authenticateUser, async (req, res) => {
    try {
      const districtId = req.params.id;

      // 1. Unlink users and invites
      await execute(`UPDATE dbo.users SET district_id = NULL WHERE district_id = @districtId`, { districtId });
      await execute(`UPDATE dbo.user_invites SET district_id = NULL WHERE district_id = @districtId`, { districtId });

      // 2. Delete voter sentiments and benefits
      await execute(`
        DELETE FROM dbo.voter_sentiments WHERE voter_id IN (
          SELECT CAST(v.id AS VARCHAR(64)) FROM dbo.voters v
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          WHERE v.district_id = @districtId OR c.district_id = @districtId
        ) OR voter_id IN (
          SELECT v.voter_id FROM dbo.voters v
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          WHERE v.district_id = @districtId OR c.district_id = @districtId
        ) OR district_id = @districtId
      `, { districtId });

      await execute(`
        DELETE FROM dbo.benefits WHERE voter_doc_id IN (
          SELECT CAST(v.id AS VARCHAR(64)) FROM dbo.voters v
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          WHERE v.district_id = @districtId OR c.district_id = @districtId
        ) OR voter_doc_id IN (
          SELECT v.voter_id FROM dbo.voters v
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          WHERE v.district_id = @districtId OR c.district_id = @districtId
        )
      `, { districtId });

      // 3. Delete volunteers
      await execute(`
        DELETE FROM dbo.volunteers WHERE voter_doc_id IN (
          SELECT CAST(v.id AS VARCHAR(64)) FROM dbo.voters v
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          WHERE v.district_id = @districtId OR c.district_id = @districtId
        ) OR voter_doc_id IN (
          SELECT v.voter_id FROM dbo.voters v
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          WHERE v.district_id = @districtId OR c.district_id = @districtId
        )
      `, { districtId });

      // 4. Delete booth agents
      await execute(`
        DELETE FROM dbo.booth_agents WHERE booth_id IN (
          SELECT b.id FROM dbo.booths b
          LEFT JOIN dbo.constituencies c ON b.constituency_id = c.id
          WHERE c.district_id = @districtId
        )
      `, { districtId });

      // 5. Delete voters
      await execute(`
        DELETE FROM dbo.voters WHERE id IN (
          SELECT v.id FROM dbo.voters v 
          LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
          WHERE v.district_id = @districtId OR c.district_id = @districtId
        )
      `, { districtId });

      // 6. Delete booths
      await execute(`
        DELETE FROM dbo.booths WHERE id IN (
          SELECT b.id FROM dbo.booths b
          LEFT JOIN dbo.constituencies c ON b.constituency_id = c.id
          WHERE c.district_id = @districtId
        )
      `, { districtId });

      // 7. Delete mandal members
      await execute(`
        DELETE FROM dbo.mandal_members WHERE mandal_id IN (
          SELECT m.id FROM dbo.mandals m
          LEFT JOIN dbo.constituencies c ON m.constituency_id = c.id
          WHERE m.district_id = @districtId OR c.district_id = @districtId
        )
      `, { districtId });

      // 8. Delete mandals
      await execute(`
        DELETE FROM dbo.mandals WHERE id IN (
          SELECT m.id FROM dbo.mandals m
          LEFT JOIN dbo.constituencies c ON m.constituency_id = c.id
          WHERE m.district_id = @districtId OR c.district_id = @districtId
        )
      `, { districtId });

      // 9. Delete constituencies
      await execute(`DELETE FROM dbo.constituencies WHERE district_id = @districtId`, { districtId });

      // 10. Delete district
      await execute(`DELETE FROM dbo.districts WHERE id = @districtId`, { districtId });
      res.json({ success: true, message: 'District and all dependent records deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Constituencies
  app.get("/api/constituencies", optionalAuth, async (req, res) => {
    try {
      const { districtId, districtIds, stateId, stateIds } = req.query;
      let sqlQuery = `
        SELECT c.*, ISNULL(c.category, 'General') as category, d.name as district_name, s.name as state_name,
          (SELECT COUNT(1) FROM dbo.booths b WHERE b.constituency_id = c.id) as boothCount
        FROM dbo.constituencies c 
        LEFT JOIN dbo.districts d ON c.district_id = d.id
        LEFT JOIN dbo.states s ON c.state_id = s.id OR d.state_id = s.id
        WHERE 1=1
      `;
      const params: Record<string, any> = {};
      const dstClause = buildSafeInClause(districtId || districtIds, 'cst_dst', ['c.district_id', 'd.id'], params);
      if (dstClause) {
        sqlQuery += ` AND ${dstClause}`;
      }
      const stClause = buildSafeInClause(stateId || stateIds, 'cst_st', ['c.state_id', 'd.state_id', 's.id'], params);
      if (stClause) {
        sqlQuery += ` AND ${stClause}`;
      }
      sqlQuery += ` ORDER BY c.name ASC`;
      const constituencies = await query(sqlQuery, params);
      res.json(constituencies);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/constituencies", authenticateUser, async (req, res) => {
    try {
      const { id, name, district_id, state_id, districtId, stateId, category, seat_type, reservation } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Constituency name is required." });
      }
      const rawDistrictId = district_id !== undefined ? district_id : districtId;
      if (!rawDistrictId || String(rawDistrictId).trim() === '') {
        return res.status(400).json({ error: "Please select a valid parent district for this constituency." });
      }
      const finalDistrictId = !isNaN(Number(rawDistrictId)) ? Number(rawDistrictId) : String(rawDistrictId);
      const rawStateId = state_id !== undefined ? state_id : stateId;
      let finalStateId = rawStateId ? (!isNaN(Number(rawStateId)) ? Number(rawStateId) : String(rawStateId)) : null;
      
      // Auto-lookup state_id from parent district if not supplied
      if (!finalStateId && finalDistrictId) {
        const dist = await query(`SELECT state_id FROM dbo.districts WHERE id = @districtId`, { districtId: finalDistrictId });
        if (dist && dist[0] && dist[0].state_id) {
          finalStateId = dist[0].state_id;
        }
      }

      const trimmedName = String(name).trim();
      const seatCategory = String(category || seat_type || reservation || 'General').trim();
      const userId = (req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || null;
      const targetId = id !== undefined && id !== null && String(id).trim() !== '' ? id : null;

      if (targetId) {
        const parsedId = !isNaN(Number(targetId)) ? Number(targetId) : String(targetId);
        await execute(
          `UPDATE dbo.constituencies SET name = @name, district_id = @district_id, state_id = @state_id, category = @category WHERE id = @id`,
          { id: parsedId, name: trimmedName, district_id: finalDistrictId, state_id: finalStateId, category: seatCategory }
        );
        return res.json({ id: targetId, name: trimmedName, district_id: finalDistrictId, state_id: finalStateId, category: seatCategory });
      }
      const inserted = await query(
        `INSERT INTO dbo.constituencies (name, district_id, state_id, category, created_by) OUTPUT INSERTED.* VALUES (@name, @district_id, @state_id, @category, @created_by)`, 
        { name: trimmedName, district_id: finalDistrictId, state_id: finalStateId, category: seatCategory, created_by: userId }
      );
      res.json(inserted[0] || { name: trimmedName, district_id: finalDistrictId, state_id: finalStateId, category: seatCategory, created_by: userId });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/constituencies/:id", authenticateUser, async (req, res) => {
    try {
      const id = req.params.id;
      const { name, district_id, state_id, districtId, stateId, category, seat_type, reservation } = req.body;
      if (!id || String(id).trim() === '') {
        return res.status(400).json({ error: "Invalid constituency ID." });
      }
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Constituency name is required." });
      }
      const rawDistrictId = district_id !== undefined ? district_id : districtId;
      if (!rawDistrictId || String(rawDistrictId).trim() === '') {
        return res.status(400).json({ error: "Please select a valid parent district for this constituency." });
      }
      const finalDistrictId = !isNaN(Number(rawDistrictId)) ? Number(rawDistrictId) : String(rawDistrictId);
      const rawStateId = state_id !== undefined ? state_id : stateId;
      let finalStateId = rawStateId ? (!isNaN(Number(rawStateId)) ? Number(rawStateId) : String(rawStateId)) : null;
      
      if (!finalStateId && finalDistrictId) {
        const dist = await query(`SELECT state_id FROM dbo.districts WHERE id = @districtId`, { districtId: finalDistrictId });
        if (dist && dist[0] && dist[0].state_id) {
          finalStateId = dist[0].state_id;
        }
      }

      const trimmedName = String(name).trim();
      const seatCategory = String(category || seat_type || reservation || 'General').trim();
      const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);

      await execute(
        `UPDATE dbo.constituencies SET name = @name, district_id = @district_id, state_id = @state_id, category = @category WHERE id = @id`,
        { id: parsedId, name: trimmedName, district_id: finalDistrictId, state_id: finalStateId, category: seatCategory }
      );
      res.json({ id, name: trimmedName, district_id: finalDistrictId, state_id: finalStateId, category: seatCategory });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/constituencies/:id", authenticateUser, async (req, res) => {
    try {
      const constituencyId = req.params.id;

      // 1. Unlink users and invites
      await execute(`UPDATE dbo.users SET constituency_id = NULL WHERE constituency_id = @constituencyId`, { constituencyId });
      await execute(`UPDATE dbo.user_invites SET constituency_id = NULL WHERE constituency_id = @constituencyId`, { constituencyId });

      // 2. Delete sentiments and benefits
      await execute(`
        DELETE FROM dbo.voter_sentiments WHERE voter_id IN (
          SELECT CAST(id AS VARCHAR(64)) FROM dbo.voters WHERE constituency_id = @constituencyId
        ) OR voter_id IN (
          SELECT voter_id FROM dbo.voters WHERE constituency_id = @constituencyId
        ) OR constituency_id = @constituencyId
      `, { constituencyId });

      await execute(`
        DELETE FROM dbo.benefits WHERE voter_doc_id IN (
          SELECT CAST(id AS VARCHAR(64)) FROM dbo.voters WHERE constituency_id = @constituencyId
        ) OR voter_doc_id IN (
          SELECT voter_id FROM dbo.voters WHERE constituency_id = @constituencyId
        )
      `, { constituencyId });

      // 3. Delete volunteers
      await execute(`
        DELETE FROM dbo.volunteers WHERE voter_doc_id IN (
          SELECT CAST(id AS VARCHAR(64)) FROM dbo.voters WHERE constituency_id = @constituencyId
        ) OR voter_doc_id IN (
          SELECT voter_id FROM dbo.voters WHERE constituency_id = @constituencyId
        )
      `, { constituencyId });

      // 4. Delete booth agents
      await execute(`
        DELETE FROM dbo.booth_agents WHERE booth_id IN (
          SELECT id FROM dbo.booths WHERE constituency_id = @constituencyId
        )
      `, { constituencyId });

      // 5. Delete voters
      await execute(`DELETE FROM dbo.voters WHERE constituency_id = @constituencyId`, { constituencyId });

      // 6. Delete booths
      await execute(`DELETE FROM dbo.booths WHERE constituency_id = @constituencyId`, { constituencyId });

      // 7. Delete mandal members & mandals
      await execute(`
        DELETE FROM dbo.mandal_members WHERE mandal_id IN (
          SELECT id FROM dbo.mandals WHERE constituency_id = @constituencyId
        )
      `, { constituencyId });

      await execute(`DELETE FROM dbo.mandals WHERE constituency_id = @constituencyId`, { constituencyId });

      // 8. Delete constituency
      await execute(`DELETE FROM dbo.constituencies WHERE id = @constituencyId`, { constituencyId });
      res.json({ success: true, message: 'Constituency and all dependent records deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Booths
  app.get("/api/booths", optionalAuth, async (req, res) => {
    try {
      const { constituencyId, constituencyIds, mandalId, mandalIds, districtId, districtIds, stateId, stateIds } = req.query;
      let sqlQuery = `SELECT b.*, c.name as constituency_name, m.name as mandal_name, c.district_id, c.state_id 
                      FROM dbo.booths b 
                      LEFT JOIN dbo.constituencies c ON b.constituency_id = c.id
                      LEFT JOIN dbo.districts d ON c.district_id = d.id
                      LEFT JOIN dbo.mandals m ON b.mandal_id = m.id WHERE 1=1`;
      const params: Record<string, any> = {};
      const cstClause = buildSafeInClause(constituencyId || constituencyIds, 'bth_cst', ['b.constituency_id', 'c.id'], params);
      if (cstClause) sqlQuery += ` AND ${cstClause}`;
      const mndClause = buildSafeInClause(mandalId || mandalIds, 'bth_mnd', ['b.mandal_id', 'm.id'], params);
      if (mndClause) sqlQuery += ` AND ${mndClause}`;
      const dstClause = buildSafeInClause(districtId || districtIds, 'bth_dst', ['c.district_id', 'd.id'], params);
      if (dstClause) sqlQuery += ` AND ${dstClause}`;
      const stClause = buildSafeInClause(stateId || stateIds, 'bth_st', ['c.state_id', 'd.state_id'], params);
      if (stClause) sqlQuery += ` AND ${stClause}`;
      
      sqlQuery += ` ORDER BY b.booth_number ASC, b.name ASC`;
      const booths = await query(sqlQuery, params);
      res.json(booths);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/booths", authenticateUser, async (req, res) => {
    try {
      const { id, booth_number, boothNumber, name, constituency_id, constituencyId, mandal_id, mandalId, total_voters, totalVoters, address } = req.body;
      const cid = constituency_id !== undefined ? constituency_id : constituencyId;
      if (!cid || String(cid).trim() === '') {
        return res.status(400).json({ error: "Please select a valid parent constituency for this booth." });
      }
      const finalConstituencyId = !isNaN(Number(cid)) ? Number(cid) : String(cid);
      const mid = mandal_id !== undefined ? mandal_id : mandalId;
      const finalMandalId = mid && String(mid).trim() !== '' ? (!isNaN(Number(mid)) ? Number(mid) : String(mid)) : null;
      const bnum = String(booth_number !== undefined ? booth_number : (boothNumber || '1')).trim();
      const bname = String(name || `Booth #${bnum}`).trim();
      const vtotal = total_voters !== undefined ? Number(total_voters) : (Number(totalVoters) || 0);
      const userId = (req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || null;
      const targetId = id !== undefined && id !== null && String(id).trim() !== '' ? id : null;

      if (targetId) {
        const parsedId = !isNaN(Number(targetId)) ? Number(targetId) : String(targetId);
        await execute(
          `UPDATE dbo.booths 
           SET booth_number = @booth_number, name = @name, constituency_id = @constituency_id, mandal_id = @mandal_id, total_voters = @total_voters, address = @address 
           WHERE id = @id`,
          { id: parsedId, booth_number: bnum, name: bname, constituency_id: finalConstituencyId, mandal_id: finalMandalId, total_voters: vtotal, address: address || '' }
        );
        return res.json({ id: targetId, booth_number: bnum, name: bname, constituency_id: finalConstituencyId, mandal_id: finalMandalId, total_voters: vtotal, address });
      }

      const inserted = await query(
        `INSERT INTO dbo.booths (booth_number, name, constituency_id, mandal_id, total_voters, address, created_by)
         OUTPUT INSERTED.*
         VALUES (@booth_number, @name, @constituency_id, @mandal_id, @total_voters, @address, @created_by)`,
        { booth_number: bnum, name: bname, constituency_id: finalConstituencyId, mandal_id: finalMandalId, total_voters: vtotal, address: address || '', created_by: userId }
      );
      res.json(inserted[0] || { booth_number: bnum, name: bname, constituency_id: finalConstituencyId, mandal_id: finalMandalId, total_voters: vtotal, address, created_by: userId });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/booths/:id", authenticateUser, async (req, res) => {
    try {
      const id = req.params.id;
      const { booth_number, boothNumber, name, constituency_id, constituencyId, mandal_id, mandalId, total_voters, totalVoters, address } = req.body;
      if (!id || String(id).trim() === '') {
        return res.status(400).json({ error: "Invalid booth ID." });
      }
      const cid = constituency_id !== undefined ? constituency_id : constituencyId;
      if (!cid || String(cid).trim() === '') {
        return res.status(400).json({ error: "Please select a valid parent constituency for this booth." });
      }
      const finalConstituencyId = !isNaN(Number(cid)) ? Number(cid) : String(cid);
      const mid = mandal_id !== undefined ? mandal_id : mandalId;
      const finalMandalId = mid && String(mid).trim() !== '' ? (!isNaN(Number(mid)) ? Number(mid) : String(mid)) : null;
      const bnum = String(booth_number !== undefined ? booth_number : (boothNumber || '1')).trim();
      const bname = String(name || `Booth #${bnum}`).trim();
      const vtotal = total_voters !== undefined ? Number(total_voters) : (Number(totalVoters) || 0);
      const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);

      await execute(
        `UPDATE dbo.booths 
         SET booth_number = @booth_number, name = @name, constituency_id = @constituency_id, mandal_id = @mandal_id, total_voters = @total_voters, address = @address 
         WHERE id = @id`,
        { id: parsedId, booth_number: bnum, name: bname, constituency_id: finalConstituencyId, mandal_id: finalMandalId, total_voters: vtotal, address: address || '' }
      );
      res.json({ id, booth_number: bnum, name: bname, constituency_id: finalConstituencyId, mandal_id: finalMandalId, total_voters: vtotal, address });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/booths/:id", authenticateUser, async (req, res) => {
    try {
      const boothId = req.params.id;
      // 1. Delete booth agents
      await execute(`DELETE FROM dbo.booth_agents WHERE booth_id = @boothId`, { boothId });
      // 2. Unlink volunteers assigned to this booth
      await execute(`UPDATE dbo.volunteers SET assigned_booth_id = NULL, assigned_booth_name = NULL WHERE assigned_booth_id = @boothId`, { boothId });
      // 3. Delete voter sentiments, benefits, volunteers for voters in this booth
      await execute(`
        DELETE FROM dbo.voter_sentiments WHERE voter_id IN (
          SELECT CAST(id AS VARCHAR(64)) FROM dbo.voters WHERE booth_id = @boothId
        ) OR voter_id IN (
          SELECT voter_id FROM dbo.voters WHERE booth_id = @boothId
        ) OR booth_id = @boothId
      `, { boothId });
      await execute(`
        DELETE FROM dbo.benefits WHERE voter_doc_id IN (
          SELECT CAST(id AS VARCHAR(64)) FROM dbo.voters WHERE booth_id = @boothId
        ) OR voter_doc_id IN (
          SELECT voter_id FROM dbo.voters WHERE booth_id = @boothId
        )
      `, { boothId });
      await execute(`
        DELETE FROM dbo.volunteers WHERE voter_doc_id IN (
          SELECT CAST(id AS VARCHAR(64)) FROM dbo.voters WHERE booth_id = @boothId
        ) OR voter_doc_id IN (
          SELECT voter_id FROM dbo.voters WHERE booth_id = @boothId
        )
      `, { boothId });
      // 4. Delete voters in this booth
      await execute(`DELETE FROM dbo.voters WHERE booth_id = @boothId`, { boothId });
      // 5. Delete booth
      await execute(`DELETE FROM dbo.booths WHERE id = @boothId`, { boothId });
      res.json({ success: true, message: 'Booth and all dependent records deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // ============================================================================
  // 3. Mandals & Mandal Members
  // ============================================================================

  app.get("/api/mandals", optionalAuth, async (req, res) => {
    try {
      const { constituencyId, constituencyIds, districtId, districtIds, stateId, stateIds, search, adminId } = req.query;
      const caller = (req as any).user;
      let isSuperAdmin = false;
      let effectiveAdminId: string | null = null;
      if (caller) {
        const reqInfo = await getRequesterInfo(caller);
        isSuperAdmin = reqInfo.isSuperAdmin;
        effectiveAdminId = reqInfo.isSuperAdmin ? (String(adminId || '') || null) : (reqInfo.userRow?.parent_admin_id || reqInfo.reqUid);
      }

      let sqlQuery = `
        SELECT m.*, 
               c.name as constituency_name, 
               d.name as district_name, 
               s.name as state_name,
               u.name as admin_name,
               u.email as admin_email,
               (SELECT COUNT(*) FROM dbo.mandal_members mm WHERE mm.mandal_id = m.id) as member_count,
               (SELECT COUNT(*) FROM dbo.booths b WHERE b.mandal_id = m.id) as booth_count,
               (SELECT COUNT(*) FROM dbo.voters v WHERE v.mandal_id = m.id) as real_voter_count
        FROM dbo.mandals m 
        LEFT JOIN dbo.constituencies c ON m.constituency_id = c.id
        LEFT JOIN dbo.districts d ON m.district_id = d.id OR c.district_id = d.id
        LEFT JOIN dbo.states s ON m.state_id = s.id OR d.state_id = s.id OR c.state_id = s.id
        LEFT JOIN dbo.users u ON m.admin_id = u.id OR (m.admin_id IS NOT NULL AND LOWER(m.admin_id) = LOWER(u.email))
        WHERE 1=1
      `;
      const params: Record<string, any> = {};

      if (isSuperAdmin) {
        if (adminId && adminId !== 'All' && String(adminId).trim() !== '') {
          sqlQuery += ` AND (m.admin_id = @reqAdminId OR LOWER(m.admin_id) = LOWER(@reqAdminId))`;
          params.reqAdminId = String(adminId).trim();
        }
      } else if (effectiveAdminId) {
        sqlQuery += ` AND (m.admin_id = @effAdminId OR LOWER(m.admin_id) = LOWER(@effAdminId))`;
        params.effAdminId = effectiveAdminId;
      }

      const cstClause = buildSafeInClause(constituencyId || constituencyIds, 'mnd_cst', ['m.constituency_id', 'c.id'], params);
      if (cstClause) sqlQuery += ` AND ${cstClause}`;
      const dstClause = buildSafeInClause(districtId || districtIds, 'mnd_dst', ['m.district_id', 'c.district_id', 'd.id'], params);
      if (dstClause) sqlQuery += ` AND ${dstClause}`;
      const stClause = buildSafeInClause(stateId || stateIds, 'mnd_st', ['m.state_id', 'd.state_id', 'c.state_id', 's.id'], params);
      if (stClause) sqlQuery += ` AND ${stClause}`;
      if (search && String(search).trim()) {
        sqlQuery += ` AND (m.name LIKE @search OR m.mandal_code LIKE @search OR m.president_name LIKE @search)`;
        params.search = `%${String(search).trim()}%`;
      }
      sqlQuery += ` ORDER BY m.name ASC`;
      const mandals = await query(sqlQuery, params);
      res.json(mandals);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/mandals", authenticateUser, async (req, res) => {
    try {
      const caller = (req as any).user;
      const { isSuperAdmin, reqUid, userRow } = await getRequesterInfo(caller);
      const { id, name, mandal_code, mandalCode, president_name, presidentName, president_phone, presidentPhone, voter_count, voterCount, population, state_id, stateId, district_id, districtId, constituency_id, constituencyId, admin_id, adminId } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Mandal name is required." });
      }
      const mcode = (mandal_code || mandalCode || `MAN-${Date.now().toString().slice(-4)}`).trim().toUpperCase();
      const pname = president_name !== undefined ? president_name : (presidentName || '');
      const pphone = president_phone !== undefined ? president_phone : (presidentPhone || '');
      const vcount = parseInt(voter_count || voterCount, 10) || 0;
      const pop = parseInt(population, 10) || 0;
      
      const rawCid = constituency_id !== undefined ? constituency_id : constituencyId;
      const finalCid = rawCid && String(rawCid).trim() !== '' ? (!isNaN(Number(rawCid)) ? Number(rawCid) : String(rawCid)) : null;

      const rawDid = district_id !== undefined ? district_id : districtId;
      let finalDid = rawDid && String(rawDid).trim() !== '' ? (!isNaN(Number(rawDid)) ? Number(rawDid) : String(rawDid)) : null;

      const rawSid = state_id !== undefined ? state_id : stateId;
      let finalSid = rawSid && String(rawSid).trim() !== '' ? (!isNaN(Number(rawSid)) ? Number(rawSid) : String(rawSid)) : null;

      const targetAdmin = isSuperAdmin 
        ? (admin_id || adminId || reqUid) 
        : (userRow?.parent_admin_id || reqUid);

      // Auto-lookup district and state if omitted
      if (finalCid && (!finalDid || !finalSid)) {
        const cRow = await query(`SELECT district_id, state_id FROM dbo.constituencies WHERE id = @cid`, { cid: finalCid });
        if (cRow && cRow[0]) {
          if (!finalDid) finalDid = cRow[0].district_id;
          if (!finalSid) finalSid = cRow[0].state_id;
        }
      }
      if (finalDid && !finalSid) {
        const dRow = await query(`SELECT state_id FROM dbo.districts WHERE id = @did`, { did: finalDid });
        if (dRow && dRow[0]) {
          finalSid = dRow[0].state_id;
        }
      }

      const targetId = id !== undefined && id !== null && String(id).trim() !== '' ? id : null;

      if (targetId) {
        const parsedId = !isNaN(Number(targetId)) ? Number(targetId) : String(targetId);
        await execute(
          `UPDATE dbo.mandals 
           SET name = @name,
               mandal_code = @mandal_code,
               president_name = @president_name,
               president_phone = @president_phone,
               voter_count = @voter_count,
               population = @population,
               state_id = @state_id,
               district_id = @district_id,
               constituency_id = @constituency_id,
               admin_id = COALESCE(@admin_id, admin_id)
           WHERE id = @id`,
          { id: parsedId, name: String(name).trim(), mandal_code: mcode, president_name: pname, president_phone: pphone, voter_count: vcount, population: pop, state_id: finalSid, district_id: finalDid, constituency_id: finalCid, admin_id: targetAdmin }
        );
        return res.json({ id: targetId, name: String(name).trim(), mandal_code: mcode, president_name: pname, president_phone: pphone, voter_count: vcount, population: pop, state_id: finalSid, district_id: finalDid, constituency_id: finalCid, admin_id: targetAdmin });
      }

      const inserted = await query(
        `INSERT INTO dbo.mandals (name, mandal_code, president_name, president_phone, voter_count, population, state_id, district_id, constituency_id, admin_id)
         OUTPUT INSERTED.*
         VALUES (@name, @mandal_code, @president_name, @president_phone, @voter_count, @population, @state_id, @district_id, @constituency_id, @admin_id)`,
        { name: String(name).trim(), mandal_code: mcode, president_name: pname, president_phone: pphone, voter_count: vcount, population: pop, state_id: finalSid, district_id: finalDid, constituency_id: finalCid, admin_id: targetAdmin }
      );
      res.json(inserted[0] || { name: String(name).trim(), mandal_code: mcode, admin_id: targetAdmin });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/mandals/:id", authenticateUser, async (req, res) => {
    try {
      const caller = (req as any).user;
      const { isSuperAdmin, reqUid, userRow } = await getRequesterInfo(caller);
      const { id } = req.params;
      const { name, mandal_code, mandalCode, president_name, presidentName, president_phone, presidentPhone, voter_count, voterCount, population, state_id, stateId, district_id, districtId, constituency_id, constituencyId, admin_id, adminId } = req.body;
      const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);
      
      const existing = await query(`SELECT * FROM dbo.mandals WHERE id = @id`, { id: parsedId });
      if (!existing || existing.length === 0) {
        return res.status(404).json({ error: 'Mandal not found' });
      }

      const mandal = existing[0];
      const effectiveAdminId = userRow?.parent_admin_id || reqUid;
      if (!isSuperAdmin && mandal.admin_id && mandal.admin_id !== effectiveAdminId && mandal.admin_id !== reqUid) {
        return res.status(403).json({ error: 'Forbidden: You cannot modify another admin’s mandal.' });
      }

      const rawCid = constituency_id !== undefined ? constituency_id : constituencyId;
      const finalCid = rawCid && String(rawCid).trim() !== '' ? (!isNaN(Number(rawCid)) ? Number(rawCid) : String(rawCid)) : null;

      const rawDid = district_id !== undefined ? district_id : districtId;
      const finalDid = rawDid && String(rawDid).trim() !== '' ? (!isNaN(Number(rawDid)) ? Number(rawDid) : String(rawDid)) : null;

      const rawSid = state_id !== undefined ? state_id : stateId;
      const finalSid = rawSid && String(rawSid).trim() !== '' ? (!isNaN(Number(rawSid)) ? Number(rawSid) : String(rawSid)) : null;

      const targetAdmin = isSuperAdmin ? (admin_id || adminId || mandal.admin_id) : mandal.admin_id;

      await execute(
        `UPDATE dbo.mandals 
         SET name = COALESCE(NULLIF(@name, ''), name),
             mandal_code = COALESCE(NULLIF(@mandal_code, ''), mandal_code),
             president_name = @president_name,
             president_phone = @president_phone,
             voter_count = COALESCE(@voter_count, voter_count),
             population = COALESCE(@population, population),
             state_id = COALESCE(@state_id, state_id),
             district_id = COALESCE(@district_id, district_id),
             constituency_id = COALESCE(@constituency_id, constituency_id),
             admin_id = COALESCE(@admin_id, admin_id)
         WHERE id = @id`,
        { 
          id: parsedId, 
          name: name ? String(name).trim() : null, 
          mandal_code: (mandal_code || mandalCode) ? String(mandal_code || mandalCode).trim().toUpperCase() : null, 
          president_name: president_name !== undefined ? president_name : (presidentName || ''), 
          president_phone: president_phone !== undefined ? president_phone : (presidentPhone || ''), 
          voter_count: voter_count !== undefined ? parseInt(voter_count, 10) : (voterCount !== undefined ? parseInt(voterCount, 10) : null), 
          population: population !== undefined ? parseInt(population, 10) : null,
          state_id: finalSid,
          district_id: finalDid,
          constituency_id: finalCid,
          admin_id: targetAdmin
        }
      );
      res.json({ success: true, id });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/mandals/:id", authenticateUser, async (req, res) => {
    try {
      const caller = (req as any).user;
      const { isSuperAdmin, reqUid, userRow } = await getRequesterInfo(caller);
      const mandalId = req.params.id;
      const parsedId = !isNaN(Number(mandalId)) ? Number(mandalId) : String(mandalId);

      const existing = await query(`SELECT * FROM dbo.mandals WHERE id = @id`, { id: parsedId });
      if (!existing || existing.length === 0) {
        return res.status(404).json({ error: 'Mandal not found' });
      }

      const mandal = existing[0];
      const effectiveAdminId = userRow?.parent_admin_id || reqUid;
      if (!isSuperAdmin && mandal.admin_id && mandal.admin_id !== effectiveAdminId && mandal.admin_id !== reqUid) {
        return res.status(403).json({ error: 'Forbidden: You cannot delete another admin’s mandal.' });
      }

      // 1. Delete mandal members
      await execute(`DELETE FROM dbo.mandal_members WHERE mandal_id = @mandalId`, { mandalId: parsedId });
      // 2. Unlink booths and voters
      await execute(`UPDATE dbo.booths SET mandal_id = NULL WHERE mandal_id = @mandalId`, { mandalId: parsedId });
      await execute(`UPDATE dbo.voters SET mandal_id = NULL WHERE mandal_id = @mandalId`, { mandalId: parsedId });
      // 3. Delete mandal
      await execute(`DELETE FROM dbo.mandals WHERE id = @mandalId`, { mandalId: parsedId });
      res.json({ success: true, message: 'Mandal removed successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Mandal Members (Admin Scoped)
  app.get("/api/mandals/:mandalId/members", optionalAuth, async (req, res) => {
    try {
      const { mandalId } = req.params;
      const { categoryKey } = req.query;
      const parsedMandalId = !isNaN(Number(mandalId)) ? Number(mandalId) : String(mandalId);
      let sqlQuery = `SELECT * FROM dbo.mandal_members WHERE mandal_id = @mandalId`;
      const params: Record<string, any> = { mandalId: parsedMandalId };
      if (categoryKey) {
        sqlQuery += ` AND category_key = @categoryKey`;
        params.categoryKey = categoryKey;
      }
      sqlQuery += ` ORDER BY created_at DESC`;
      const members = await query(sqlQuery, params);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/mandals/:mandalId/members", authenticateUser, async (req, res) => {
    try {
      const caller = (req as any).user;
      const { isSuperAdmin, reqUid, userRow } = await getRequesterInfo(caller);
      const { mandalId } = req.params;
      const { id, name, phone, voter_id, voterId, designation, category_key, categoryKey } = req.body;
      const parsedMandalId = !isNaN(Number(mandalId)) ? Number(mandalId) : String(mandalId);
      
      const mandals = await query(`SELECT * FROM dbo.mandals WHERE id = @id`, { id: parsedMandalId });
      if (!mandals || mandals.length === 0) {
        return res.status(404).json({ error: 'Mandal not found' });
      }

      const mandal = mandals[0];
      const effectiveAdminId = userRow?.parent_admin_id || reqUid;
      if (!isSuperAdmin && mandal.admin_id && mandal.admin_id !== effectiveAdminId && mandal.admin_id !== reqUid) {
        return res.status(403).json({ error: 'Forbidden: You cannot modify members for another admin’s mandal.' });
      }

      const catKey = category_key || categoryKey || 'office_bearers';
      const vid = voter_id || voterId || '';
      const memberAdminId = mandal.admin_id || effectiveAdminId;

      if (id && String(id).trim() !== '') {
        const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);
        await execute(
          `UPDATE dbo.mandal_members 
           SET name = @name, phone = @phone, voter_id = @voter_id, designation = @designation, category_key = @category_key, admin_id = @admin_id
           WHERE id = @id`,
          { id: parsedId, name: String(name).trim(), phone: phone || '', voter_id: vid, designation: designation || '', category_key: catKey, admin_id: memberAdminId }
        );
        return res.json({ id: parsedId, mandal_id: parsedMandalId, name: String(name).trim(), category_key: catKey, admin_id: memberAdminId });
      }

      const inserted = await query(
        `INSERT INTO dbo.mandal_members (mandal_id, name, phone, voter_id, designation, category_key, admin_id)
         OUTPUT INSERTED.*
         VALUES (@mandal_id, @name, @phone, @voter_id, @designation, @category_key, @admin_id)`,
        { mandal_id: parsedMandalId, name: String(name).trim(), phone: phone || '', voter_id: vid, designation: designation || '', category_key: catKey, admin_id: memberAdminId }
      );
      res.json(inserted[0] || { mandal_id: parsedMandalId, name: String(name).trim(), category_key: catKey, admin_id: memberAdminId });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/mandals/members/:memberId", authenticateUser, async (req, res) => {
    try {
      const caller = (req as any).user;
      const { isSuperAdmin, reqUid, userRow } = await getRequesterInfo(caller);
      const { memberId } = req.params;
      const { name, phone, voter_id, voterId, designation, category_key, categoryKey } = req.body;
      const parsedId = !isNaN(Number(memberId)) ? Number(memberId) : String(memberId);

      const members = await query(`SELECT * FROM dbo.mandal_members WHERE id = @id`, { id: parsedId });
      if (!members || members.length === 0) {
        return res.status(404).json({ error: 'Member not found' });
      }

      const member = members[0];
      const effectiveAdminId = userRow?.parent_admin_id || reqUid;
      if (!isSuperAdmin && member.admin_id && member.admin_id !== effectiveAdminId && member.admin_id !== reqUid) {
        return res.status(403).json({ error: 'Forbidden: You cannot modify another admin’s mandal member.' });
      }

      const vid = voter_id || voterId || '';
      const catKey = category_key || categoryKey || 'office_bearers';

      await execute(
        `UPDATE dbo.mandal_members 
         SET name = @name, phone = @phone, voter_id = @voter_id, designation = @designation, category_key = @category_key 
         WHERE id = @id`,
        { id: parsedId, name: String(name).trim(), phone: phone || '', voter_id: vid, designation: designation || '', category_key: catKey }
      );
      res.json({ success: true, id: memberId });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/mandals/members/:memberId", authenticateUser, async (req, res) => {
    try {
      const caller = (req as any).user;
      const { isSuperAdmin, reqUid, userRow } = await getRequesterInfo(caller);
      const parsedId = !isNaN(Number(req.params.memberId)) ? Number(req.params.memberId) : String(req.params.memberId);

      const members = await query(`SELECT * FROM dbo.mandal_members WHERE id = @id`, { id: parsedId });
      if (!members || members.length === 0) {
        return res.status(404).json({ error: 'Member not found' });
      }

      const member = members[0];
      const effectiveAdminId = userRow?.parent_admin_id || reqUid;
      if (!isSuperAdmin && member.admin_id && member.admin_id !== effectiveAdminId && member.admin_id !== reqUid) {
        return res.status(403).json({ error: 'Forbidden: You cannot delete another admin’s mandal member.' });
      }

      await execute(`DELETE FROM dbo.mandal_members WHERE id = @id`, { id: parsedId });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // ============================================================================
  // 4. Voters Directory & Roster
  // ============================================================================

  app.get("/api/voters", optionalAuth, async (req, res) => {
    try {
      const { 
        boothId, mandalId, constituencyId, districtId, stateId,
        boothIds, constituencyIds, districtIds, stateIds,
        search, gender, caste, voting_status, is_karyakarta,
        page = '1', limit = '50' 
      } = req.query;

      let whereConditions: string[] = ['1=1'];
      const params: Record<string, any> = {};

      // 1. Check Authenticated User Profile & Demographic Scoping
      const reqUser = (req as any).user;
      if (reqUser) {
        const { isSuperAdmin, userRow } = await getRequesterInfo(reqUser);
        if (!isSuperAdmin && userRow) {
          let electSettings: any = {};
          try { electSettings = userRow.election_settings ? JSON.parse(userRow.election_settings) : {}; } catch {}

          const rawState = userRow.state_id || electSettings.state_id || electSettings.stateId;
          const rawDist = userRow.district_id || electSettings.district_id || electSettings.districtId;
          const rawConst = userRow.constituency_id || electSettings.constituency_id || electSettings.constituencyId;
          const rawBooth = userRow.booth_id || electSettings.booth_id || electSettings.boothId;
          const rawBooths = userRow.assigned_booths || electSettings.assigned_booths;

          const userStates = rawState ? String(rawState).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          const userDistricts = rawDist ? String(rawDist).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          const userConstituencies = rawConst ? String(rawConst).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          let userBooths: string[] = [];
          try {
            userBooths = rawBooths ? (typeof rawBooths === 'string' ? JSON.parse(rawBooths) : rawBooths) : [];
          } catch {}
          if (!Array.isArray(userBooths) || userBooths.length === 0) {
            if (rawBooth) userBooths = String(rawBooth).split(',').map((s: string) => s.trim()).filter(Boolean);
          }

          // Enforce narrowest assigned demographic level
          if (userBooths.length > 0) {
            const bClause = buildSafeInClause(userBooths.join(','), 'u_bth', ['v.booth_id', 'b.id'], params);
            if (bClause) whereConditions.push(bClause);
          } else if (userConstituencies.length > 0) {
            const cClause = buildSafeInClause(userConstituencies.join(','), 'u_cst', ['v.constituency_id', 'b.constituency_id', 'c.id'], params);
            if (cClause) whereConditions.push(cClause);
          } else if (userDistricts.length > 0) {
            const dClause = buildSafeInClause(userDistricts.join(','), 'u_dst', ['v.district_id', 'c.district_id', 'd.id'], params);
            if (dClause) whereConditions.push(dClause);
          } else if (userStates.length > 0) {
            const sClause = buildSafeInClause(userStates.join(','), 'u_st', ['v.state_id', 'c.state_id', 'd.state_id', 's.id'], params);
            if (sClause) whereConditions.push(sClause);
          }
        }
      }

      // 2. Query level filter parameters (from dropdowns or multi-selects)
      const bClause = buildSafeInClause(boothId || boothIds, 'f_bth', ['v.booth_id', 'b.id'], params);
      if (bClause) whereConditions.push(bClause);

      const mClause = buildSafeInClause(mandalId, 'f_mnd', ['v.mandal_id', 'b.mandal_id', 'm.id'], params);
      if (mClause) whereConditions.push(mClause);

      const cClause = buildSafeInClause(constituencyId || constituencyIds, 'f_cst', ['v.constituency_id', 'b.constituency_id', 'c.id'], params);
      if (cClause) whereConditions.push(cClause);

      const dClause = buildSafeInClause(districtId || districtIds, 'f_dst', ['v.district_id', 'c.district_id', 'd.id'], params);
      if (dClause) whereConditions.push(dClause);

      const sClause = buildSafeInClause(stateId || stateIds, 'f_st', ['v.state_id', 'c.state_id', 'd.state_id', 's.id'], params);
      if (sClause) whereConditions.push(sClause);

      if (gender && gender !== 'all') {
        whereConditions.push(`v.gender = @gender`);
        params.gender = gender;
      }
      if (caste && caste !== 'all') {
        whereConditions.push(`v.caste = @caste`);
        params.caste = caste;
      }
      if (voting_status && voting_status !== 'all') {
        whereConditions.push(`v.voting_status = @voting_status`);
        params.voting_status = voting_status;
      }
      if (is_karyakarta !== undefined && is_karyakarta !== '' && is_karyakarta !== 'all') {
        whereConditions.push(`v.is_karyakarta = @is_karyakarta`);
        params.is_karyakarta = is_karyakarta === 'true' || is_karyakarta === '1' ? 1 : 0;
      }
      if (search && String(search).trim()) {
        whereConditions.push(`(v.name LIKE @search OR v.voter_id LIKE @search OR v.mobile LIKE @search OR v.house_no LIKE @search OR v.village LIKE @search)`);
        params.search = `%${String(search).trim()}%`;
      }

      const whereSql = whereConditions.join(' AND ');

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total 
        FROM dbo.voters v 
        LEFT JOIN dbo.booths b ON v.booth_id = b.id
        LEFT JOIN dbo.mandals m ON v.mandal_id = m.id OR b.mandal_id = m.id
        LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id OR b.constituency_id = c.id
        LEFT JOIN dbo.districts d ON v.district_id = d.id OR c.district_id = d.id
        LEFT JOIN dbo.states s ON v.state_id = s.id OR c.state_id = s.id OR d.state_id = s.id
        WHERE ${whereSql}
      `, params);
      const total = countResult[0]?.total || 0;

      const pageNum = Math.max(1, parseInt(String(page), 10));
      const limitNum = Math.max(1, Math.min(2000, parseInt(String(limit), 10)));
      const offset = (pageNum - 1) * limitNum;

      params.offset = offset;
      params.limitNum = limitNum;

      const sqlQuery = `
        SELECT v.*, 
          b.name as booth_name, 
          b.booth_number, 
          m.name as mandal_name, 
          c.name as constituency_name,
          d.name as district_name,
          s.name as state_name
        FROM dbo.voters v
        LEFT JOIN dbo.booths b ON v.booth_id = b.id
        LEFT JOIN dbo.mandals m ON v.mandal_id = m.id OR b.mandal_id = m.id
        LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id OR b.constituency_id = c.id
        LEFT JOIN dbo.districts d ON v.district_id = d.id OR c.district_id = d.id
        LEFT JOIN dbo.states s ON v.state_id = s.id OR c.state_id = s.id OR d.state_id = s.id
        WHERE ${whereSql}
        ORDER BY v.part_no ASC, CAST(CASE WHEN ISNUMERIC(v.sr_no)=1 THEN v.sr_no ELSE 0 END AS INT) ASC, v.name ASC
        OFFSET @offset ROWS FETCH NEXT @limitNum ROWS ONLY
      `;

      const voters = await query(sqlQuery, params);

      const uniqueVotersMap = new Map<string, any>();
      for (const v of voters) {
        const key = String(v.id || v.voter_id || '');
        if (key && !uniqueVotersMap.has(key)) {
          uniqueVotersMap.set(key, v);
        } else if (!key) {
          uniqueVotersMap.set(`v_${Math.random()}`, v);
        }
      }
      const uniqueVoters = Array.from(uniqueVotersMap.values());

      res.json({
        data: uniqueVoters,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum
      });
    } catch (error: any) {
      console.error('Error fetching voters:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/voters", authenticateUser, async (req, res) => {
    try {
      const v = req.body;
      const { id } = v;
      const bid = v.booth_id !== undefined ? v.booth_id : v.boothId;
      const mid = v.mandal_id !== undefined ? v.mandal_id : v.mandalId;
      const cid = v.constituency_id !== undefined ? v.constituency_id : v.constituencyId;
      const sid = v.state_id !== undefined ? v.state_id : v.stateId;
      const did = v.district_id !== undefined ? v.district_id : v.districtId;

      if (id && String(id).trim() !== '') {
        const idParam = String(id);
        await execute(
          `UPDATE dbo.voters 
           SET voter_id = COALESCE(@voter_id, voter_id),
               name = COALESCE(@name, name),
               relation_name = COALESCE(@relation_name, relation_name),
               relation_type = COALESCE(@relation_type, relation_type),
               gender = COALESCE(@gender, gender),
               age = COALESCE(@age, age),
               mobile = COALESCE(@mobile, mobile),
               email = COALESCE(@email, email),
               address = COALESCE(@address, address),
               house_no = COALESCE(@house_no, house_no),
               village = COALESCE(@village, village),
               caste = COALESCE(@caste, caste),
               occupation = COALESCE(@occupation, occupation),
               is_karyakarta = COALESCE(@is_karyakarta, is_karyakarta),
               voting_status = COALESCE(@voting_status, voting_status),
               party_inclination = COALESCE(@party_inclination, party_inclination),
               booth_id = COALESCE(@booth_id, booth_id),
               mandal_id = COALESCE(@mandal_id, mandal_id),
               constituency_id = COALESCE(@constituency_id, constituency_id)
           WHERE voter_id = @idParam OR CAST(id AS VARCHAR(64)) = @idParam`,
          {
            idParam,
            voter_id: v.voter_id || v.voterId,
            name: v.name,
            relation_name: v.relation_name || v.relationName || '',
            relation_type: v.relation_type || v.relationType || 'Father',
            gender: v.gender || 'Male',
            age: v.age !== undefined && v.age !== null && v.age !== '' ? parseInt(String(v.age), 10) : null,
            mobile: v.mobile || '',
            email: v.email || '',
            address: v.address || '',
            house_no: v.house_no || v.houseNo || '',
            village: v.village || '',
            caste: v.caste || '',
            occupation: v.occupation || '',
            is_karyakarta: v.is_karyakarta || v.isKaryakarta ? 1 : 0,
            voting_status: v.voting_status || (v.voted ? 'voted' : 'unvoted') || 'unvoted',
            party_inclination: v.party_inclination || v.partyInclination || 'Neutral',
            booth_id: bid ? String(bid) : null,
            mandal_id: mid ? String(mid) : null,
            constituency_id: cid ? String(cid) : null
          }
        );
        return res.json({ id: idParam, ...v });
      }

      const inserted = await query(
        `INSERT INTO dbo.voters (
          voter_id, name, relation_name, relation_type, gender, age, 
          part_no, sr_no, mobile, email, address, house_no, village, 
          caste, occupation, is_karyakarta, voting_status, party_inclination, 
          booth_id, mandal_id, constituency_id, state_id, district_id
        ) 
        OUTPUT INSERTED.*
        VALUES (
          @voter_id, @name, @relation_name, @relation_type, @gender, @age,
          @part_no, @sr_no, @mobile, @email, @address, @house_no, @village,
          @caste, @occupation, @is_karyakarta, @voting_status, @party_inclination,
          @booth_id, @mandal_id, @constituency_id, @state_id, @district_id
        )`,
        {
          voter_id: v.voter_id || v.voterId || `EPIC${Date.now()}`,
          name: v.name,
          relation_name: v.relation_name || v.relationName || '',
          relation_type: v.relation_type || v.relationType || 'Father',
          gender: v.gender || 'Male',
          age: v.age !== undefined && v.age !== null && v.age !== '' ? parseInt(String(v.age), 10) : null,
          part_no: v.part_no || v.partNo || '',
          sr_no: v.sr_no || v.srNo || '',
          mobile: v.mobile || '',
          email: v.email || '',
          address: v.address || '',
          house_no: v.house_no || v.houseNo || '',
          village: v.village || '',
          caste: v.caste || '',
          occupation: v.occupation || '',
          is_karyakarta: v.is_karyakarta || v.isKaryakarta ? 1 : 0,
          voting_status: v.voting_status || (v.voted ? 'voted' : 'unvoted') || 'unvoted',
          party_inclination: v.party_inclination || v.partyInclination || 'Neutral',
          booth_id: bid ? String(bid) : null,
          mandal_id: mid ? String(mid) : null,
          constituency_id: cid ? String(cid) : null,
          state_id: sid ? String(sid) : null,
          district_id: did ? String(did) : null
        }
      );
      res.json(inserted[0] || v);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Bulk voter import (supports upsert, insert_only, update_only)
  app.post("/api/voters/bulk", authenticateUser, async (req, res) => {
    try {
      const { voters, mode = 'upsert' } = req.body;
      if (!Array.isArray(voters) || voters.length === 0) {
        return res.status(400).json({ error: 'Expected non-empty array of voters' });
      }

      let insertedCount = 0;
      let updatedCount = 0;
      let skippedCount = 0;
      let failedCount = 0;

      for (const v of voters) {
        try {
          const rawEpic = v.voter_id || v.voterId || v.epic;
          const epic = rawEpic ? String(rawEpic).trim().toUpperCase() : null;
          if (!epic) {
            skippedCount++;
            continue;
          }

          const bid = v.booth_id !== undefined ? v.booth_id : v.boothId;
          const mid = v.mandal_id !== undefined ? v.mandal_id : v.mandalId;
          const cid = v.constituency_id !== undefined ? v.constituency_id : v.constituencyId;
          const sid = v.state_id !== undefined ? v.state_id : v.stateId;
          const did = v.district_id !== undefined ? v.district_id : v.districtId;

          const userId = (req as any).user?.uid || (req as any).user?.email || 'bulk_import';
          const isKarya = (
            v.is_karyakarta === 1 || 
            v.is_karyakarta === '1' || 
            v.is_karyakarta === true || 
            v.is_karyakarta === 'true' || 
            v.is_karyakarta === 'yes' || 
            v.is_karyakarta === 'Yes' || 
            v.isKaryakarta === 1 || 
            v.isKaryakarta === true
          ) ? 1 : 0;

          const params = {
            voter_id: epic,
            name: v.name || 'Unnamed Voter',
            relation_name: v.relation_name || v.relationName || '',
            relation_type: v.relation_type || v.relationType || 'Father',
            gender: v.gender || 'Male',
            age: v.age ? parseInt(String(v.age), 10) : null,
            part_no: v.part_no || v.partNo || '',
            sr_no: v.sr_no || v.srNo || '',
            mobile: v.mobile || '',
            email: v.email || '',
            address: v.address || '',
            house_no: v.house_no || v.houseNo || '',
            village: v.village || '',
            caste: v.caste || '',
            occupation: v.occupation || '',
            is_karyakarta: isKarya,
            voting_status: v.voting_status || (v.voted ? 'voted' : 'unvoted') || 'unvoted',
            party_inclination: v.party_inclination || v.partyInclination || 'Neutral',
            booth_id: bid ? (parseInt(String(bid), 10) || bid) : null,
            mandal_id: mid ? (parseInt(String(mid), 10) || mid) : null,
            constituency_id: cid ? (parseInt(String(cid), 10) || cid) : null,
            state_id: sid ? (parseInt(String(sid), 10) || sid) : null,
            district_id: did ? (parseInt(String(did), 10) || did) : null,
            created_by: userId
          };

          const existing = await query(`SELECT id FROM dbo.voters WHERE voter_id = @voter_id`, { voter_id: epic });

          if (existing.length > 0) {
            if (mode === 'insert_only') {
              skippedCount++;
            } else {
              // Upsert or Update Only
              await execute(
                `UPDATE dbo.voters SET
                   name = COALESCE(NULLIF(@name, ''), name),
                   relation_name = CASE WHEN @relation_name <> '' THEN @relation_name ELSE relation_name END,
                   relation_type = COALESCE(NULLIF(@relation_type, ''), relation_type),
                   gender = COALESCE(NULLIF(@gender, ''), gender),
                   age = COALESCE(@age, age),
                   part_no = CASE WHEN @part_no <> '' THEN @part_no ELSE part_no END,
                   sr_no = CASE WHEN @sr_no <> '' THEN @sr_no ELSE sr_no END,
                   mobile = CASE WHEN @mobile <> '' THEN @mobile ELSE mobile END,
                   email = CASE WHEN @email <> '' THEN @email ELSE email END,
                   address = CASE WHEN @address <> '' THEN @address ELSE address END,
                   house_no = CASE WHEN @house_no <> '' THEN @house_no ELSE house_no END,
                   village = CASE WHEN @village <> '' THEN @village ELSE village END,
                   caste = CASE WHEN @caste <> '' THEN @caste ELSE caste END,
                   occupation = CASE WHEN @occupation <> '' THEN @occupation ELSE occupation END,
                   is_karyakarta = CASE WHEN @is_karyakarta IS NOT NULL THEN @is_karyakarta ELSE is_karyakarta END,
                   voting_status = COALESCE(NULLIF(@voting_status, ''), voting_status),
                   party_inclination = COALESCE(NULLIF(@party_inclination, ''), party_inclination),
                   booth_id = COALESCE(@booth_id, booth_id),
                   mandal_id = COALESCE(@mandal_id, mandal_id),
                   constituency_id = COALESCE(@constituency_id, constituency_id),
                   state_id = COALESCE(@state_id, state_id),
                   district_id = COALESCE(@district_id, district_id),
                   updated_at = SYSUTCDATETIME()
                 WHERE voter_id = @voter_id`,
                params
              );
              updatedCount++;
            }
          } else {
            if (mode === 'update_only') {
              skippedCount++;
            } else {
              // Insert new voter
              await execute(
                `INSERT INTO dbo.voters (
                   voter_id, name, relation_name, relation_type, gender, age, 
                   part_no, sr_no, mobile, email, address, house_no, village, 
                   caste, occupation, is_karyakarta, voting_status, party_inclination, 
                   booth_id, mandal_id, constituency_id, state_id, district_id, created_by
                 ) VALUES (
                   @voter_id, @name, @relation_name, @relation_type, @gender, @age,
                   @part_no, @sr_no, @mobile, @email, @address, @house_no, @village,
                   @caste, @occupation, @is_karyakarta, @voting_status, @party_inclination,
                   @booth_id, @mandal_id, @constituency_id, @state_id, @district_id, @created_by
                 )`,
                params
              );
              insertedCount++;
            }
          }
        } catch (itemErr) {
          console.warn('Skipped voter item due to error:', itemErr);
          failedCount++;
        }
      }

      res.json({ 
        success: true, 
        count: insertedCount + updatedCount, 
        inserted: insertedCount, 
        updated: updatedCount, 
        skipped: skippedCount,
        failed: failedCount 
      });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/voters/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const v = req.body;
      const idParam = String(id);
      await execute(
        `UPDATE dbo.voters 
         SET name = COALESCE(@name, name),
             relation_name = COALESCE(@relation_name, relation_name),
             gender = COALESCE(@gender, gender),
             age = COALESCE(@age, age),
             mobile = COALESCE(@mobile, mobile),
             house_no = COALESCE(@house_no, house_no),
             caste = COALESCE(@caste, caste),
             is_karyakarta = COALESCE(@is_karyakarta, is_karyakarta),
             voting_status = COALESCE(@voting_status, voting_status),
             party_inclination = COALESCE(@party_inclination, party_inclination),
             booth_id = COALESCE(@booth_id, booth_id),
             mandal_id = COALESCE(@mandal_id, mandal_id)
         WHERE voter_id = @idParam OR CAST(id AS VARCHAR(64)) = @idParam`,
        {
          idParam,
          name: v.name,
          relation_name: v.relation_name || v.relationName,
          gender: v.gender,
          age: v.age !== undefined && v.age !== null && v.age !== '' ? parseInt(String(v.age), 10) : null,
          mobile: v.mobile,
          house_no: v.house_no || v.houseNo,
          caste: v.caste,
          is_karyakarta: v.is_karyakarta !== undefined ? (v.is_karyakarta ? 1 : 0) : (v.isKaryakarta !== undefined ? (v.isKaryakarta ? 1 : 0) : null),
          voting_status: v.voting_status || (v.voted !== undefined ? (v.voted ? 'voted' : 'unvoted') : null),
          party_inclination: v.party_inclination || v.partyInclination,
          booth_id: v.booth_id ? String(v.booth_id) : (v.boothId ? String(v.boothId) : null),
          mandal_id: v.mandal_id ? String(v.mandal_id) : (v.mandalId ? String(v.mandalId) : null)
        }
      );
      res.json({ success: true, message: 'Voter updated' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/voters/:id", authenticateUser, async (req, res) => {
    try {
      const voterIdParam = String(req.params.id);
      const isNum = !isNaN(Number(voterIdParam)) && /^\d+$/.test(voterIdParam);
      if (isNum) {
        await execute(`DELETE FROM dbo.voter_sentiments WHERE voter_id = @voterId OR voter_id IN (SELECT voter_id FROM dbo.voters WHERE id = @numId)`, { voterId: voterIdParam, numId: Number(voterIdParam) });
        await execute(`DELETE FROM dbo.benefits WHERE voter_doc_id = @voterId OR voter_id = @voterId`, { voterId: voterIdParam });
        await execute(`DELETE FROM dbo.volunteers WHERE voter_doc_id = @voterId OR voter_id = @voterId`, { voterId: voterIdParam });
        await execute(`DELETE FROM dbo.voters WHERE id = @numId`, { numId: Number(voterIdParam) });
      } else {
        await execute(`DELETE FROM dbo.voter_sentiments WHERE voter_id = @voterId`, { voterId: voterIdParam });
        await execute(`DELETE FROM dbo.benefits WHERE voter_id = @voterId`, { voterId: voterIdParam });
        await execute(`DELETE FROM dbo.volunteers WHERE voter_id = @voterId`, { voterId: voterIdParam });
        await execute(`DELETE FROM dbo.voters WHERE voter_id = @voterId`, { voterId: voterIdParam });
      }
      res.json({ success: true, message: 'Voter removed successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // ============================================================================
  // 5. Volunteers / Karyakartas & Booth Agents
  // ============================================================================

  app.get("/api/volunteers", optionalAuth, async (req, res) => {
    try {
      const { status, boothId, constituencyId, districtId, stateId, search } = req.query;
      let whereConditions: string[] = ['1=1'];
      const params: Record<string, any> = {};

      // Check Authenticated User Profile & Demographic Scoping
      const reqUser = (req as any).user;
      if (reqUser) {
        const { isSuperAdmin, userRow } = await getRequesterInfo(reqUser);
        if (!isSuperAdmin && userRow) {
          const userStates = userRow.state_id ? String(userRow.state_id).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          const userDistricts = userRow.district_id ? String(userRow.district_id).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          const userConstituencies = userRow.constituency_id ? String(userRow.constituency_id).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          let userBooths: string[] = [];
          try {
            userBooths = userRow.assigned_booths ? (typeof userRow.assigned_booths === 'string' ? JSON.parse(userRow.assigned_booths) : userRow.assigned_booths) : [];
          } catch {}
          if (!Array.isArray(userBooths) || userBooths.length === 0) {
            if (userRow.booth_id) userBooths = String(userRow.booth_id).split(',').map((s: string) => s.trim()).filter(Boolean);
          }

          if (userBooths.length > 0) {
            const bClause = buildSafeInClause(userBooths.join(','), 'u_vol_bth', ['vol.assigned_booth_id', 'v.booth_id', 'b.id'], params);
            if (bClause) whereConditions.push(bClause);
          } else if (userConstituencies.length > 0) {
            const cClause = buildSafeInClause(userConstituencies.join(','), 'u_vol_cst', ['v.constituency_id'], params);
            if (cClause) whereConditions.push(cClause);
          } else if (userDistricts.length > 0) {
            const dClause = buildSafeInClause(userDistricts.join(','), 'u_vol_dst', ['v.district_id'], params);
            if (dClause) whereConditions.push(dClause);
          } else if (userStates.length > 0) {
            const sClause = buildSafeInClause(userStates.join(','), 'u_vol_st', ['v.state_id'], params);
            if (sClause) whereConditions.push(sClause);
          }
        }
      }

      if (status && status !== 'all') {
        whereConditions.push(`vol.status = @status`);
        params.status = status;
      }
      const bClause = buildSafeInClause(boothId, 'vol_bth', ['vol.assigned_booth_id', 'v.booth_id', 'b.id'], params);
      if (bClause) whereConditions.push(bClause);

      const cClause = buildSafeInClause(constituencyId, 'vol_cst', ['v.constituency_id'], params);
      if (cClause) whereConditions.push(cClause);

      const dClause = buildSafeInClause(districtId, 'vol_dst', ['v.district_id'], params);
      if (dClause) whereConditions.push(dClause);

      const sClause = buildSafeInClause(stateId, 'vol_st', ['v.state_id'], params);
      if (sClause) whereConditions.push(sClause);

      if (search && String(search).trim()) {
        whereConditions.push(`(vol.name LIKE @search OR vol.voter_id LIKE @search OR vol.mobile LIKE @search OR v.village LIKE @search)`);
        params.search = `%${String(search).trim()}%`;
      }

      const sql = `
        SELECT 
          vol.id,
          vol.voter_doc_id,
          vol.voter_id,
          vol.name,
          vol.aadhar_number,
          vol.mobile,
          vol.admin_id,
          vol.status,
          vol.tasks,
          vol.performance_rating,
          vol.assigned_booth_id,
          vol.assigned_booth_name,
          vol.created_at,
          v.gender,
          v.age,
          v.part_no,
          v.sr_no,
          v.address,
          v.house_no,
          v.village,
          v.caste,
          v.occupation,
          v.party_inclination,
          v.voting_status,
          v.state_id,
          v.district_id,
          v.constituency_id,
          v.booth_id as voter_booth_id,
          b.name as booth_name,
          b.booth_number
        FROM dbo.volunteers vol
        LEFT JOIN dbo.voters v ON CAST(vol.voter_doc_id AS VARCHAR(64)) = CAST(v.id AS VARCHAR(64))
        LEFT JOIN dbo.booths b ON (
          vol.assigned_booth_id IS NOT NULL AND CAST(vol.assigned_booth_id AS VARCHAR(64)) = CAST(b.id AS VARCHAR(64))
        ) OR (
          vol.assigned_booth_id IS NULL AND CAST(v.booth_id AS VARCHAR(64)) = CAST(b.id AS VARCHAR(64))
        )
        WHERE ${whereConditions.join(' AND ')}
        ORDER BY vol.created_at DESC
      `;

      const list = await query(sql, params);

      // Parse tasks JSON safely
      const parsed = list.map((item: any) => {
        let tasksArray: any[] = [];
        if (item.tasks) {
          if (Array.isArray(item.tasks)) {
            tasksArray = item.tasks;
          } else if (typeof item.tasks === 'string') {
            try {
              tasksArray = JSON.parse(item.tasks);
            } catch {
              tasksArray = [];
            }
          }
        }
        return {
          ...item,
          tasks: tasksArray,
          performance_rating: item.performance_rating !== null && item.performance_rating !== undefined ? Number(item.performance_rating) : 5.0
        };
      });

      res.json(parsed);
    } catch (error: any) {
      console.error('Error fetching volunteers:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/volunteers", authenticateUser, async (req, res) => {
    try {
      const v = req.body;
      const { id } = v;
      const vdocId = v.voter_doc_id || v.voterDocId;
      const abId = v.assigned_booth_id || v.assignedBoothId;
      const adminId = v.admin_id || v.adminId || (req as any).user?.uid || 'admin';

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.volunteers SET
             name = COALESCE(NULLIF(@name, ''), name),
             aadhar_number = @aadhar_number,
             mobile = @mobile,
             status = @status,
             tasks = @tasks,
             performance_rating = @performance_rating,
             assigned_booth_id = @assigned_booth_id,
             assigned_booth_name = @assigned_booth_name
           WHERE id = @id`,
          {
            id: Number(id),
            name: v.name,
            aadhar_number: v.aadhar_number || v.aadharNumber || '',
            mobile: v.mobile || '',
            status: v.status || 'Active',
            tasks: JSON.stringify(v.tasks || []),
            performance_rating: v.performance_rating !== undefined ? Number(v.performance_rating) : 5.0,
            assigned_booth_id: abId ? (parseInt(String(abId), 10) || abId) : null,
            assigned_booth_name: v.assigned_booth_name || v.assignedBoothName || ''
          }
        );

        if (vdocId) {
          await execute(`UPDATE dbo.voters SET is_karyakarta = 1 WHERE voter_id = @vdocId OR CAST(id AS VARCHAR(64)) = @vdocId`, {
            vdocId: String(vdocId)
          }).catch(() => {});
        }

        return res.json({ id: Number(id), ...v });
      }

      // Check if volunteer record already exists for this voter
      if (vdocId) {
        const existing = await query(
          `SELECT id FROM dbo.volunteers WHERE voter_doc_id = @vdocId OR voter_id = @vdocId`,
          { vdocId: String(vdocId) }
        );
        if (existing.length > 0) {
          return res.status(409).json({ error: 'This voter is already registered as a Karyakarta.' });
        }
      }

      const inserted = await query(
        `INSERT INTO dbo.volunteers (
          voter_doc_id, voter_id, name, aadhar_number, mobile, admin_id, 
          status, tasks, performance_rating, assigned_booth_id, assigned_booth_name
        ) 
        OUTPUT INSERTED.*
        VALUES (
          @voter_doc_id, @voter_id, @name, @aadhar_number, @mobile, @admin_id,
          @status, @tasks, @performance_rating, @assigned_booth_id, @assigned_booth_name
        )`,
        {
          voter_doc_id: vdocId ? String(vdocId) : null,
          voter_id: v.voter_id || v.voterId || (vdocId ? String(vdocId) : ''),
          name: v.name || 'Karyakarta',
          aadhar_number: v.aadhar_number || v.aadharNumber || '',
          mobile: v.mobile || '',
          admin_id: adminId,
          status: v.status || 'Active',
          tasks: JSON.stringify(v.tasks || []),
          performance_rating: v.performance_rating !== undefined ? Number(v.performance_rating) : 5.0,
          assigned_booth_id: abId ? String(abId) : null,
          assigned_booth_name: v.assigned_booth_name || v.assignedBoothName || ''
        }
      );

      // Sync voter is_karyakarta flag
      if (vdocId) {
        await execute(`UPDATE dbo.voters SET is_karyakarta = 1 WHERE voter_id = @vdocId OR CAST(id AS VARCHAR(64)) = @vdocId`, {
          vdocId: String(vdocId)
        }).catch(() => {});
      }

      res.json(inserted[0] || v);
    } catch (error: any) {
      console.error('Error creating volunteer:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/volunteers/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const v = req.body;
      const abId = v.assigned_booth_id !== undefined ? v.assigned_booth_id : v.assignedBoothId;

      const current = await query(`SELECT * FROM dbo.volunteers WHERE CAST(id AS VARCHAR(64)) = @id`, {
        id: String(id)
      });

      if (current.length === 0) {
        return res.status(404).json({ error: 'Karyakarta not found.' });
      }

      const curr = current[0];
      const nextTasks = v.tasks !== undefined ? JSON.stringify(v.tasks) : curr.tasks;
      const nextRating = v.performance_rating !== undefined ? Number(v.performance_rating) : (curr.performance_rating || 5.0);
      const nextStatus = v.status || curr.status || 'Active';
      const nextMobile = v.mobile !== undefined ? v.mobile : curr.mobile;
      const nextAadhar = v.aadhar_number !== undefined ? v.aadhar_number : (v.aadharNumber !== undefined ? v.aadharNumber : curr.aadhar_number);
      const nextName = v.name || curr.name;
      const nextBoothId = abId !== undefined ? (abId ? String(abId) : null) : curr.assigned_booth_id;
      const nextBoothName = v.assigned_booth_name !== undefined ? v.assigned_booth_name : (v.assignedBoothName !== undefined ? v.assignedBoothName : curr.assigned_booth_name);

      await execute(
        `UPDATE dbo.volunteers SET
           name = @name,
           aadhar_number = @aadhar_number,
           mobile = @mobile,
           status = @status,
           tasks = @tasks,
           performance_rating = @performance_rating,
           assigned_booth_id = @assigned_booth_id,
           assigned_booth_name = @assigned_booth_name
         WHERE CAST(id AS VARCHAR(64)) = @id`,
        {
          id: String(id),
          name: nextName,
          aadhar_number: nextAadhar || '',
          mobile: nextMobile || '',
          status: nextStatus,
          tasks: nextTasks,
          performance_rating: nextRating,
          assigned_booth_id: nextBoothId,
          assigned_booth_name: nextBoothName || ''
        }
      );

      res.json({ success: true, id, ...v });
    } catch (error: any) {
      console.error('Error updating volunteer:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/volunteers/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const targetId = isNaN(Number(id)) ? id : Number(id);

      // Find voter_doc_id first to reset is_karyakarta in voters table
      const vol = await query(`SELECT voter_doc_id FROM dbo.volunteers WHERE id = @id`, { id: targetId });
      
      await execute(`DELETE FROM dbo.volunteers WHERE id = @id`, { id: targetId });

      if (vol.length > 0 && vol[0].voter_doc_id) {
        const vdoc = String(vol[0].voter_doc_id);
        await execute(`UPDATE dbo.voters SET is_karyakarta = 0 WHERE CAST(id AS VARCHAR(64)) = @voterDocId OR voter_id = @voterDocId`, {
          voterDocId: vdoc
        }).catch(() => {});
      }

      res.json({ success: true });
    } catch (error: any) {
      console.error('Error deleting volunteer:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Batch recruitment directly from voter list
  app.post("/api/volunteers/batch-recruit", authenticateUser, async (req, res) => {
    try {
      const { voterDocIds, status = 'Active', assignedBoothId = null, assignedBoothName = '' } = req.body;
      if (!Array.isArray(voterDocIds) || voterDocIds.length === 0) {
        return res.status(400).json({ error: 'Expected non-empty array of voterDocIds.' });
      }

      const adminId = (req as any).user?.uid || 'admin';
      let recruitedCount = 0;
      let skippedCount = 0;

      for (const vid of voterDocIds) {
        try {
          const strVId = String(vid || '').trim();
          if (!strVId) continue;
          
          // Check if already recruited
          const existing = await query(`SELECT id FROM dbo.volunteers WHERE voter_doc_id = @vid OR voter_id = @vid`, { vid: strVId });
          if (existing.length > 0) {
            skippedCount++;
            continue;
          }

          // Fetch voter details
          const vData = await query(`SELECT id, voter_id, name, mobile, booth_id FROM dbo.voters WHERE CAST(id AS VARCHAR(64)) = @vid OR voter_id = @vid`, { vid: strVId });
          if (vData.length === 0) {
            skippedCount++;
            continue;
          }

          const voter = vData[0];
          await execute(
            `INSERT INTO dbo.volunteers (
              voter_doc_id, voter_id, name, aadhar_number, mobile, admin_id,
              status, tasks, performance_rating, assigned_booth_id, assigned_booth_name
            ) VALUES (
              @voter_doc_id, @voter_id, @name, '', @mobile, @admin_id,
              @status, '[]', 5.0, @assigned_booth_id, @assigned_booth_name
            )`,
            {
              voter_doc_id: strVId,
              voter_id: voter.voter_id || strVId,
              name: voter.name || 'Karyakarta',
              mobile: voter.mobile || '',
              admin_id: adminId,
              status,
              assigned_booth_id: assignedBoothId ? (parseInt(String(assignedBoothId), 10) || assignedBoothId) : (voter.booth_id || null),
              assigned_booth_name: assignedBoothName || ''
            }
          );

          // Update voter flag
          await execute(`UPDATE dbo.voters SET is_karyakarta = 1 WHERE CAST(id AS VARCHAR(64)) = @vid OR voter_id = @vid`, { vid: strVId });
          recruitedCount++;
        } catch (itemErr) {
          console.warn('Batch recruit item error:', itemErr);
          skippedCount++;
        }
      }

      res.json({ success: true, recruited: recruitedCount, skipped: skippedCount });
    } catch (error: any) {
      console.error('Error in batch recruitment:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Task Management Endpoints
  app.post("/api/volunteers/:id/tasks", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { title, description = '', priority = 'Medium', category = 'Voter Outreach', dueDate = '' } = req.body;

      if (!title || !title.trim()) {
        return res.status(400).json({ error: 'Task title is required.' });
      }

      const targetId = isNaN(Number(id)) ? id : Number(id);
      const rows = await query(`SELECT tasks FROM dbo.volunteers WHERE id = @id`, { id: targetId });
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Karyakarta not found.' });
      }

      let currentTasks: any[] = [];
      if (rows[0].tasks) {
        try {
          currentTasks = Array.isArray(rows[0].tasks) ? rows[0].tasks : JSON.parse(rows[0].tasks);
        } catch {
          currentTasks = [];
        }
      }

      const newTask = {
        id: `task_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        title: title.trim(),
        description: description.trim(),
        priority,
        category,
        dueDate,
        status: 'Pending',
        createdAt: new Date().toISOString()
      };

      currentTasks.unshift(newTask);

      await execute(
        `UPDATE dbo.volunteers SET tasks = @tasks WHERE id = @id`,
        { id: targetId, tasks: JSON.stringify(currentTasks) }
      );

      res.json({ success: true, task: newTask, tasks: currentTasks });
    } catch (error: any) {
      console.error('Error adding task:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/volunteers/:id/tasks/:taskId", authenticateUser, async (req, res) => {
    try {
      const { id, taskId } = req.params;
      const { status, title, description, priority, category, dueDate } = req.body;

      const targetId = isNaN(Number(id)) ? id : Number(id);
      const rows = await query(`SELECT tasks FROM dbo.volunteers WHERE id = @id`, { id: targetId });
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Karyakarta not found.' });
      }

      let currentTasks: any[] = [];
      if (rows[0].tasks) {
        try {
          currentTasks = Array.isArray(rows[0].tasks) ? rows[0].tasks : JSON.parse(rows[0].tasks);
        } catch {
          currentTasks = [];
        }
      }

      const taskIndex = currentTasks.findIndex((t: any) => t.id === taskId);
      if (taskIndex === -1) {
        return res.status(404).json({ error: 'Task not found.' });
      }

      currentTasks[taskIndex] = {
        ...currentTasks[taskIndex],
        ...(status !== undefined && { status }),
        ...(title !== undefined && { title: title.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(priority !== undefined && { priority }),
        ...(category !== undefined && { category }),
        ...(dueDate !== undefined && { dueDate }),
        updatedAt: new Date().toISOString()
      };

      await execute(
        `UPDATE dbo.volunteers SET tasks = @tasks WHERE id = @id`,
        { id: targetId, tasks: JSON.stringify(currentTasks) }
      );

      res.json({ success: true, task: currentTasks[taskIndex], tasks: currentTasks });
    } catch (error: any) {
      console.error('Error updating task:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/volunteers/:id/tasks/:taskId", authenticateUser, async (req, res) => {
    try {
      const { id, taskId } = req.params;
      const targetId = isNaN(Number(id)) ? id : Number(id);

      const rows = await query(`SELECT tasks FROM dbo.volunteers WHERE id = @id`, { id: targetId });
      if (rows.length === 0) {
        return res.status(404).json({ error: 'Karyakarta not found.' });
      }

      let currentTasks: any[] = [];
      if (rows[0].tasks) {
        try {
          currentTasks = Array.isArray(rows[0].tasks) ? rows[0].tasks : JSON.parse(rows[0].tasks);
        } catch {
          currentTasks = [];
        }
      }

      currentTasks = currentTasks.filter((t: any) => t.id !== taskId);

      await execute(
        `UPDATE dbo.volunteers SET tasks = @tasks WHERE id = @id`,
        { id: targetId, tasks: JSON.stringify(currentTasks) }
      );

      res.json({ success: true, tasks: currentTasks });
    } catch (error: any) {
      console.error('Error deleting task:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Booth Agents
  app.get("/api/booths/agents", optionalAuth, async (req, res) => {
    try {
      const agents = await query(`SELECT * FROM dbo.booth_agents ORDER BY created_at DESC`);
      res.json(agents);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/booths/agents", authenticateUser, async (req, res) => {
    try {
      const a = req.body;
      const { id } = a;
      const bId = a.booth_id || a.boothId;
      const aVolId = a.agent_volunteer_id || a.agentVolunteerDocId;

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.booth_agents SET
             designation = COALESCE(@designation, designation),
             agent_name = COALESCE(@agent_name, agent_name),
             agent_mobile = COALESCE(@agent_mobile, agent_mobile),
             agent_aadhar = COALESCE(@agent_aadhar, agent_aadhar),
             booth_id = COALESCE(@booth_id, booth_id),
             booth_number = COALESCE(@booth_number, booth_number),
             booth_name = COALESCE(@booth_name, booth_name)
           WHERE id = @id`,
          {
            id: Number(id),
            designation: a.designation || 'Booth President',
            agent_name: a.agent_name || a.agentName || '',
            agent_mobile: a.agent_mobile || a.agentMobile || '',
            agent_aadhar: a.agent_aadhar || a.agentAadhar || '',
            booth_id: bId ? String(bId) : null,
            booth_number: a.booth_number || a.boothNumber || '',
            booth_name: a.booth_name || a.boothName || ''
          }
        );
        return res.json({ id: String(id), ...a });
      }

      // Check if this volunteer is already assigned to this booth
      const existing = await query(
        `SELECT id FROM dbo.booth_agents 
         WHERE booth_id = @booth_id AND (agent_volunteer_id = @agent_volunteer_id OR CAST(agent_volunteer_id AS VARCHAR(64)) = @agent_volunteer_id)`,
        {
          booth_id: bId ? String(bId) : '',
          agent_volunteer_id: aVolId ? String(aVolId) : ''
        }
      );

      if (existing.length > 0) {
        // Update designation
        await execute(
          `UPDATE dbo.booth_agents SET
             designation = @designation,
             agent_name = @agent_name,
             agent_mobile = @agent_mobile,
             agent_aadhar = @agent_aadhar,
             booth_number = @booth_number,
             booth_name = @booth_name
           WHERE id = @id`,
          {
            id: existing[0].id,
            designation: a.designation || 'Booth President',
            agent_name: a.agent_name || a.agentName || '',
            agent_mobile: a.agent_mobile || a.agentMobile || '',
            agent_aadhar: a.agent_aadhar || a.agentAadhar || '',
            booth_number: a.booth_number || a.boothNumber || '',
            booth_name: a.booth_name || a.boothName || ''
          }
        );
        return res.json({ id: String(existing[0].id), ...a });
      }

      const inserted = await query(
        `INSERT INTO dbo.booth_agents (
          admin_id, booth_id, booth_number, booth_name, 
          agent_volunteer_id, agent_name, agent_aadhar, agent_mobile, designation
        ) 
        OUTPUT INSERTED.*
        VALUES (
          @admin_id, @booth_id, @booth_number, @booth_name,
          @agent_volunteer_id, @agent_name, @agent_aadhar, @agent_mobile, @designation
        )`,
        {
          admin_id: a.admin_id || a.adminId || (req as any).user.uid,
          booth_id: bId ? String(bId) : null,
          booth_number: a.booth_number || a.boothNumber || '',
          booth_name: a.booth_name || a.boothName || '',
          agent_volunteer_id: aVolId ? String(aVolId) : null,
          agent_name: a.agent_name || a.agentName || '',
          agent_aadhar: a.agent_aadhar || a.agentAadhar || '',
          agent_mobile: a.agent_mobile || a.agentMobile || '',
          designation: a.designation || 'Booth President'
        }
      );
      const resItem = inserted[0] || a;
      res.json({ id: String(resItem.id), ...resItem });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/booths/agents/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.booth_agents WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // ============================================================================
  // 6. Welfare Benefits Tracker
  // ============================================================================

  app.get("/api/benefits", optionalAuth, async (req, res) => {
    try {
      const benefits = await query(`SELECT * FROM dbo.benefits ORDER BY distribution_date DESC, created_at DESC`);
      const formatted = benefits.map(b => {
        let witnesses = [];
        try { witnesses = b.witnesses ? (typeof b.witnesses === 'string' ? JSON.parse(b.witnesses) : b.witnesses) : []; } catch {}
        return {
          id: String(b.id),
          voterDocId: b.voter_doc_id ? String(b.voter_doc_id) : '',
          voterId: b.voter_id || '',
          voterName: b.voter_name || '',
          aadharNumber: b.aadhar_number || '',
          amount: typeof b.amount === 'number' ? b.amount : parseFloat(b.amount || '0'),
          benefitName: b.benefit_name || '',
          benefitType: b.benefit_type || 'Government',
          date: b.distribution_date ? new Date(b.distribution_date).toISOString().split('T')[0] : '',
          adminId: b.admin_id || '',
          notes: b.notes || '',
          createdAt: b.created_at,
          witnessName: b.witness_name || '',
          witnessVoterId: b.witness_voter_id || '',
          witnessVoterDocId: b.witness_voter_doc_id ? String(b.witness_voter_doc_id) : '',
          witnesses
        };
      });
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/benefits", authenticateUser, async (req, res) => {
    try {
      const b = req.body;
      const { id } = b;
      const vdocId = b.voter_doc_id || b.voterDocId;
      const wVdocId = b.witness_voter_doc_id || b.witnessVoterDocId;

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.benefits SET
             voter_name = @voter_name, aadhar_number = @aadhar_number, amount = @amount,
             benefit_name = @benefit_name, benefit_type = @benefit_type, distribution_date = @distribution_date,
             notes = @notes, witness_name = @witness_name, witness_voter_id = @witness_voter_id, witnesses = @witnesses
           WHERE id = @id`,
          {
            id: Number(id),
            voter_name: b.voter_name || b.voterName,
            aadhar_number: b.aadhar_number || b.aadharNumber || '',
            amount: b.amount ? parseFloat(b.amount) : 0,
            benefit_name: b.benefit_name || b.benefitName,
            benefit_type: b.benefit_type || b.benefitType || 'Government',
            distribution_date: b.distribution_date || b.date || new Date().toISOString().split('T')[0],
            notes: b.notes || '',
            witness_name: b.witness_name || b.witnessName || '',
            witness_voter_id: b.witness_voter_id || b.witnessVoterId || '',
            witnesses: JSON.stringify(b.witnesses || [])
          }
        );
        return res.json({ id: String(id), ...b });
      }

      const inserted = await query(
        `INSERT INTO dbo.benefits (
          voter_doc_id, voter_id, voter_name, aadhar_number, amount, 
          benefit_name, benefit_type, distribution_date, admin_id, notes, 
          witness_name, witness_voter_id, witness_voter_doc_id, witnesses
        ) 
        OUTPUT INSERTED.*
        VALUES (
          @voter_doc_id, @voter_id, @voter_name, @aadhar_number, @amount,
          @benefit_name, @benefit_type, @distribution_date, @admin_id, @notes,
          @witness_name, @witness_voter_id, @witness_voter_doc_id, @witnesses
        )`,
        {
          voter_doc_id: vdocId ? String(vdocId) : null,
          voter_id: b.voter_id || b.voterId || (vdocId ? String(vdocId) : ''),
          voter_name: b.voter_name || b.voterName,
          aadhar_number: b.aadhar_number || b.aadharNumber || '',
          amount: b.amount ? parseFloat(b.amount) : 0,
          benefit_name: b.benefit_name || b.benefitName,
          benefit_type: b.benefit_type || b.benefitType || 'Government',
          distribution_date: b.distribution_date || b.date || new Date().toISOString().split('T')[0],
          admin_id: b.admin_id || b.adminId || (req as any).user.uid,
          notes: b.notes || '',
          witness_name: b.witness_name || b.witnessName || '',
          witness_voter_id: b.witness_voter_id || b.witnessVoterId || '',
          witness_voter_doc_id: wVdocId ? String(wVdocId) : null,
          witnesses: JSON.stringify(b.witnesses || [])
        }
      );
      const resItem = inserted[0] || b;
      res.json({ id: String(resItem.id), ...resItem });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/benefits/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const b = req.body;
      const targetId = Number(id) || id;
      await execute(
        `UPDATE dbo.benefits SET
           voter_name = COALESCE(@voter_name, voter_name),
           aadhar_number = COALESCE(@aadhar_number, aadhar_number),
           amount = COALESCE(@amount, amount),
           benefit_name = COALESCE(@benefit_name, benefit_name),
           benefit_type = COALESCE(@benefit_type, benefit_type),
           distribution_date = COALESCE(@distribution_date, distribution_date),
           notes = COALESCE(@notes, notes),
           witness_name = COALESCE(@witness_name, witness_name),
           witness_voter_id = COALESCE(@witness_voter_id, witness_voter_id),
           witnesses = COALESCE(@witnesses, witnesses)
         WHERE id = @id OR CAST(id AS VARCHAR(64)) = @idStr`,
        {
          id: targetId,
          idStr: String(id),
          voter_name: b.voter_name || b.voterName,
          aadhar_number: b.aadhar_number || b.aadharNumber || '',
          amount: b.amount !== undefined ? parseFloat(b.amount) : null,
          benefit_name: b.benefit_name || b.benefitName,
          benefit_type: b.benefit_type || b.benefitType || 'Government',
          distribution_date: b.distribution_date || b.date || null,
          notes: b.notes || '',
          witness_name: b.witness_name || b.witnessName || '',
          witness_voter_id: b.witness_voter_id || b.witnessVoterId || '',
          witnesses: b.witnesses ? JSON.stringify(b.witnesses) : null
        }
      );
      res.json({ success: true, id: String(id), ...b });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/benefits/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.benefits WHERE id = @id OR CAST(id AS VARCHAR(64)) = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // ============================================================================
  // 7. Finance & Campaign Budget
  // ============================================================================

  app.get("/api/finance/budgets", optionalAuth, async (req, res) => {
    try {
      const budgets = await query(`SELECT * FROM dbo.campaign_budgets ORDER BY updated_at DESC`);
      const formatted = budgets.map(b => {
        let allocations = {};
        try { allocations = b.allocations ? JSON.parse(b.allocations) : {}; } catch {}
        return {
          id: String(b.id),
          adminId: b.admin_id,
          totalBudget: parseFloat(b.total_budget) || 0,
          electionYear: b.election_year,
          allocations
        };
      });
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/finance/budgets", authenticateUser, async (req, res) => {
    try {
      const b = req.body;
      const adminId = b.admin_id || b.adminId || (req as any).user.uid;
      const allocationsJson = JSON.stringify(b.allocations || {});
      const totalBudget = parseFloat(b.totalBudget || b.total_budget) || 0;
      const eYear = String(b.electionYear || b.election_year || '2026');

      const existing = await query(
        `SELECT id FROM dbo.campaign_budgets WHERE admin_id = @admin_id AND (election_year = @election_year OR @election_year IS NULL)`,
        { admin_id: adminId, election_year: eYear }
      );

      if (existing.length > 0) {
        await execute(
          `UPDATE dbo.campaign_budgets 
           SET total_budget = @total_budget, election_year = @election_year, allocations = @allocations, updated_at = SYSUTCDATETIME()
           WHERE id = @id OR CAST(id AS VARCHAR(64)) = @idStr`,
          {
            id: existing[0].id,
            idStr: String(existing[0].id),
            total_budget: totalBudget,
            election_year: eYear,
            allocations: allocationsJson
          }
        );
        return res.json({ id: String(existing[0].id), adminId, totalBudget, electionYear: eYear, allocations: b.allocations });
      }

      const inserted = await query(
        `INSERT INTO dbo.campaign_budgets (admin_id, total_budget, election_year, allocations)
         OUTPUT INSERTED.*
         VALUES (@admin_id, @total_budget, @election_year, @allocations)`,
        { admin_id: adminId, total_budget: totalBudget, election_year: eYear, allocations: allocationsJson }
      );
      const resBudget = inserted[0] || b;
      res.json({ id: String(resBudget.id || 'b_' + Date.now()), adminId, totalBudget, electionYear: eYear, allocations: b.allocations });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.get("/api/finance/transactions", optionalAuth, async (req, res) => {
    try {
      const transactions = await query(`SELECT * FROM dbo.finance_transactions ORDER BY transaction_date DESC, created_at DESC`);
      const formatted = transactions.map(t => ({
        id: String(t.id),
        adminId: t.admin_id,
        type: t.type,
        title: t.title,
        amount: parseFloat(t.amount) || 0,
        category: t.category,
        date: t.transaction_date ? (t.transaction_date instanceof Date ? t.transaction_date.toISOString().split('T')[0] : String(t.transaction_date).split('T')[0]) : '',
        paymentMethod: t.payment_method,
        donorName: t.donor_name || '',
        notes: t.notes || ''
      }));
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/finance/transactions", authenticateUser, async (req, res) => {
    try {
      const t = req.body;
      const { id } = t;
      const adminId = t.admin_id || t.adminId || (req as any).user.uid;
      const tAmount = parseFloat(t.amount) || 0;
      const tDate = t.date || t.transaction_date || new Date().toISOString().split('T')[0];

      if (id) {
        const numId = Number(id);
        const targetId = isNaN(numId) ? id : numId;
        await execute(
          `UPDATE dbo.finance_transactions SET
             type = @type, title = @title, amount = @amount, category = @category,
             transaction_date = @transaction_date, payment_method = @payment_method,
             donor_name = @donor_name, notes = @notes
           WHERE id = @id OR CAST(id AS VARCHAR(64)) = @idStr`,
          {
            id: targetId,
            idStr: String(id),
            type: t.type || 'expense',
            title: t.title || '',
            amount: tAmount,
            category: t.category || 'General',
            transaction_date: tDate,
            payment_method: t.paymentMethod || t.payment_method || 'Cash',
            donor_name: t.donorName || t.donor_name || '',
            notes: t.notes || ''
          }
        );
        return res.json({ id: String(id), adminId, ...t, amount: tAmount, date: tDate });
      }

      const inserted = await query(
        `INSERT INTO dbo.finance_transactions (
          admin_id, type, title, amount, category, 
          transaction_date, payment_method, donor_name, notes
        ) 
        OUTPUT INSERTED.*
        VALUES (
          @admin_id, @type, @title, @amount, @category,
          @transaction_date, @payment_method, @donor_name, @notes
        )`,
        {
          admin_id: adminId,
          type: t.type || 'expense',
          title: t.title || '',
          amount: tAmount,
          category: t.category || 'General',
          transaction_date: tDate,
          payment_method: t.paymentMethod || t.payment_method || 'Cash',
          donor_name: t.donorName || t.donor_name || '',
          notes: t.notes || ''
        }
      );
      const resTx = inserted[0] || t;
      res.json({
        id: String(resTx.id || 'tx_' + Date.now()),
        adminId,
        type: t.type || 'expense',
        title: t.title,
        amount: tAmount,
        category: t.category || 'General',
        date: tDate,
        paymentMethod: t.paymentMethod || t.payment_method || 'Cash',
        donorName: t.donorName || t.donor_name || '',
        notes: t.notes || ''
      });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/finance/transactions/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const t = req.body;
      const numId = Number(id);
      const targetId = isNaN(numId) ? id : numId;
      const tAmount = parseFloat(t.amount) || 0;
      const tDate = t.date || t.transaction_date || new Date().toISOString().split('T')[0];

      await execute(
        `UPDATE dbo.finance_transactions SET
           type = @type, title = @title, amount = @amount, category = @category,
           transaction_date = @transaction_date, payment_method = @payment_method,
           donor_name = @donor_name, notes = @notes
         WHERE id = @id OR CAST(id AS VARCHAR(64)) = @idStr`,
        {
          id: targetId,
          idStr: String(id),
          type: t.type || 'expense',
          title: t.title || '',
          amount: tAmount,
          category: t.category || 'General',
          transaction_date: tDate,
          payment_method: t.paymentMethod || t.payment_method || 'Cash',
          donor_name: t.donorName || t.donor_name || '',
          notes: t.notes || ''
        }
      );
      res.json({ success: true, id: String(id), ...t, amount: tAmount, date: tDate });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/finance/transactions/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const numId = Number(id);
      const targetId = isNaN(numId) ? id : numId;
      await execute(`DELETE FROM dbo.finance_transactions WHERE id = @id OR CAST(id AS VARCHAR(64)) = @idStr`, { id: targetId, idStr: String(id) });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // ============================================================================
  // 8. WhatsApp Campaign & Broadcaster
  // ============================================================================

  app.get("/api/whatsapp/configs", optionalAuth, async (req, res) => {
    try {
      const configs = await query(`SELECT * FROM dbo.whatsapp_configs ORDER BY created_at DESC`);
      const formatted = configs.map(c => ({
        id: c.id,
        adminId: c.admin_id,
        tenantType: c.tenant_type,
        vendorName: c.vendor_name,
        phoneNumberId: c.phone_number_id,
        wabaId: c.waba_id,
        accessToken: c.access_token,
        phoneNumber: c.phone_number,
        status: c.status
      }));
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/whatsapp/configs", authenticateUser, async (req, res) => {
    try {
      const c = req.body;
      const { id } = c;

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.whatsapp_configs SET
             tenant_type = @tenant_type,
             vendor_name = @vendor_name,
             phone_number_id = @phone_number_id,
             waba_id = @waba_id,
             access_token = @access_token,
             phone_number = @phone_number,
             status = @status
           WHERE id = @id`,
          {
            id: Number(id),
            tenant_type: c.tenantType || c.tenant_type || 'shared',
            vendor_name: c.vendorName || c.vendor_name || 'Meta Cloud API',
            phone_number_id: c.phoneNumberId || c.phone_number_id || '',
            waba_id: c.wabaId || c.waba_id || '',
            access_token: c.accessToken || c.access_token || '',
            phone_number: c.phoneNumber || c.phone_number || '',
            status: c.status || 'connected'
          }
        );
        return res.json({ id: Number(id), ...c });
      }

      const inserted = await query(
        `INSERT INTO dbo.whatsapp_configs (
          admin_id, tenant_type, vendor_name, phone_number_id, 
          waba_id, access_token, phone_number, status
        ) 
        OUTPUT INSERTED.*
        VALUES (
          @admin_id, @tenant_type, @vendor_name, @phone_number_id,
          @waba_id, @access_token, @phone_number, @status
        )`,
        {
          admin_id: c.admin_id || c.adminId || (req as any).user.uid,
          tenant_type: c.tenantType || c.tenant_type || 'shared',
          vendor_name: c.vendorName || c.vendor_name || 'Meta Cloud API',
          phone_number_id: c.phoneNumberId || c.phone_number_id || '',
          waba_id: c.wabaId || c.waba_id || '',
          access_token: c.accessToken || c.access_token || '',
          phone_number: c.phoneNumber || c.phone_number || '',
          status: c.status || 'connected'
        }
      );
      res.json(inserted[0] || c);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/whatsapp/configs/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.whatsapp_configs WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.get("/api/whatsapp/templates", optionalAuth, async (req, res) => {
    try {
      const templates = await query(`SELECT * FROM dbo.whatsapp_templates ORDER BY created_at DESC`);
      const formatted = templates.map(t => ({
        id: t.id,
        adminId: t.admin_id,
        name: t.name,
        category: t.category,
        language: t.language,
        bodyText: t.body_text,
        status: t.status
      }));
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/whatsapp/templates", authenticateUser, async (req, res) => {
    try {
      const t = req.body;
      const { id } = t;

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.whatsapp_templates SET
             name = @name,
             category = @category,
             language = @language,
             body_text = @body_text,
             status = @status
           WHERE id = @id`,
          {
            id: Number(id),
            name: t.name,
            category: t.category || 'MARKETING',
            language: t.language || 'en',
            body_text: t.bodyText || t.body_text || '',
            status: t.status || 'APPROVED'
          }
        );
        return res.json({ id: Number(id), ...t });
      }

      const inserted = await query(
        `INSERT INTO dbo.whatsapp_templates (admin_id, name, category, language, body_text, status)
         OUTPUT INSERTED.*
         VALUES (@admin_id, @name, @category, @language, @body_text, @status)`,
        {
          admin_id: t.admin_id || t.adminId || (req as any).user.uid,
          name: t.name,
          category: t.category || 'MARKETING',
          language: t.language || 'en',
          body_text: t.bodyText || t.body_text || '',
          status: t.status || 'APPROVED'
        }
      );
      res.json(inserted[0] || t);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/whatsapp/templates/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.whatsapp_templates WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.get("/api/whatsapp/broadcasts", optionalAuth, async (req, res) => {
    try {
      const broadcasts = await query(`SELECT * FROM dbo.whatsapp_broadcasts ORDER BY created_at DESC`);
      const formatted = broadcasts.map(b => ({
        id: b.id,
        adminId: b.admin_id,
        campaignName: b.campaign_name,
        senderConfigId: b.sender_config_id,
        senderPhone: b.sender_phone,
        templateId: b.template_id,
        templateName: b.template_name,
        mediaUrl: b.media_url,
        mediaType: b.media_type,
        status: b.status,
        totalCount: b.total_count,
        successCount: b.success_count,
        failedCount: b.failed_count,
        createdAt: b.created_at
      }));
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/whatsapp/broadcasts", authenticateUser, async (req, res) => {
    try {
      const b = req.body;
      const { id } = b;
      const sCfgId = b.senderConfigId || b.sender_config_id;
      const tId = b.templateId || b.template_id;

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.whatsapp_broadcasts SET
             campaign_name = COALESCE(@campaign_name, campaign_name),
             sender_config_id = COALESCE(@sender_config_id, sender_config_id),
             sender_phone = COALESCE(@sender_phone, sender_phone),
             template_id = COALESCE(@template_id, template_id),
             template_name = COALESCE(@template_name, template_name),
             media_url = COALESCE(@media_url, media_url),
             media_type = COALESCE(@media_type, media_type),
             status = COALESCE(@status, status),
             total_count = COALESCE(@total_count, total_count),
             success_count = COALESCE(@success_count, success_count),
             failed_count = COALESCE(@failed_count, failed_count)
           WHERE id = @id`,
          {
            id: Number(id),
            campaign_name: b.campaignName || b.campaign_name,
            sender_config_id: sCfgId ? (parseInt(sCfgId, 10) || sCfgId) : null,
            sender_phone: b.senderPhone || b.sender_phone || '',
            template_id: tId ? (parseInt(tId, 10) || tId) : null,
            template_name: b.templateName || b.template_name || '',
            media_url: b.mediaUrl || b.media_url || null,
            media_type: b.mediaType || b.media_type || 'none',
            status: b.status || 'Completed',
            total_count: b.totalCount !== undefined ? b.totalCount : (b.total_count !== undefined ? b.total_count : 0),
            success_count: b.successCount !== undefined ? b.successCount : (b.success_count !== undefined ? b.success_count : 0),
            failed_count: b.failedCount !== undefined ? b.failedCount : (b.failed_count !== undefined ? b.failed_count : 0)
          }
        );
        return res.json({ id: Number(id), ...b });
      }

      const inserted = await query(
        `INSERT INTO dbo.whatsapp_broadcasts (
          admin_id, campaign_name, sender_config_id, sender_phone, 
          template_id, template_name, media_url, media_type, status, 
          total_count, success_count, failed_count
        ) 
        OUTPUT INSERTED.*
        VALUES (
          @admin_id, @campaign_name, @sender_config_id, @sender_phone,
          @template_id, @template_name, @media_url, @media_type, @status,
          @total_count, @success_count, @failed_count
        )`,
        {
          admin_id: b.admin_id || b.adminId || (req as any).user.uid,
          campaign_name: b.campaignName || b.campaign_name,
          sender_config_id: parseInt(sCfgId, 10) || sCfgId,
          sender_phone: b.senderPhone || b.sender_phone || '',
          template_id: tId ? (parseInt(tId, 10) || tId) : null,
          template_name: b.templateName || b.template_name || '',
          media_url: b.mediaUrl || b.media_url || null,
          media_type: b.mediaType || b.media_type || 'none',
          status: b.status || 'Draft',
          total_count: b.totalCount !== undefined ? b.totalCount : (b.total_count !== undefined ? b.total_count : 0),
          success_count: b.successCount !== undefined ? b.successCount : (b.success_count !== undefined ? b.success_count : 0),
          failed_count: b.failedCount !== undefined ? b.failedCount : (b.failed_count !== undefined ? b.failed_count : 0)
        }
      );
      res.json(inserted[0] || b);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/whatsapp/broadcasts/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.whatsapp_broadcasts WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // ============================================================================
  // 8.5. Elections & Political Parties
  // ============================================================================

  // Elections
  app.get("/api/elections", optionalAuth, async (req, res) => {
    try {
      const elections = await query(`SELECT * FROM dbo.elections ORDER BY year DESC`);
      const formatted = elections.map(e => ({
        id: String(e.id),
        year: e.year,
        title: e.title || `${e.year} Election`,
        description: e.description || '',
        status: e.status || 'Upcoming',
        createdAt: e.created_at
      }));
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/elections", authenticateUser, async (req, res) => {
    try {
      const { id, year, title, description, status } = req.body;
      const yNum = parseInt(year, 10) || new Date().getFullYear();

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.elections SET
             year = @year,
             title = @title,
             description = @description,
             status = @status
           WHERE id = @id`,
          { id: Number(id), year: yNum, title: title || `${yNum} Election`, description: description || '', status: status || 'Upcoming' }
        );
        return res.json({ id: Number(id), year: yNum, title, description, status });
      }

      const inserted = await query(
        `INSERT INTO dbo.elections (year, title, description, status)
         OUTPUT INSERTED.*
         VALUES (@year, @title, @description, @status)`,
        {
          year: yNum,
          title: title || `${yNum} Election`,
          description: description || '',
          status: status || 'Upcoming'
        }
      );
      res.json(inserted[0] || { year: yNum, title, description, status });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/elections/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { year, title, description, status } = req.body;
      await execute(
        `UPDATE dbo.elections 
         SET year = COALESCE(@year, year),
             title = COALESCE(@title, title),
             description = COALESCE(@description, description),
             status = COALESCE(@status, status)
         WHERE id = @id`,
        { id: Number(id) || id, year: year ? parseInt(year, 10) : null, title, description, status }
      );
      res.json({ success: true, message: 'Election updated' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/elections/:id", authenticateUser, async (req, res) => {
    try {
      const electionId = req.params.id;
      await execute(`DELETE FROM dbo.voter_sentiments WHERE election_id = @electionId`, { electionId });
      await execute(`DELETE FROM dbo.surveys WHERE election_id = @electionId`, { electionId });
      await execute(`DELETE FROM dbo.elections WHERE id = @electionId`, { electionId });
      res.json({ success: true, message: 'Election removed successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Political Parties
  app.get("/api/parties", optionalAuth, async (req, res) => {
    try {
      const parties = await query(`SELECT * FROM dbo.political_parties ORDER BY name ASC`);
      const formatted = parties.map(p => ({
        id: p.id,
        name: p.name,
        abbreviation: p.abbreviation,
        logoUrl: p.logo_url,
        color: p.color,
        createdAt: p.created_at
      }));
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/parties", authenticateUser, async (req, res) => {
    try {
      const { id, name, abbreviation, logoUrl, color } = req.body;
      const abrv = abbreviation || (name ? name.substring(0, 3).toUpperCase() : 'PTY');

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.political_parties SET
             name = @name,
             abbreviation = @abbreviation,
             logo_url = @logo_url,
             color = @color
           WHERE id = @id`,
          {
            id: Number(id),
            name,
            abbreviation: abrv,
            logo_url: logoUrl || '',
            color: color || '#3b82f6'
          }
        );
        return res.json({ id: Number(id), name, abbreviation: abrv, logoUrl, color });
      }

      const inserted = await query(
        `INSERT INTO dbo.political_parties (name, abbreviation, logo_url, color)
         OUTPUT INSERTED.*
         VALUES (@name, @abbreviation, @logo_url, @color)`,
        {
          name,
          abbreviation: abrv,
          logo_url: logoUrl || '',
          color: color || '#3b82f6'
        }
      );
      res.json(inserted[0] || { name, abbreviation: abrv, logoUrl, color });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/parties/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, abbreviation, logoUrl, color } = req.body;
      await execute(
        `UPDATE dbo.political_parties 
         SET name = COALESCE(@name, name),
             abbreviation = COALESCE(@abbreviation, abbreviation),
             logo_url = COALESCE(@logo_url, logo_url),
             color = COALESCE(@color, color)
         WHERE id = @id`,
        { id: Number(id) || id, name, abbreviation, logo_url: logoUrl, color }
      );
      res.json({ success: true, message: 'Party updated' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/parties/:id", authenticateUser, async (req, res) => {
    try {
      const partyId = req.params.id;
      await execute(`DELETE FROM dbo.voter_sentiments WHERE favored_party_id = @partyId`, { partyId });
      await execute(`DELETE FROM dbo.political_parties WHERE id = @partyId`, { partyId });
      res.json({ success: true, message: 'Party removed successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // ============================================================================
  // 9. Surveys & Ground Intelligence
  // ============================================================================

  // Survey Templates
  app.get("/api/surveys/templates", optionalAuth, async (req, res) => {
    try {
      const templates = await query(`SELECT * FROM dbo.survey_templates ORDER BY created_at DESC`);
      const formatted = templates.map(t => {
        let fields = [];
        try { fields = t.fields ? (typeof t.fields === 'string' ? JSON.parse(t.fields) : t.fields) : []; } catch {}
        return {
          id: String(t.id),
          name: t.name,
          description: t.description || '',
          isSystem: Boolean(t.is_system),
          fields: Array.isArray(fields) ? fields : []
        };
      });
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/surveys/templates", authenticateUser, async (req, res) => {
    try {
      const t = req.body;
      const { id } = t;

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.survey_templates SET
             name = @name,
             description = @description,
             is_system = @is_system,
             fields = @fields
           WHERE id = @id`,
          {
            id: Number(id),
            name: t.name,
            description: t.description || '',
            is_system: t.isSystem || t.is_system ? 1 : 0,
            fields: JSON.stringify(t.fields || [])
          }
        );
        return res.json({ id: String(id), ...t });
      }

      const inserted = await query(
        `INSERT INTO dbo.survey_templates (name, description, is_system, fields)
         OUTPUT INSERTED.*
         VALUES (@name, @description, @is_system, @fields)`,
        {
          name: t.name,
          description: t.description || '',
          is_system: t.isSystem || t.is_system ? 1 : 0,
          fields: JSON.stringify(t.fields || [])
        }
      );
      const resItem = inserted[0] || t;
      let parsedFields = [];
      try { parsedFields = resItem.fields ? (typeof resItem.fields === 'string' ? JSON.parse(resItem.fields) : resItem.fields) : []; } catch {}
      res.json({
        id: String(resItem.id),
        name: resItem.name,
        description: resItem.description || '',
        isSystem: Boolean(resItem.is_system),
        fields: Array.isArray(parsedFields) ? parsedFields : (t.fields || [])
      });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/surveys/templates/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const t = req.body;
      await execute(
        `UPDATE dbo.survey_templates 
         SET name = COALESCE(@name, name),
             description = COALESCE(@description, description),
             fields = COALESCE(@fields, fields)
         WHERE id = @id`,
        {
          id: Number(id) || id,
          name: t.name,
          description: t.description,
          fields: t.fields ? JSON.stringify(t.fields) : null
        }
      );
      res.json({ success: true, message: 'Template updated' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/surveys/templates/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.survey_templates WHERE id = @id AND is_system = 0`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Active Survey Campaigns
  app.get("/api/surveys", optionalAuth, async (req, res) => {
    try {
      const reqUser = (req as any).user;
      let isSuperAdmin = false;
      const userIdentifiers: string[] = [];
      let info: { isSuperAdmin: boolean; userRow: any } | null = null;

      if (reqUser) {
        info = await getRequesterInfo(reqUser);
        isSuperAdmin = info.isSuperAdmin;
        if (info.userRow) {
          if (info.userRow.id) userIdentifiers.push(String(info.userRow.id).toLowerCase().trim());
          if (info.userRow.email) userIdentifiers.push(String(info.userRow.email).toLowerCase().trim());
          if (info.userRow.name) userIdentifiers.push(String(info.userRow.name).toLowerCase().trim());
        }
        if (reqUser.uid) userIdentifiers.push(String(reqUser.uid).toLowerCase().trim());
        if (reqUser.email) userIdentifiers.push(String(reqUser.email).toLowerCase().trim());
      }

      const surveys = await query(`SELECT * FROM dbo.surveys ORDER BY created_at DESC`);
      const formatted = surveys.map(s => {
        let assignedTo = [];
        try { assignedTo = s.assigned_to ? (typeof s.assigned_to === 'string' ? JSON.parse(s.assigned_to) : s.assigned_to) : []; } catch {}
        let linkedPartyIds = [];
        try { linkedPartyIds = s.linked_party_ids ? (typeof s.linked_party_ids === 'string' ? JSON.parse(s.linked_party_ids) : s.linked_party_ids) : []; } catch {}
        return {
          id: String(s.id),
          title: s.title,
          description: s.description || '',
          electionId: String(s.election_id || ''),
          electionYear: s.election_year || 2026,
          status: s.status || 'Draft',
          templateId: s.template_id ? String(s.template_id) : 'political_sentiment',
          assignedTo: Array.isArray(assignedTo) ? assignedTo : [],
          linkedPartyIds: Array.isArray(linkedPartyIds) ? linkedPartyIds : []
        };
      });

      // Filter: Admins receive all surveys; non-admin users receive assigned surveys
      const userRole = info?.userRow?.role || reqUser?.role;
      const isAdminUser = isSuperAdmin || !reqUser || userRole === 'admin' || userRole === 'superadmin' || userRole === 'super_admin' || Boolean(info?.isSuperAdmin);
      const result = isAdminUser
        ? formatted 
        : formatted.filter(s => {
            if (!Array.isArray(s.assignedTo) || s.assignedTo.length === 0) return false;
            return s.assignedTo.some((a: string) => userIdentifiers.includes(String(a).toLowerCase().trim()));
          });

      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/surveys", authenticateUser, async (req, res) => {
    try {
      const s = req.body;
      const { id } = s;
      const eId = s.electionId || s.election_id;
      const parsedElectionId = (eId && !isNaN(Number(eId))) ? Number(eId) : 1;
      const tId = s.templateId || s.template_id;
      const parsedTemplateId = (tId && tId !== 'political_sentiment' && !isNaN(Number(tId))) ? Number(tId) : null;
      const electionYear = Number(s.electionYear || s.election_year) || 2026;

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.surveys SET
             title = @title,
             description = @description,
             election_id = @election_id,
             election_year = @election_year,
             assigned_to = @assigned_to,
             status = @status,
             template_id = @template_id,
             linked_party_ids = @linked_party_ids
           WHERE id = @id`,
          {
            id: Number(id),
            title: s.title,
            description: s.description || '',
            election_id: parsedElectionId,
            election_year: electionYear,
            assigned_to: JSON.stringify(Array.isArray(s.assignedTo) ? s.assignedTo : []),
            status: s.status || 'Draft',
            template_id: parsedTemplateId,
            linked_party_ids: JSON.stringify(Array.isArray(s.linkedPartyIds) ? s.linkedPartyIds : [])
          }
        );
        return res.json({ id: String(id), ...s });
      }

      const inserted = await query(
        `INSERT INTO dbo.surveys (title, description, election_id, election_year, assigned_to, status, template_id, linked_party_ids)
         OUTPUT INSERTED.*
         VALUES (@title, @description, @election_id, @election_year, @assigned_to, @status, @template_id, @linked_party_ids)`,
        {
          title: s.title,
          description: s.description || '',
          election_id: parsedElectionId,
          election_year: electionYear,
          assigned_to: JSON.stringify(Array.isArray(s.assignedTo) ? s.assignedTo : []),
          status: s.status || 'Draft',
          template_id: parsedTemplateId,
          linked_party_ids: JSON.stringify(Array.isArray(s.linkedPartyIds) ? s.linkedPartyIds : [])
        }
      );
      const resItem = inserted[0] || s;
      res.json({
        id: String(resItem.id || id),
        title: resItem.title || s.title,
        description: resItem.description || s.description,
        electionId: String(resItem.election_id || parsedElectionId),
        electionYear: resItem.election_year || electionYear,
        status: resItem.status || s.status,
        templateId: resItem.template_id ? String(resItem.template_id) : 'political_sentiment',
        assignedTo: s.assignedTo || [],
        linkedPartyIds: s.linkedPartyIds || []
      });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/surveys/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const s = req.body;
      const eId = s.electionId || s.election_id;
      const parsedElectionId = (eId && !isNaN(Number(eId))) ? Number(eId) : undefined;
      const tId = s.templateId !== undefined ? s.templateId : s.template_id;
      const parsedTemplateId = (tId && tId !== 'political_sentiment' && !isNaN(Number(tId))) ? Number(tId) : null;
      const electionYear = (s.electionYear || s.election_year) ? Number(s.electionYear || s.election_year) : undefined;

      const assignedToJson = s.assignedTo !== undefined 
        ? JSON.stringify(Array.isArray(s.assignedTo) ? s.assignedTo : []) 
        : (s.assigned_to !== undefined ? (typeof s.assigned_to === 'string' ? s.assigned_to : JSON.stringify(s.assigned_to)) : null);
      const linkedPartyIdsJson = s.linkedPartyIds !== undefined 
        ? JSON.stringify(Array.isArray(s.linkedPartyIds) ? s.linkedPartyIds : []) 
        : (s.linked_party_ids !== undefined ? (typeof s.linked_party_ids === 'string' ? s.linked_party_ids : JSON.stringify(s.linked_party_ids)) : null);

      await execute(
        `UPDATE dbo.surveys 
         SET title = COALESCE(@title, title),
             description = COALESCE(@description, description),
             election_id = COALESCE(@election_id, election_id),
             election_year = COALESCE(@election_year, election_year),
             assigned_to = CASE WHEN @assigned_to IS NOT NULL THEN @assigned_to ELSE assigned_to END,
             status = COALESCE(@status, status),
             template_id = @template_id,
             linked_party_ids = CASE WHEN @linked_party_ids IS NOT NULL THEN @linked_party_ids ELSE linked_party_ids END
         WHERE id = @id`,
        {
          id: Number(id) || id,
          title: s.title,
          description: s.description,
          election_id: parsedElectionId,
          election_year: electionYear,
          assigned_to: assignedToJson,
          status: s.status,
          template_id: parsedTemplateId,
          linked_party_ids: linkedPartyIdsJson
        }
      );
      res.json({ success: true, message: 'Survey updated' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/surveys/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.surveys WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Multi-Admin Voter Assessments & Sentiments for Cross-Auditing
  app.get("/api/voter-assessments", optionalAuth, async (req, res) => {
    try {
      const results = await query(`
        SELECT 
          va.*,
          COALESCE(u.name, 'Admin (' + CAST(va.admin_id AS VARCHAR) + ')') AS admin_name,
          u.email AS admin_email,
          u.role AS admin_role,
          v.voter_id AS voter_epic,
          COALESCE(v.name, va.voter_name) AS voter_full_name,
          v.gender AS voter_gender,
          v.age AS voter_age,
          v.mobile AS voter_mobile,
          v.village AS voter_village,
          v.house_no AS voter_house_no,
          v.booth_id AS voter_booth_id,
          b.name AS booth_name,
          b.booth_number,
          v.constituency_id AS voter_constituency_id,
          c.name AS constituency_name
        FROM dbo.voter_assessments va
        LEFT JOIN dbo.users u ON va.admin_id = u.id
        LEFT JOIN dbo.voters v ON (va.voter_id = v.id OR va.voter_id = v.voter_id)
        LEFT JOIN dbo.booths b ON v.booth_id = b.id
        LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
        ORDER BY va.updated_at DESC
      `);
      res.json(results || []);
    } catch (err: any) {
      console.error('Error fetching voter assessments:', err);
      res.status(500).json({ error: sanitizeError(err) });
    }
  });

  // Voter Sentiments
  app.get("/api/voter-sentiments", optionalAuth, async (req, res) => {
    try {
      const { voterDocId, surveyId, boothId, constituencyId } = req.query;
      let sqlQuery = `
        SELECT 
          s.*,
          COALESCE(v.name, s.voter_name) AS voter_name,
          COALESCE(v.gender, 'Male') AS voter_gender,
          COALESCE(v.age, 35) AS voter_age,
          COALESCE(v.caste, '') AS voter_caste,
          COALESCE(s.booth_id, CAST(v.booth_id AS VARCHAR(64))) AS effective_booth_id,
          COALESCE(s.constituency_id, CAST(v.constituency_id AS VARCHAR(64))) AS effective_constituency_id,
          COALESCE(s.district_id, CAST(v.district_id AS VARCHAR(64))) AS effective_district_id,
          COALESCE(s.state_id, CAST(v.state_id AS VARCHAR(64))) AS effective_state_id,
          b.name AS booth_name,
          c.name AS constituency_name,
          p.name AS party_name,
          p.color AS party_color,
          p.symbol AS party_symbol
        FROM dbo.voter_sentiments s
        LEFT JOIN dbo.voters v ON (CAST(v.id AS VARCHAR(64)) = s.voter_id OR v.voter_id = s.voter_id)
        LEFT JOIN dbo.booths b ON (CAST(b.id AS VARCHAR(64)) = s.booth_id OR CAST(b.id AS VARCHAR(64)) = CAST(v.booth_id AS VARCHAR(64)))
        LEFT JOIN dbo.constituencies c ON (CAST(c.id AS VARCHAR(64)) = s.constituency_id OR CAST(c.id AS VARCHAR(64)) = CAST(v.constituency_id AS VARCHAR(64)))
        LEFT JOIN dbo.parties p ON (CAST(p.id AS VARCHAR(64)) = s.favored_party_id)
        WHERE 1=1
      `;
      const params: Record<string, any> = {};

      const reqUser = (req as any).user;
      let isSuperAdmin = false;
      const userIdentifiers: string[] = [];
      let info: { isSuperAdmin: boolean; userRow: any } | null = null;

      if (reqUser) {
        info = await getRequesterInfo(reqUser);
        isSuperAdmin = info.isSuperAdmin;
        if (info.userRow) {
          if (info.userRow.id) userIdentifiers.push(String(info.userRow.id).toLowerCase().trim());
          if (info.userRow.email) userIdentifiers.push(String(info.userRow.email).toLowerCase().trim());
          if (info.userRow.name) userIdentifiers.push(String(info.userRow.name).toLowerCase().trim());
        }
        if (reqUser.uid) userIdentifiers.push(String(reqUser.uid).toLowerCase().trim());
        if (reqUser.email) userIdentifiers.push(String(reqUser.email).toLowerCase().trim());
      }

      if (voterDocId) {
        sqlQuery += ` AND (
          s.voter_id = @voterDocId 
          OR s.voter_id IN (SELECT CAST(id AS VARCHAR(64)) FROM dbo.voters WHERE voter_id = @voterDocId OR CAST(id AS VARCHAR(64)) = @voterDocId)
          OR s.voter_id IN (SELECT voter_id FROM dbo.voters WHERE voter_id = @voterDocId OR CAST(id AS VARCHAR(64)) = @voterDocId)
        )`;
        params.voterDocId = String(voterDocId);
      }
      if (surveyId) {
        sqlQuery += ` AND s.survey_id = @surveyId`;
        params.surveyId = String(surveyId);
      }
      if (boothId && boothId !== 'all') {
        sqlQuery += ` AND (s.booth_id = @boothId OR CAST(v.booth_id AS VARCHAR(64)) = @boothId)`;
        params.boothId = String(boothId);
      }
      if (constituencyId && constituencyId !== 'all') {
        sqlQuery += ` AND (s.constituency_id = @constituencyId OR CAST(v.constituency_id AS VARCHAR(64)) = @constituencyId)`;
        params.constituencyId = String(constituencyId);
      }

      sqlQuery += ` ORDER BY s.created_at DESC`;
      const sentiments = await query(sqlQuery, params);

      // Scoping: If not super admin, determine assigned survey IDs
      let assignedSurveyIds: string[] = [];
      if (!isSuperAdmin && reqUser) {
        const surveys = await query(`SELECT id, assigned_to FROM dbo.surveys`);
        assignedSurveyIds = surveys.filter(s => {
          let aTo = [];
          try { aTo = s.assigned_to ? (typeof s.assigned_to === 'string' ? JSON.parse(s.assigned_to) : s.assigned_to) : []; } catch {}
          return Array.isArray(aTo) && aTo.some(a => userIdentifiers.includes(String(a).toLowerCase().trim()));
        }).map(s => String(s.id));
      }

      const userRole = info?.userRow?.role || reqUser?.role;
      const formatted = sentiments
        .filter(s => {
          if (isSuperAdmin || !reqUser) return true;
          if (userRole === 'admin' || userRole === 'superadmin' || userRole === 'super_admin' || Boolean(info?.isSuperAdmin)) return true;
          if (!s.survey_id) return true;
          if (s.survey_id && (assignedSurveyIds.length === 0 || assignedSurveyIds.includes(String(s.survey_id)))) return true;
          if (s.recorded_by && userIdentifiers.includes(String(s.recorded_by).toLowerCase().trim())) return true;
          return false;
        })
        .map(s => {
          let keyConcerns = [];
          try { keyConcerns = s.key_concerns ? JSON.parse(s.key_concerns) : []; } catch {}
          let customAnswers = {};
          try { customAnswers = s.custom_answers ? JSON.parse(s.custom_answers) : {}; } catch {}

          const score = Number(s.sentiment_score) || 3;
          let sentimentType: 'Support' | 'Neutral' | 'Oppose' | 'Other Party' = 'Neutral';
          if (score >= 4) sentimentType = 'Support';
          else if (score <= 2) sentimentType = 'Oppose';
          if (s.favored_party_name && s.favored_party_name.toLowerCase().includes('other')) {
            sentimentType = 'Other Party';
          }

          return {
            id: String(s.id),
            voterDocId: String(s.voter_id || ''),
            voterName: s.voter_name || 'Voter',
            gender: s.voter_gender || 'Male',
            age: Number(s.voter_age) || 35,
            caste: s.voter_caste || '',
            electionId: s.election_id ? String(s.election_id) : '',
            electionYear: s.election_year ? (parseInt(String(s.election_year), 10) || 2026) : 2026,
            favoredPartyId: (s.favored_party_id === 0 || s.favored_party_id === null || s.favored_party_id === 'none') ? 'none' : String(s.favored_party_id),
            favoredPartyName: s.party_name || s.favored_party_name || '',
            partyColor: s.party_color || '#3b82f6',
            partySymbol: s.party_symbol || '',
            sentimentScore: score,
            sentiment: sentimentType,
            keyConcerns,
            constituencyId: String(s.effective_constituency_id || s.constituency_id || ''),
            constituencyName: s.constituency_name || '',
            stateId: String(s.effective_state_id || s.state_id || ''),
            districtId: String(s.effective_district_id || s.district_id || ''),
            boothId: String(s.effective_booth_id || s.booth_id || ''),
            boothName: s.booth_name || '',
            mobile: s.mobile || '',
            email: s.email || '',
            aadharNumber: s.aadhar_number || '',
            surveyId: String(s.survey_id || ''),
            surveyTitle: s.survey_title || '',
            customAnswers,
            recordedBy: String(s.recorded_by || ''),
            recordedByName: s.recorded_by_name || '',
            createdAt: s.created_at
          };
        });
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/voter-sentiments", authenticateUser, async (req, res) => {
    try {
      const s = req.body;
      const { id } = s;
      const vId = s.voterDocId || s.voter_id;
      const eId = s.electionId || s.election_id;
      const rawPartyId = s.favoredPartyId || s.favored_party_id;
      const cId = s.constituencyId || s.constituency_id;
      const stId = s.stateId || s.state_id;
      const dtId = s.districtId || s.district_id;
      const btId = s.boothId || s.booth_id;
      const sId = s.surveyId || s.survey_id;
      const sTitle = s.surveyTitle || s.survey_title;
      const customAns = s.customAnswers || s.custom_answers || {};

      const partyIdVal = (rawPartyId === 'none' || !rawPartyId) ? 'none' : String(rawPartyId);

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.voter_sentiments SET
             voter_name = @voter_name,
             favored_party_id = @favored_party_id,
             favored_party_name = @favored_party_name,
             sentiment_score = @sentiment_score,
             key_concerns = @key_concerns,
             custom_answers = @custom_answers,
             survey_id = COALESCE(@survey_id, survey_id),
             survey_title = COALESCE(@survey_title, survey_title)
           WHERE id = @id`,
          {
            id: Number(id),
            voter_name: s.voterName || s.voter_name,
            favored_party_id: partyIdVal,
            favored_party_name: s.favoredPartyName || s.favored_party_name || 'Undecided / No Favor',
            sentiment_score: parseFloat(s.sentimentScore || s.sentiment_score) || 3.0,
            key_concerns: JSON.stringify(s.keyConcerns || []),
            custom_answers: JSON.stringify(customAns),
            survey_id: sId || null,
            survey_title: sTitle || null
          }
        );
        return res.json({ id: Number(id), ...s });
      }

      // Check for duplicate response: One voter can only submit once per survey campaign
      const checkVoterId = String(vId || '').trim();
      const dupParams: Record<string, any> = { vId: checkVoterId };
      let dupSql = '';

      if (sId) {
        dupSql = `
          SELECT TOP 1 id, voter_name, survey_title 
          FROM dbo.voter_sentiments 
          WHERE survey_id = @surveyId 
            AND (
              voter_id = @vId 
              OR voter_id IN (SELECT CAST(id AS VARCHAR(64)) FROM dbo.voters WHERE voter_id = @vId OR CAST(id AS VARCHAR(64)) = @vId)
              OR voter_id IN (SELECT voter_id FROM dbo.voters WHERE voter_id = @vId OR CAST(id AS VARCHAR(64)) = @vId)
            )
        `;
        dupParams.surveyId = String(sId);
      } else {
        dupSql = `
          SELECT TOP 1 id, voter_name 
          FROM dbo.voter_sentiments 
          WHERE (survey_id IS NULL OR survey_id = '')
            AND CAST(election_id AS VARCHAR(64)) = @electionId
            AND (
              voter_id = @vId 
              OR voter_id IN (SELECT CAST(id AS VARCHAR(64)) FROM dbo.voters WHERE voter_id = @vId OR CAST(id AS VARCHAR(64)) = @vId)
              OR voter_id IN (SELECT voter_id FROM dbo.voters WHERE voter_id = @vId OR CAST(id AS VARCHAR(64)) = @vId)
            )
        `;
        dupParams.electionId = String(eId || '1');
      }

      const existingEntries = await query(dupSql, dupParams);
      if (existingEntries.length > 0) {
        if (sId) {
          return res.status(400).json({ 
            error: `This voter has already submitted a response for this survey campaign (${existingEntries[0].survey_title || sTitle || 'Current Campaign'}). Multiple entries for the same survey are not allowed.` 
          });
        } else {
          // Update existing general sentiment entry for this voter
          const existingId = existingEntries[0].id;
          await execute(
            `UPDATE dbo.voter_sentiments SET
               voter_name = @voter_name,
               favored_party_id = @favored_party_id,
               favored_party_name = @favored_party_name,
               sentiment_score = @sentiment_score,
               key_concerns = @key_concerns,
               custom_answers = @custom_answers,
               recorded_by = @recorded_by,
               recorded_by_name = @recorded_by_name
             WHERE id = @id`,
            {
              id: existingId,
              voter_name: s.voterName || s.voter_name,
              favored_party_id: partyIdVal,
              favored_party_name: s.favoredPartyName || s.favored_party_name || 'Undecided / No Favor',
              sentiment_score: parseFloat(s.sentimentScore || s.sentiment_score) || 3.0,
              key_concerns: JSON.stringify(s.keyConcerns || []),
              custom_answers: JSON.stringify(customAns),
              recorded_by: s.recordedBy || (req as any).user?.uid || 'system',
              recorded_by_name: s.recordedByName || (req as any).user?.name || 'Staff'
            }
          );
          return res.json({ id: existingId, ...s });
        }
      }

      const inserted = await query(
        `INSERT INTO dbo.voter_sentiments (
          voter_id, voter_name, election_id, election_year, 
          favored_party_id, favored_party_name, sentiment_score, 
          key_concerns, constituency_id, state_id, district_id, booth_id,
          mobile, email, aadhar_number, survey_id, survey_title, custom_answers,
          recorded_by, recorded_by_name
        ) 
        OUTPUT INSERTED.*
        VALUES (
          @voter_id, @voter_name, @election_id, @election_year,
          @favored_party_id, @favored_party_name, @sentiment_score,
          @key_concerns, @constituency_id, @state_id, @district_id, @booth_id,
          @mobile, @email, @aadhar_number, @survey_id, @survey_title, @custom_answers,
          @recorded_by, @recorded_by_name
        )`,
        {
          voter_id: vId ? String(vId) : '0',
          voter_name: s.voterName || s.voter_name,
          election_id: eId ? String(eId) : '1',
          election_year: parseInt(s.electionYear || s.election_year, 10) || 2026,
          favored_party_id: partyIdVal,
          favored_party_name: s.favoredPartyName || s.favored_party_name || 'Undecided / No Favor',
          sentiment_score: parseFloat(s.sentimentScore || s.sentiment_score) || 3.0,
          key_concerns: JSON.stringify(s.keyConcerns || []),
          constituency_id: cId ? (parseInt(String(cId), 10) || String(cId)) : null,
          state_id: stId ? String(stId) : null,
          district_id: dtId ? String(dtId) : null,
          booth_id: btId ? String(btId) : null,
          mobile: s.mobile || null,
          email: s.email || null,
          aadhar_number: s.aadharNumber || s.aadhar_number || null,
          survey_id: sId ? String(sId) : null,
          survey_title: sTitle ? String(sTitle) : null,
          custom_answers: JSON.stringify(customAns),
          recorded_by: s.recordedBy || (req as any).user?.uid || 'system',
          recorded_by_name: s.recordedByName || (req as any).user?.name || 'Staff'
        }
      );
      res.json(inserted[0] || s);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/voter-sentiments/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.voter_sentiments WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // ============================================================================
  // 10. Real-Time Dashboard & Analytics Aggregator
  // ============================================================================

  app.get("/api/analytics/dashboard", optionalAuth, async (req, res) => {
    try {
      const [voterStats] = await query(`
        SELECT 
          COUNT(*) as total_voters,
          SUM(CASE WHEN voting_status = 'voted' THEN 1 ELSE 0 END) as voted_count,
          SUM(CASE WHEN is_karyakarta = 1 THEN 1 ELSE 0 END) as karyakarta_count,
          SUM(CASE WHEN gender = 'Male' THEN 1 ELSE 0 END) as male_count,
          SUM(CASE WHEN gender = 'Female' THEN 1 ELSE 0 END) as female_count,
          SUM(CASE WHEN gender NOT IN ('Male', 'Female') THEN 1 ELSE 0 END) as other_gender_count,
          SUM(CASE WHEN age < 30 THEN 1 ELSE 0 END) as youth_count,
          SUM(CASE WHEN age >= 30 AND age <= 50 THEN 1 ELSE 0 END) as middle_age_count,
          SUM(CASE WHEN age > 50 THEN 1 ELSE 0 END) as senior_count
        FROM dbo.voters
      `);

      const [boothStats] = await query(`SELECT COUNT(*) as total_booths FROM dbo.booths`);
      const [mandalStats] = await query(`SELECT COUNT(*) as total_mandals FROM dbo.mandals`);
      const [surveyStats] = await query(`SELECT COUNT(*) as total_surveys FROM dbo.surveys`);
      const [benefitStats] = await query(`SELECT COUNT(*) as total_benefits, SUM(amount) as total_aid_amount FROM dbo.benefits`);

      const casteDistribution = await query(`
        SELECT caste, COUNT(*) as count 
        FROM dbo.voters 
        WHERE caste IS NOT NULL AND caste != ''
        GROUP BY caste
        ORDER BY count DESC
      `);

      const partyInclination = await query(`
        SELECT party_inclination, COUNT(*) as count 
        FROM dbo.voters 
        WHERE party_inclination IS NOT NULL
        GROUP BY party_inclination
      `);

      res.json({
        totalVoters: voterStats.total_voters || 0,
        votedCount: voterStats.voted_count || 0,
        karyakartaCount: voterStats.karyakarta_count || 0,
        totalBooths: boothStats.total_booths || 0,
        totalMandals: mandalStats.total_mandals || 0,
        totalSurveys: surveyStats.total_surveys || 0,
        totalBenefits: benefitStats.total_benefits || 0,
        totalAidAmount: benefitStats.total_aid_amount || 0,
        genderBreakdown: {
          male: voterStats.male_count || 0,
          female: voterStats.female_count || 0,
          other: voterStats.other_gender_count || 0
        },
        ageBreakdown: {
          youth: voterStats.youth_count || 0,
          middle: voterStats.middle_age_count || 0,
          senior: voterStats.senior_count || 0
        },
        casteDistribution,
        partyInclination
      });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  try {
    await execute(`
      IF OBJECT_ID(N'dbo.constituencies', N'U') IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'constituencies' AND COLUMN_NAME = 'category'
      )
      BEGIN
        ALTER TABLE dbo.constituencies ADD category VARCHAR(50) DEFAULT 'General';
      END
    `);
  } catch (migErr) {
    console.warn('[Migration] Note on category column check:', migErr);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

