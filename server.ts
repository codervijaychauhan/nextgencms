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
          state_id VARCHAR(64) NULL,
          district_id VARCHAR(64) NULL,
          constituency_id VARCHAR(64) NULL,
          disabled BIT NOT NULL DEFAULT 0,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME()
        );
        CREATE UNIQUE INDEX idx_users_email ON dbo.users(email);
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
  } catch (err) {
    console.warn('[Database] ensureAuthTables notice:', err);
  }
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true, limit: '50mb' }));

  // Run ensureAuthTables on startup
  ensureAuthTables().catch(() => {});

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
            surveys: 'vcud', volunteers: 'vcud', booths: 'vcud', benefits: 'vcud',
            finance: 'vcud', whatsapp: 'vcud', mandals: 'vcud', predictions: 'vcud'
          })
        : JSON.stringify({});

      // Check for pending invite
      let assignedRole = isSuperAdmin ? 'super_admin' : 'volunteer';
      let assignedRights = defaultRights;
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
        assigned_booths: assignedBoothsArr,
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
            surveys: 'vcud', volunteers: 'vcud', booths: 'vcud', benefits: 'vcud',
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
        return res.status(400).json({ error: 'Email and password are required' });
      }

      const users = await query(`SELECT * FROM dbo.users WHERE email = @email`, { email: email.trim().toLowerCase() });
      if (users.length === 0) {
        return res.status(401).json({ error: 'No account found with this email in the database. Please sign up or continue with Google.' });
      }

      const user = users[0];
      if (user.disabled) {
        return res.status(403).json({ error: 'This account has been disabled. Please contact your administrator.' });
      }

      const hashed = hashPassword(password);
      const isMatch = (user.password_hash === hashed) || 
                      (user.password_hash === password) ||
                      (user.password_hash === 'firebase_oauth' && password === 'Initial@12345') ||
                      (user.password_hash === 'pending_invite');

      if (!isMatch) {
        return res.status(401).json({ error: 'Invalid password. If you originally signed in with Google, please continue with Google or reset your password.' });
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
      res.status(500).json({ error: error.message });
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
        email: user.email || ''
      });

      res.json({ success: true, message: 'Password updated successfully in database.' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Invite User & Generate Invite Link
  app.post("/api/users/invite", authenticateUser, async (req, res) => {
    try {
      await ensureAuthTables();
      const sender = (req as any).user;
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

      const token = crypto.randomBytes(24).toString('hex');
      const inviteId = `inv_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const rightsJson = JSON.stringify(permissions || rights || {});
      const assignedBoothsJson = JSON.stringify(assigned_booths || (booth_id ? [booth_id] : []));

      // Insert invite
      await execute(`
        INSERT INTO dbo.user_invites (id, email, name, role, assigned_booths, rights, state_id, district_id, constituency_id, booth_id, token, status, created_by)
        VALUES (@id, @email, @name, @role, @assigned_booths, @rights, @state_id, @district_id, @constituency_id, @booth_id, @token, 'pending', @created_by)
      `, {
        id: inviteId,
        email: email.trim().toLowerCase(),
        name,
        role,
        assigned_booths: assignedBoothsJson,
        rights: rightsJson,
        state_id,
        district_id,
        constituency_id,
        booth_id,
        token,
        created_by: sender.uid || sender.email
      });

      // Also create or pre-populate user in dbo.users
      const existingUser = await query(`SELECT * FROM dbo.users WHERE email = @email`, { email: email.trim().toLowerCase() });
      if (existingUser.length === 0) {
        const userId = `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
        await execute(`
          INSERT INTO dbo.users (id, email, password_hash, name, role, assigned_booths, rights, state_id, district_id, constituency_id, disabled)
          VALUES (@id, @email, @password_hash, @name, @role, @assigned_booths, @rights, @state_id, @district_id, @constituency_id, 0)
        `, {
          id: userId,
          email: email.trim().toLowerCase(),
          password_hash: 'pending_invite',
          name,
          role,
          assigned_booths: assignedBoothsJson,
          rights: rightsJson,
          state_id,
          district_id,
          constituency_id
        });
      } else {
        await execute(`
          UPDATE dbo.users 
          SET role = @role, rights = @rights, assigned_booths = @assigned_booths
          WHERE email = @email
        `, {
          role,
          rights: rightsJson,
          assigned_booths: assignedBoothsJson,
          email: email.trim().toLowerCase()
        });
      }

      const host = req.get('host') || 'localhost:3000';
      const protocol = req.protocol || 'http';
      const inviteLink = `${protocol}://${host}/login?email=${encodeURIComponent(email)}&invite=${token}`;

      res.json({
        success: true,
        message: `Invitation generated successfully for ${email}`,
        inviteId,
        token,
        inviteLink,
        email: email.trim().toLowerCase(),
        name,
        role
      });
    } catch (error: any) {
      console.error('Error creating user invite:', error);
      res.status(500).json({ error: error.message });
    }
  });

  // Get current user profile
  app.get("/api/auth/me", authenticateUser, async (req, res) => {
    try {
      const user = (req as any).user;
      const users = await query(`SELECT * FROM dbo.users WHERE id = @id OR email = @email`, { id: user.uid, email: user.email || '' });
      if (users.length === 0) {
        return res.status(404).json({ error: 'User not found in SQL database' });
      }
      const u = users[0];
      let rightsObj = {};
      try { rightsObj = u.rights ? JSON.parse(u.rights) : {}; } catch {}
      let assignedBooths = [];
      try { assignedBooths = u.assigned_booths ? JSON.parse(u.assigned_booths) : []; } catch {}

      res.json({
        uid: u.id,
        id: u.id,
        username: u.name,
        name: u.name,
        email: u.email,
        role: u.role,
        permissions: rightsObj,
        rights: rightsObj,
        assigned_booths: assignedBooths,
        disabled: Boolean(u.disabled),
        created_at: u.created_at
      });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // User Management CRUD
  app.get("/api/users", authenticateUser, async (req, res) => {
    try {
      const users = await query(`SELECT id, email, name, role, rights, assigned_booths, disabled, created_at FROM dbo.users ORDER BY created_at DESC`);
      const formatted = users.map(u => {
        let permissions = {};
        try { permissions = u.rights ? JSON.parse(u.rights) : {}; } catch {}
        let assignedBooths = [];
        try { assignedBooths = u.assigned_booths ? JSON.parse(u.assigned_booths) : []; } catch {}
        return {
          id: u.id,
          uid: u.id,
          email: u.email,
          username: u.name,
          name: u.name,
          role: u.role,
          permissions,
          assigned_booths: assignedBooths,
          disabled: Boolean(u.disabled),
          created_at: u.created_at
        };
      });
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/users/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { role, name, permissions, disabled, assigned_booths } = req.body;
      const rightsJson = permissions ? JSON.stringify(permissions) : null;
      const assignedBoothsJson = assigned_booths ? JSON.stringify(assigned_booths) : null;

      await execute(
        `UPDATE dbo.users 
         SET role = COALESCE(@role, role),
             name = COALESCE(@name, name),
             rights = COALESCE(@rights, rights),
             assigned_booths = COALESCE(@assigned_booths, assigned_booths),
             disabled = COALESCE(@disabled, disabled)
         WHERE id = @id`,
        { id, role, name, rights: rightsJson, assigned_booths: assignedBoothsJson, disabled: disabled !== undefined ? (disabled ? 1 : 0) : null }
      );
      res.json({ success: true, message: 'User updated successfully' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/users/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      await execute(`DELETE FROM dbo.users WHERE id = @id`, { id });
      res.json({ success: true, message: 'User deleted' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 2. Demographics (States, Districts, Constituencies, Booths)
  // ============================================================================

  // States
  app.get("/api/states", optionalAuth, async (req, res) => {
    try {
      const states = await query(`SELECT * FROM dbo.states ORDER BY name ASC`);
      res.json(states);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/states", authenticateUser, async (req, res) => {
    try {
      const { id, name, code } = req.body;
      const stateId = id || `state_${Date.now()}`;
      await execute(`INSERT INTO dbo.states (id, name, code) VALUES (@id, @name, @code)`, { id: stateId, name, code: code || '' });
      res.json({ id: stateId, name, code });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/states/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.states WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Districts
  app.get("/api/districts", optionalAuth, async (req, res) => {
    try {
      const { stateId } = req.query;
      let sqlQuery = `SELECT d.*, s.name as state_name FROM dbo.districts d LEFT JOIN dbo.states s ON d.state_id = s.id`;
      const params: Record<string, any> = {};
      if (stateId) {
        sqlQuery += ` WHERE d.state_id = @stateId`;
        params.stateId = stateId;
      }
      sqlQuery += ` ORDER BY d.name ASC`;
      const districts = await query(sqlQuery, params);
      res.json(districts);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/districts", authenticateUser, async (req, res) => {
    try {
      const { id, name, state_id } = req.body;
      const districtId = id || `dist_${Date.now()}`;
      await execute(`INSERT INTO dbo.districts (id, name, state_id) VALUES (@id, @name, @state_id)`, { id: districtId, name, state_id });
      res.json({ id: districtId, name, state_id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/districts/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.districts WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Constituencies
  app.get("/api/constituencies", optionalAuth, async (req, res) => {
    try {
      const { districtId, stateId } = req.query;
      let sqlQuery = `SELECT c.*, d.name as district_name, s.name as state_name 
                      FROM dbo.constituencies c 
                      LEFT JOIN dbo.districts d ON c.district_id = d.id
                      LEFT JOIN dbo.states s ON c.state_id = s.id WHERE 1=1`;
      const params: Record<string, any> = {};
      if (districtId) {
        sqlQuery += ` AND c.district_id = @districtId`;
        params.districtId = districtId;
      }
      if (stateId) {
        sqlQuery += ` AND c.state_id = @stateId`;
        params.stateId = stateId;
      }
      sqlQuery += ` ORDER BY c.name ASC`;
      const constituencies = await query(sqlQuery, params);
      res.json(constituencies);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/constituencies", authenticateUser, async (req, res) => {
    try {
      const { id, name, district_id, state_id } = req.body;
      const constId = id || `const_${Date.now()}`;
      await execute(`INSERT INTO dbo.constituencies (id, name, district_id, state_id) VALUES (@id, @name, @district_id, @state_id)`, 
        { id: constId, name, district_id, state_id });
      res.json({ id: constId, name, district_id, state_id });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/constituencies/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.constituencies WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Booths
  app.get("/api/booths", optionalAuth, async (req, res) => {
    try {
      const { constituencyId, mandalId } = req.query;
      let sqlQuery = `SELECT b.*, c.name as constituency_name, m.name as mandal_name 
                      FROM dbo.booths b 
                      LEFT JOIN dbo.constituencies c ON b.constituency_id = c.id
                      LEFT JOIN dbo.mandals m ON b.mandal_id = m.id WHERE 1=1`;
      const params: Record<string, any> = {};
      if (constituencyId) {
        sqlQuery += ` AND b.constituency_id = @constituencyId`;
        params.constituencyId = constituencyId;
      }
      if (mandalId) {
        sqlQuery += ` AND b.mandal_id = @mandalId`;
        params.mandalId = mandalId;
      }
      sqlQuery += ` ORDER BY b.booth_number ASC, b.name ASC`;
      const booths = await query(sqlQuery, params);
      res.json(booths);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/booths", authenticateUser, async (req, res) => {
    try {
      const { id, booth_number, name, constituency_id, mandal_id, total_voters, address } = req.body;
      const boothId = id || `booth_${Date.now()}`;
      await execute(
        `INSERT INTO dbo.booths (id, booth_number, name, constituency_id, mandal_id, total_voters, address)
         VALUES (@id, @booth_number, @name, @constituency_id, @mandal_id, @total_voters, @address)`,
        { id: boothId, booth_number: String(booth_number), name, constituency_id, mandal_id: mandal_id || null, total_voters: total_voters || 0, address: address || '' }
      );
      res.json({ id: boothId, booth_number, name, constituency_id, mandal_id, total_voters, address });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/booths/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.booths WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 3. Mandals & Mandal Members
  // ============================================================================

  app.get("/api/mandals", optionalAuth, async (req, res) => {
    try {
      const { constituencyId } = req.query;
      let sqlQuery = `SELECT m.*, c.name as constituency_name, 
                      (SELECT COUNT(*) FROM dbo.mandal_members mm WHERE mm.mandal_id = m.id) as member_count
                      FROM dbo.mandals m 
                      LEFT JOIN dbo.constituencies c ON m.constituency_id = c.id WHERE 1=1`;
      const params: Record<string, any> = {};
      if (constituencyId) {
        sqlQuery += ` AND m.constituency_id = @constituencyId`;
        params.constituencyId = constituencyId;
      }
      sqlQuery += ` ORDER BY m.name ASC`;
      const mandals = await query(sqlQuery, params);
      res.json(mandals);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/mandals", authenticateUser, async (req, res) => {
    try {
      const { id, name, mandal_code, president_name, president_phone, voter_count, population, state_id, district_id, constituency_id } = req.body;
      const mandalId = id || `mandal_${Date.now()}`;
      await execute(
        `INSERT INTO dbo.mandals (id, name, mandal_code, president_name, president_phone, voter_count, population, state_id, district_id, constituency_id)
         VALUES (@id, @name, @mandal_code, @president_name, @president_phone, @voter_count, @population, @state_id, @district_id, @constituency_id)`,
        { id: mandalId, name, mandal_code, president_name: president_name || '', president_phone: president_phone || '', voter_count: voter_count || 0, population: population || 0, state_id: state_id || null, district_id: district_id || null, constituency_id: constituency_id || null }
      );
      res.json({ id: mandalId, name, mandal_code });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/mandals/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { name, mandal_code, president_name, president_phone, voter_count, population } = req.body;
      await execute(
        `UPDATE dbo.mandals 
         SET name = COALESCE(@name, name),
             mandal_code = COALESCE(@mandal_code, mandal_code),
             president_name = COALESCE(@president_name, president_name),
             president_phone = COALESCE(@president_phone, president_phone),
             voter_count = COALESCE(@voter_count, voter_count),
             population = COALESCE(@population, population)
         WHERE id = @id`,
        { id, name, mandal_code, president_name, president_phone, voter_count, population }
      );
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/mandals/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.mandals WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Mandal Members
  app.get("/api/mandals/:mandalId/members", optionalAuth, async (req, res) => {
    try {
      const { mandalId } = req.params;
      const { categoryKey } = req.query;
      let sqlQuery = `SELECT * FROM dbo.mandal_members WHERE mandal_id = @mandalId`;
      const params: Record<string, any> = { mandalId };
      if (categoryKey) {
        sqlQuery += ` AND category_key = @categoryKey`;
        params.categoryKey = categoryKey;
      }
      sqlQuery += ` ORDER BY created_at DESC`;
      const members = await query(sqlQuery, params);
      res.json(members);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/mandals/:mandalId/members", authenticateUser, async (req, res) => {
    try {
      const { mandalId } = req.params;
      const { id, name, phone, voter_id, designation, category_key } = req.body;
      const memberId = id || `member_${Date.now()}_${Math.floor(Math.random()*1000)}`;
      await execute(
        `INSERT INTO dbo.mandal_members (id, mandal_id, name, phone, voter_id, designation, category_key)
         VALUES (@id, @mandal_id, @name, @phone, @voter_id, @designation, @category_key)`,
        { id: memberId, mandal_id: mandalId, name, phone: phone || '', voter_id: voter_id || '', designation: designation || '', category_key }
      );
      res.json({ id: memberId, mandal_id: mandalId, name, category_key });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/mandals/members/:memberId", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.mandal_members WHERE id = @id`, { id: req.params.memberId });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 4. Voters Directory & Roster
  // ============================================================================

  app.get("/api/voters", optionalAuth, async (req, res) => {
    try {
      const { 
        boothId, mandalId, constituencyId, search, 
        gender, caste, voting_status, is_karyakarta,
        page = '1', limit = '50' 
      } = req.query;

      let whereConditions: string[] = ['1=1'];
      const params: Record<string, any> = {};

      if (boothId) {
        whereConditions.push(`v.booth_id = @boothId`);
        params.boothId = boothId;
      }
      if (mandalId) {
        whereConditions.push(`v.mandal_id = @mandalId`);
        params.mandalId = mandalId;
      }
      if (constituencyId) {
        whereConditions.push(`v.constituency_id = @constituencyId`);
        params.constituencyId = constituencyId;
      }
      if (gender) {
        whereConditions.push(`v.gender = @gender`);
        params.gender = gender;
      }
      if (caste) {
        whereConditions.push(`v.caste = @caste`);
        params.caste = caste;
      }
      if (voting_status) {
        whereConditions.push(`v.voting_status = @voting_status`);
        params.voting_status = voting_status;
      }
      if (is_karyakarta !== undefined && is_karyakarta !== '') {
        whereConditions.push(`v.is_karyakarta = @is_karyakarta`);
        params.is_karyakarta = is_karyakarta === 'true' || is_karyakarta === '1' ? 1 : 0;
      }
      if (search) {
        whereConditions.push(`(v.name LIKE @search OR v.voter_id LIKE @search OR v.mobile LIKE @search OR v.house_no LIKE @search)`);
        params.search = `%${search}%`;
      }

      const whereSql = whereConditions.join(' AND ');

      // Get total count
      const countResult = await query(`SELECT COUNT(*) as total FROM dbo.voters v WHERE ${whereSql}`, params);
      const total = countResult[0]?.total || 0;

      const pageNum = Math.max(1, parseInt(String(page), 10));
      const limitNum = Math.max(1, Math.min(500, parseInt(String(limit), 10)));
      const offset = (pageNum - 1) * limitNum;

      params.offset = offset;
      params.limitNum = limitNum;

      const sqlQuery = `
        SELECT v.*, b.name as booth_name, b.booth_number, m.name as mandal_name, c.name as constituency_name
        FROM dbo.voters v
        LEFT JOIN dbo.booths b ON v.booth_id = b.id
        LEFT JOIN dbo.mandals m ON v.mandal_id = m.id
        LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id
        WHERE ${whereSql}
        ORDER BY v.part_no ASC, CAST(CASE WHEN ISNUMERIC(v.sr_no)=1 THEN v.sr_no ELSE 0 END AS INT) ASC, v.name ASC
        OFFSET @offset ROWS FETCH NEXT @limitNum ROWS ONLY
      `;

      const voters = await query(sqlQuery, params);

      res.json({
        data: voters,
        total,
        page: pageNum,
        totalPages: Math.ceil(total / limitNum),
        limit: limitNum
      });
    } catch (error: any) {
      console.error('Error fetching voters:', error);
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/voters", authenticateUser, async (req, res) => {
    try {
      const v = req.body;
      const id = v.id || `voter_${Date.now()}_${Math.floor(Math.random()*10000)}`;
      await execute(
        `INSERT INTO dbo.voters (
          id, voter_id, name, relation_name, relation_type, gender, age, 
          part_no, sr_no, mobile, email, address, house_no, village, 
          caste, occupation, is_karyakarta, voting_status, party_inclination, 
          booth_id, mandal_id, constituency_id, state_id, district_id
        ) VALUES (
          @id, @voter_id, @name, @relation_name, @relation_type, @gender, @age,
          @part_no, @sr_no, @mobile, @email, @address, @house_no, @village,
          @caste, @occupation, @is_karyakarta, @voting_status, @party_inclination,
          @booth_id, @mandal_id, @constituency_id, @state_id, @district_id
        )`,
        {
          id,
          voter_id: v.voter_id || v.voterId || id,
          name: v.name,
          relation_name: v.relation_name || v.relationName || '',
          relation_type: v.relation_type || v.relationType || 'Father',
          gender: v.gender || 'Male',
          age: v.age ? parseInt(v.age, 10) : null,
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
          booth_id: v.booth_id || v.boothId,
          mandal_id: v.mandal_id || v.mandalId || null,
          constituency_id: v.constituency_id || v.constituencyId,
          state_id: v.state_id || v.stateId || null,
          district_id: v.district_id || v.districtId || null
        }
      );
      res.json({ id, ...v });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Bulk voter import
  app.post("/api/voters/bulk", authenticateUser, async (req, res) => {
    try {
      const { voters } = req.body;
      if (!Array.isArray(voters) || voters.length === 0) {
        return res.status(400).json({ error: 'Expected non-empty array of voters' });
      }

      let insertedCount = 0;
      for (const v of voters) {
        const id = v.id || `voter_${Date.now()}_${Math.floor(Math.random()*100000)}`;
        try {
          await execute(
            `IF NOT EXISTS (SELECT 1 FROM dbo.voters WHERE voter_id = @voter_id)
             BEGIN
               INSERT INTO dbo.voters (
                 id, voter_id, name, relation_name, relation_type, gender, age, 
                 part_no, sr_no, mobile, address, house_no, village, 
                 caste, is_karyakarta, voting_status, party_inclination, 
                 booth_id, mandal_id, constituency_id, state_id, district_id
               ) VALUES (
                 @id, @voter_id, @name, @relation_name, @relation_type, @gender, @age,
                 @part_no, @sr_no, @mobile, @address, @house_no, @village,
                 @caste, @is_karyakarta, @voting_status, @party_inclination,
                 @booth_id, @mandal_id, @constituency_id, @state_id, @district_id
               );
             END`,
            {
              id,
              voter_id: v.voter_id || v.voterId || id,
              name: v.name,
              relation_name: v.relation_name || v.relationName || '',
              relation_type: v.relation_type || v.relationType || 'Father',
              gender: v.gender || 'Male',
              age: v.age ? parseInt(v.age, 10) : null,
              part_no: v.part_no || v.partNo || '',
              sr_no: v.sr_no || v.srNo || '',
              mobile: v.mobile || '',
              address: v.address || '',
              house_no: v.house_no || v.houseNo || '',
              village: v.village || '',
              caste: v.caste || '',
              is_karyakarta: v.is_karyakarta || v.isKaryakarta ? 1 : 0,
              voting_status: v.voting_status || (v.voted ? 'voted' : 'unvoted') || 'unvoted',
              party_inclination: v.party_inclination || v.partyInclination || 'Neutral',
              booth_id: v.booth_id || v.boothId,
              mandal_id: v.mandal_id || v.mandalId || null,
              constituency_id: v.constituency_id || v.constituencyId,
              state_id: v.state_id || v.stateId || null,
              district_id: v.district_id || v.districtId || null
            }
          );
          insertedCount++;
        } catch (itemErr) {
          console.warn('Skipped voter item due to error:', itemErr);
        }
      }

      res.json({ success: true, count: insertedCount });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/voters/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const v = req.body;
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
         WHERE id = @id`,
        {
          id,
          name: v.name,
          relation_name: v.relation_name || v.relationName,
          gender: v.gender,
          age: v.age !== undefined ? parseInt(v.age, 10) : null,
          mobile: v.mobile,
          house_no: v.house_no || v.houseNo,
          caste: v.caste,
          is_karyakarta: v.is_karyakarta !== undefined ? (v.is_karyakarta ? 1 : 0) : (v.isKaryakarta !== undefined ? (v.isKaryakarta ? 1 : 0) : null),
          voting_status: v.voting_status || (v.voted !== undefined ? (v.voted ? 'voted' : 'unvoted') : null),
          party_inclination: v.party_inclination || v.partyInclination,
          booth_id: v.booth_id || v.boothId,
          mandal_id: v.mandal_id || v.mandalId
        }
      );
      res.json({ success: true, message: 'Voter updated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/voters/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.voters WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 5. Volunteers / Karyakartas & Booth Agents
  // ============================================================================

  app.get("/api/volunteers", optionalAuth, async (req, res) => {
    try {
      const volunteers = await query(`SELECT * FROM dbo.volunteers ORDER BY created_at DESC`);
      res.json(volunteers);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/volunteers", authenticateUser, async (req, res) => {
    try {
      const v = req.body;
      const id = v.id || `vol_${Date.now()}`;
      await execute(
        `INSERT INTO dbo.volunteers (
          id, voter_doc_id, voter_id, name, aadhar_number, mobile, admin_id, 
          status, tasks, performance_rating, assigned_booth_id, assigned_booth_name
        ) VALUES (
          @id, @voter_doc_id, @voter_id, @name, @aadhar_number, @mobile, @admin_id,
          @status, @tasks, @performance_rating, @assigned_booth_id, @assigned_booth_name
        )`,
        {
          id,
          voter_doc_id: v.voter_doc_id || v.voterDocId,
          voter_id: v.voter_id || v.voterId,
          name: v.name,
          aadhar_number: v.aadhar_number || v.aadharNumber || '',
          mobile: v.mobile || '',
          admin_id: v.admin_id || v.adminId || (req as any).user.uid,
          status: v.status || 'Active',
          tasks: JSON.stringify(v.tasks || []),
          performance_rating: v.performance_rating || v.performanceRating || 5.0,
          assigned_booth_id: v.assigned_booth_id || v.assignedBoothId || null,
          assigned_booth_name: v.assigned_booth_name || v.assignedBoothName || ''
        }
      );
      res.json({ id, ...v });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/volunteers/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.volunteers WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Booth Agents
  app.get("/api/booths/agents", optionalAuth, async (req, res) => {
    try {
      const agents = await query(`SELECT * FROM dbo.booth_agents ORDER BY created_at DESC`);
      res.json(agents);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/booths/agents", authenticateUser, async (req, res) => {
    try {
      const a = req.body;
      const id = a.id || `agent_${Date.now()}`;
      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.booth_agents WHERE id = @id)
         BEGIN
           UPDATE dbo.booth_agents SET
             designation = COALESCE(@designation, designation),
             agent_name = COALESCE(@agent_name, agent_name),
             agent_mobile = COALESCE(@agent_mobile, agent_mobile),
             agent_aadhar = COALESCE(@agent_aadhar, agent_aadhar)
           WHERE id = @id
         END
         ELSE
         BEGIN
           INSERT INTO dbo.booth_agents (
             id, admin_id, booth_id, booth_number, booth_name, 
             agent_volunteer_id, agent_name, agent_aadhar, agent_mobile, designation
           ) VALUES (
             @id, @admin_id, @booth_id, @booth_number, @booth_name,
             @agent_volunteer_id, @agent_name, @agent_aadhar, @agent_mobile, @designation
           )
         END`,
        {
          id,
          admin_id: a.admin_id || a.adminId || (req as any).user.uid,
          booth_id: a.booth_id || a.boothId || '',
          booth_number: a.booth_number || a.boothNumber || '',
          booth_name: a.booth_name || a.boothName || '',
          agent_volunteer_id: a.agent_volunteer_id || a.agentVolunteerDocId || '',
          agent_name: a.agent_name || a.agentName || '',
          agent_aadhar: a.agent_aadhar || a.agentAadhar || '',
          agent_mobile: a.agent_mobile || a.agentMobile || '',
          designation: a.designation || 'Booth In-charge'
        }
      );
      res.json({ id, ...a });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/booths/agents/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.booth_agents WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
        try { witnesses = b.witnesses ? JSON.parse(b.witnesses) : []; } catch {}
        return {
          id: b.id,
          voterDocId: b.voter_doc_id,
          voterId: b.voter_id,
          voterName: b.voter_name,
          aadharNumber: b.aadhar_number,
          amount: b.amount,
          benefitName: b.benefit_name,
          benefitType: b.benefit_type,
          date: b.distribution_date ? new Date(b.distribution_date).toISOString().split('T')[0] : '',
          adminId: b.admin_id,
          notes: b.notes,
          createdAt: b.created_at,
          witnessName: b.witness_name,
          witnessVoterId: b.witness_voter_id,
          witnessVoterDocId: b.witness_voter_doc_id,
          witnesses
        };
      });
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/benefits", authenticateUser, async (req, res) => {
    try {
      const b = req.body;
      const id = b.id || `ben_${Date.now()}`;
      await execute(
        `INSERT INTO dbo.benefits (
          id, voter_doc_id, voter_id, voter_name, aadhar_number, amount, 
          benefit_name, benefit_type, distribution_date, admin_id, notes, 
          witness_name, witness_voter_id, witness_voter_doc_id, witnesses
        ) VALUES (
          @id, @voter_doc_id, @voter_id, @voter_name, @aadhar_number, @amount,
          @benefit_name, @benefit_type, @distribution_date, @admin_id, @notes,
          @witness_name, @witness_voter_id, @witness_voter_doc_id, @witnesses
        )`,
        {
          id,
          voter_doc_id: b.voter_doc_id || b.voterDocId,
          voter_id: b.voter_id || b.voterId,
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
          witness_voter_doc_id: b.witness_voter_doc_id || b.witnessVoterDocId || '',
          witnesses: JSON.stringify(b.witnesses || [])
        }
      );
      res.json({ id, ...b });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/benefits/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.benefits WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
          id: b.id,
          adminId: b.admin_id,
          totalBudget: b.total_budget,
          electionYear: b.election_year,
          allocations
        };
      });
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/finance/budgets", authenticateUser, async (req, res) => {
    try {
      const b = req.body;
      const id = b.id || `budget_${Date.now()}`;
      const adminId = b.admin_id || b.adminId || (req as any).user.uid;
      const allocationsJson = JSON.stringify(b.allocations || {});

      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.campaign_budgets WHERE admin_id = @admin_id)
         BEGIN
           UPDATE dbo.campaign_budgets 
           SET total_budget = @total_budget, election_year = @election_year, allocations = @allocations, updated_at = SYSUTCDATETIME()
           WHERE admin_id = @admin_id;
         END
         ELSE
         BEGIN
           INSERT INTO dbo.campaign_budgets (id, admin_id, total_budget, election_year, allocations)
           VALUES (@id, @admin_id, @total_budget, @election_year, @allocations);
         END`,
        {
          id,
          admin_id: adminId,
          total_budget: b.totalBudget || b.total_budget || 0,
          election_year: String(b.electionYear || b.election_year || '2026'),
          allocations: allocationsJson
        }
      );
      res.json({ id, ...b });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("/api/finance/transactions", optionalAuth, async (req, res) => {
    try {
      const transactions = await query(`SELECT * FROM dbo.finance_transactions ORDER BY transaction_date DESC, created_at DESC`);
      const formatted = transactions.map(t => ({
        id: t.id,
        adminId: t.admin_id,
        type: t.type,
        title: t.title,
        amount: t.amount,
        category: t.category,
        date: t.transaction_date,
        paymentMethod: t.payment_method,
        donorName: t.donor_name,
        notes: t.notes
      }));
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/finance/transactions", authenticateUser, async (req, res) => {
    try {
      const t = req.body;
      const id = t.id || `tx_${Date.now()}`;
      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.finance_transactions WHERE id = @id)
         BEGIN
           UPDATE dbo.finance_transactions SET
             type = @type,
             title = @title,
             amount = @amount,
             category = @category,
             transaction_date = @transaction_date,
             payment_method = @payment_method,
             donor_name = @donor_name,
             notes = @notes
           WHERE id = @id;
         END
         ELSE
         BEGIN
           INSERT INTO dbo.finance_transactions (
             id, admin_id, type, title, amount, category, 
             transaction_date, payment_method, donor_name, notes
           ) VALUES (
             @id, @admin_id, @type, @title, @amount, @category,
             @transaction_date, @payment_method, @donor_name, @notes
           );
         END`,
        {
          id,
          admin_id: t.admin_id || t.adminId || (req as any).user.uid,
          type: t.type || 'expense',
          title: t.title,
          amount: t.amount ? parseFloat(t.amount) : 0,
          category: t.category,
          transaction_date: t.date || t.transaction_date || new Date().toISOString().split('T')[0],
          payment_method: t.paymentMethod || t.payment_method || 'Cash',
          donor_name: t.donorName || t.donor_name || '',
          notes: t.notes || ''
        }
      );
      res.json({ id, ...t });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/finance/transactions/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.finance_transactions WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/whatsapp/configs", authenticateUser, async (req, res) => {
    try {
      const c = req.body;
      const id = c.id || `wa_cfg_${Date.now()}`;
      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.whatsapp_configs WHERE id = @id)
         BEGIN
           UPDATE dbo.whatsapp_configs SET
             tenant_type = @tenant_type,
             vendor_name = @vendor_name,
             phone_number_id = @phone_number_id,
             waba_id = @waba_id,
             access_token = @access_token,
             phone_number = @phone_number,
             status = @status
           WHERE id = @id;
         END
         ELSE
         BEGIN
           INSERT INTO dbo.whatsapp_configs (
             id, admin_id, tenant_type, vendor_name, phone_number_id, 
             waba_id, access_token, phone_number, status
           ) VALUES (
             @id, @admin_id, @tenant_type, @vendor_name, @phone_number_id,
             @waba_id, @access_token, @phone_number, @status
           );
         END`,
        {
          id,
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
      res.json({ id, ...c });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/whatsapp/configs/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.whatsapp_configs WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/whatsapp/templates", authenticateUser, async (req, res) => {
    try {
      const t = req.body;
      const id = t.id || `wa_tpl_${Date.now()}`;
      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.whatsapp_templates WHERE id = @id)
         BEGIN
           UPDATE dbo.whatsapp_templates SET
             name = @name,
             category = @category,
             language = @language,
             body_text = @body_text,
             status = @status
           WHERE id = @id;
         END
         ELSE
         BEGIN
           INSERT INTO dbo.whatsapp_templates (id, admin_id, name, category, language, body_text, status)
           VALUES (@id, @admin_id, @name, @category, @language, @body_text, @status);
         END`,
        {
          id,
          admin_id: t.admin_id || t.adminId || (req as any).user.uid,
          name: t.name,
          category: t.category || 'MARKETING',
          language: t.language || 'en',
          body_text: t.bodyText || t.body_text || '',
          status: t.status || 'APPROVED'
        }
      );
      res.json({ id, ...t });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/whatsapp/templates/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.whatsapp_templates WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/whatsapp/broadcasts", authenticateUser, async (req, res) => {
    try {
      const b = req.body;
      const id = b.id || `broadcast_${Date.now()}`;
      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.whatsapp_broadcasts WHERE id = @id)
         BEGIN
           UPDATE dbo.whatsapp_broadcasts SET
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
           WHERE id = @id;
         END
         ELSE
         BEGIN
           INSERT INTO dbo.whatsapp_broadcasts (
             id, admin_id, campaign_name, sender_config_id, sender_phone, 
             template_id, template_name, media_url, media_type, status, 
             total_count, success_count, failed_count
           ) VALUES (
             @id, @admin_id, @campaign_name, @sender_config_id, @sender_phone,
             @template_id, @template_name, @media_url, @media_type, @status,
             @total_count, @success_count, @failed_count
           );
         END`,
        {
          id,
          admin_id: b.admin_id || b.adminId || (req as any).user.uid,
          campaign_name: b.campaignName || b.campaign_name,
          sender_config_id: b.senderConfigId || b.sender_config_id || '',
          sender_phone: b.senderPhone || b.sender_phone || '',
          template_id: b.templateId || b.template_id || null,
          template_name: b.templateName || b.template_name || '',
          media_url: b.mediaUrl || b.media_url || null,
          media_type: b.mediaType || b.media_type || 'none',
          status: b.status || 'Completed',
          total_count: b.totalCount !== undefined ? b.totalCount : (b.total_count !== undefined ? b.total_count : 0),
          success_count: b.successCount !== undefined ? b.successCount : (b.success_count !== undefined ? b.success_count : 0),
          failed_count: b.failedCount !== undefined ? b.failedCount : (b.failed_count !== undefined ? b.failed_count : 0)
        }
      );
      res.json({ id, ...b });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/whatsapp/broadcasts/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.whatsapp_broadcasts WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // ============================================================================
  // 8.5. Elections & Political Parties
  // ============================================================================

  // Elections
  app.get("/api/elections", optionalAuth, async (req, res) => {
    try {
      const elections = await query(`SELECT * FROM dbo.elections ORDER BY year DESC`);
      res.json(elections);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/elections", authenticateUser, async (req, res) => {
    try {
      const { id, year, title, description, status } = req.body;
      const electionId = id || `elec_${year || Date.now()}`;
      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.elections WHERE id = @id)
         BEGIN
           UPDATE dbo.elections SET
             year = @year,
             title = @title,
             description = @description,
             status = @status
           WHERE id = @id;
         END
         ELSE
         BEGIN
           INSERT INTO dbo.elections (id, year, title, description, status)
           VALUES (@id, @year, @title, @description, @status);
         END`,
        {
          id: electionId,
          year: parseInt(year, 10),
          title: title || `${year} Election`,
          description: description || '',
          status: status || 'Upcoming'
        }
      );
      res.json({ id: electionId, year, title, description, status });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
        { id, year: year ? parseInt(year, 10) : null, title, description, status }
      );
      res.json({ success: true, message: 'Election updated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/elections/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.elections WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/parties", authenticateUser, async (req, res) => {
    try {
      const { id, name, abbreviation, logoUrl, color } = req.body;
      const partyId = id || `party_${Date.now()}`;
      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.political_parties WHERE id = @id)
         BEGIN
           UPDATE dbo.political_parties SET
             name = @name,
             abbreviation = @abbreviation,
             logo_url = @logo_url,
             color = @color
           WHERE id = @id;
         END
         ELSE
         BEGIN
           INSERT INTO dbo.political_parties (id, name, abbreviation, logo_url, color)
           VALUES (@id, @name, @abbreviation, @logo_url, @color);
         END`,
        {
          id: partyId,
          name,
          abbreviation: abbreviation || name.substring(0, 3).toUpperCase(),
          logo_url: logoUrl || '',
          color: color || '#3b82f6'
        }
      );
      res.json({ id: partyId, name, abbreviation, logoUrl, color });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
        { id, name, abbreviation, logo_url: logoUrl, color }
      );
      res.json({ success: true, message: 'Party updated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/parties/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.political_parties WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
        try { fields = t.fields ? JSON.parse(t.fields) : []; } catch {}
        return {
          id: t.id,
          name: t.name,
          description: t.description,
          isSystem: Boolean(t.is_system),
          fields
        };
      });
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/surveys/templates", authenticateUser, async (req, res) => {
    try {
      const t = req.body;
      const id = t.id || `tpl_${Date.now()}`;
      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.survey_templates WHERE id = @id)
         BEGIN
           UPDATE dbo.survey_templates SET
             name = @name,
             description = @description,
             is_system = @is_system,
             fields = @fields
           WHERE id = @id;
         END
         ELSE
         BEGIN
           INSERT INTO dbo.survey_templates (id, name, description, is_system, fields)
           VALUES (@id, @name, @description, @is_system, @fields);
         END`,
        {
          id,
          name: t.name,
          description: t.description || '',
          is_system: t.isSystem || t.is_system ? 1 : 0,
          fields: JSON.stringify(t.fields || [])
        }
      );
      res.json({ id, ...t });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
          id,
          name: t.name,
          description: t.description,
          fields: t.fields ? JSON.stringify(t.fields) : null
        }
      );
      res.json({ success: true, message: 'Template updated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/surveys/templates/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.survey_templates WHERE id = @id AND is_system = 0`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Active Survey Campaigns
  app.get("/api/surveys", optionalAuth, async (req, res) => {
    try {
      const surveys = await query(`SELECT * FROM dbo.surveys ORDER BY created_at DESC`);
      const formatted = surveys.map(s => {
        let assignedTo = [];
        try { assignedTo = s.assigned_to ? JSON.parse(s.assigned_to) : []; } catch {}
        let linkedPartyIds = [];
        try { linkedPartyIds = s.linked_party_ids ? JSON.parse(s.linked_party_ids) : []; } catch {}
        return {
          id: s.id,
          title: s.title,
          description: s.description,
          electionId: s.election_id,
          electionYear: s.election_year,
          status: s.status,
          templateId: s.template_id,
          assignedTo,
          linkedPartyIds
        };
      });
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/surveys", authenticateUser, async (req, res) => {
    try {
      const s = req.body;
      const id = s.id || `survey_${Date.now()}`;
      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.surveys WHERE id = @id)
         BEGIN
           UPDATE dbo.surveys SET
             title = @title,
             description = @description,
             election_id = @election_id,
             election_year = @election_year,
             assigned_to = @assigned_to,
             status = @status,
             template_id = @template_id,
             linked_party_ids = @linked_party_ids
           WHERE id = @id;
         END
         ELSE
         BEGIN
           INSERT INTO dbo.surveys (id, title, description, election_id, election_year, assigned_to, status, template_id, linked_party_ids)
           VALUES (@id, @title, @description, @election_id, @election_year, @assigned_to, @status, @template_id, @linked_party_ids);
         END`,
        {
          id,
          title: s.title,
          description: s.description || '',
          election_id: s.electionId || s.election_id || 'elec_2026',
          election_year: s.electionYear || s.election_year || 2026,
          assigned_to: JSON.stringify(s.assignedTo || []),
          status: s.status || 'Draft',
          template_id: s.templateId || s.template_id || null,
          linked_party_ids: JSON.stringify(s.linkedPartyIds || [])
        }
      );
      res.json({ id, ...s });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.put("/api/surveys/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const s = req.body;
      await execute(
        `UPDATE dbo.surveys 
         SET title = COALESCE(@title, title),
             description = COALESCE(@description, description),
             election_id = COALESCE(@election_id, election_id),
             election_year = COALESCE(@election_year, election_year),
             assigned_to = COALESCE(@assigned_to, assigned_to),
             status = COALESCE(@status, status),
             template_id = COALESCE(@template_id, template_id),
             linked_party_ids = COALESCE(@linked_party_ids, linked_party_ids)
         WHERE id = @id`,
        {
          id,
          title: s.title,
          description: s.description,
          election_id: s.electionId || s.election_id,
          election_year: s.electionYear || s.election_year,
          assigned_to: s.assignedTo ? JSON.stringify(s.assignedTo) : null,
          status: s.status,
          template_id: s.templateId || s.template_id,
          linked_party_ids: s.linkedPartyIds ? JSON.stringify(s.linkedPartyIds) : null
        }
      );
      res.json({ success: true, message: 'Survey updated' });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/surveys/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.surveys WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  // Voter Sentiments
  app.get("/api/voter-sentiments", optionalAuth, async (req, res) => {
    try {
      const { voterDocId, surveyId } = req.query;
      let sqlQuery = `SELECT * FROM dbo.voter_sentiments WHERE 1=1`;
      const params: Record<string, any> = {};
      if (voterDocId) {
        sqlQuery += ` AND voter_id = @voterDocId`;
        params.voterDocId = voterDocId;
      }
      sqlQuery += ` ORDER BY created_at DESC`;
      const sentiments = await query(sqlQuery, params);
      const formatted = sentiments.map(s => {
        let keyConcerns = [];
        try { keyConcerns = s.key_concerns ? JSON.parse(s.key_concerns) : []; } catch {}
        return {
          id: s.id,
          voterDocId: s.voter_id,
          voterName: s.voter_name,
          electionId: s.election_id,
          electionYear: s.election_year,
          favoredPartyId: s.favored_party_id,
          favoredPartyName: s.favored_party_name,
          sentimentScore: s.sentiment_score,
          keyConcerns,
          constituencyId: s.constituency_id,
          recordedBy: s.recorded_by,
          recordedByName: s.recorded_by_name,
          createdAt: s.created_at
        };
      });
      res.json(formatted);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post("/api/voter-sentiments", authenticateUser, async (req, res) => {
    try {
      const s = req.body;
      const id = s.id || `sent_${Date.now()}`;
      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.voter_sentiments WHERE id = @id)
         BEGIN
           UPDATE dbo.voter_sentiments SET
             voter_name = @voter_name,
             favored_party_id = @favored_party_id,
             favored_party_name = @favored_party_name,
             sentiment_score = @sentiment_score,
             key_concerns = @key_concerns
           WHERE id = @id;
         END
         ELSE
         BEGIN
           INSERT INTO dbo.voter_sentiments (
             id, voter_id, voter_name, election_id, election_year, 
             favored_party_id, favored_party_name, sentiment_score, 
             key_concerns, constituency_id, recorded_by, recorded_by_name
           ) VALUES (
             @id, @voter_id, @voter_name, @election_id, @election_year,
             @favored_party_id, @favored_party_name, @sentiment_score,
             @key_concerns, @constituency_id, @recorded_by, @recorded_by_name
           );
         END`,
        {
          id,
          voter_id: s.voterDocId || s.voter_id,
          voter_name: s.voterName || s.voter_name,
          election_id: s.electionId || s.election_id || 'elec_2026',
          election_year: s.electionYear || s.election_year || 2026,
          favored_party_id: s.favoredPartyId || s.favored_party_id || 'party_default',
          favored_party_name: s.favoredPartyName || s.favored_party_name || 'BJP',
          sentiment_score: s.sentimentScore || s.sentiment_score || 5.0,
          key_concerns: JSON.stringify(s.keyConcerns || []),
          constituency_id: s.constituencyId || s.constituency_id || null,
          recorded_by: s.recordedBy || (req as any).user?.uid || 'system',
          recorded_by_name: s.recordedByName || (req as any).user?.name || 'Staff'
        }
      );
      res.json({ id, ...s });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  app.delete("/api/voter-sentiments/:id", authenticateUser, async (req, res) => {
    try {
      await execute(`DELETE FROM dbo.voter_sentiments WHERE id = @id`, { id: req.params.id });
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
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
      res.status(500).json({ error: error.message });
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
