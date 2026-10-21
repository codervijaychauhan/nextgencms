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

async function getRequesterInfo(reqUser: any): Promise<{ isSuperAdmin: boolean; userRow: any; reqUid: string }> {
  if (!reqUser) {
    return { isSuperAdmin: false, userRow: null, reqUid: '' };
  }

  const email = (reqUser.email || '').toLowerCase().trim();
  const uid = reqUser.uid || reqUser.user_id || reqUser.id || '';

  // 1. Check if root super admin by owner email
  if (email === 'vijaychauhanofficial01@gmail.com') {
    return { isSuperAdmin: true, userRow: null, reqUid: uid || 'usr_super_admin_vijay' };
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
  const effectiveUid = userRow?.id || uid || email;

  return { isSuperAdmin, userRow, reqUid: effectiveUid };
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
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'mandal_id')
          ALTER TABLE dbo.users ADD mandal_id NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'panchayat_id')
          ALTER TABLE dbo.users ADD panchayat_id NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.users') AND name = 'ward_id')
          ALTER TABLE dbo.users ADD ward_id NVARCHAR(MAX) NULL;
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

      IF OBJECT_ID(N'dbo.user_invites', N'U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.user_invites') AND name = 'mandal_id')
          ALTER TABLE dbo.user_invites ADD mandal_id NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.user_invites') AND name = 'panchayat_id')
          ALTER TABLE dbo.user_invites ADD panchayat_id NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.user_invites') AND name = 'ward_id')
          ALTER TABLE dbo.user_invites ADD ward_id NVARCHAR(MAX) NULL;
      END

      IF OBJECT_ID(N'dbo.panchayats', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.panchayats (
          id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          code VARCHAR(50) NULL,
          type VARCHAR(100) DEFAULT 'Gram Panchayat',
          mandal_id INT NULL,
          constituency_id INT NULL,
          district_id INT NULL,
          state_id INT NULL,
          population INT DEFAULT 0,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
          created_by VARCHAR(128) NULL
        );
      END

      IF OBJECT_ID(N'dbo.wards', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.wards (
          id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          ward_number VARCHAR(50) NULL,
          type VARCHAR(100) DEFAULT 'Ward',
          panchayat_id INT NULL,
          mandal_id INT NULL,
          constituency_id INT NULL,
          district_id INT NULL,
          state_id INT NULL,
          population INT DEFAULT 0,
          total_voters INT DEFAULT 0,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
          created_by VARCHAR(128) NULL
        );
      END

      IF OBJECT_ID(N'dbo.booths', N'U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.booths') AND name = 'panchayat_id')
          ALTER TABLE dbo.booths ADD panchayat_id INT NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.booths') AND name = 'ward_id')
          ALTER TABLE dbo.booths ADD ward_id INT NULL;
        IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('dbo.booths') AND name = 'booth_label')
          ALTER TABLE dbo.booths ADD booth_label VARCHAR(100) NULL;
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

      IF OBJECT_ID(N'dbo.mandals', N'U') IS NOT NULL AND COL_LENGTH('dbo.mandals', 'admin_id') IS NULL
        ALTER TABLE dbo.mandals ADD admin_id VARCHAR(64) NULL;

      IF OBJECT_ID(N'dbo.booths', N'U') IS NOT NULL AND COL_LENGTH('dbo.booths', 'created_by') IS NULL
        ALTER TABLE dbo.booths ADD created_by VARCHAR(128) NULL;

      IF OBJECT_ID(N'dbo.voters', N'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('dbo.voters', 'created_by') IS NULL
          ALTER TABLE dbo.voters ADD created_by VARCHAR(128) NULL;
        IF COL_LENGTH('dbo.voters', 'aadhar_number') IS NULL
          ALTER TABLE dbo.voters ADD aadhar_number VARCHAR(50) NULL;
        IF COL_LENGTH('dbo.voters', 'dob') IS NULL
          ALTER TABLE dbo.voters ADD dob VARCHAR(50) NULL;
        IF COL_LENGTH('dbo.voters', 'additional_mobile') IS NULL
          ALTER TABLE dbo.voters ADD additional_mobile VARCHAR(50) NULL;
        IF COL_LENGTH('dbo.voters', 'new_address') IS NULL
          ALTER TABLE dbo.voters ADD new_address NVARCHAR(MAX) NULL;
        IF COL_LENGTH('dbo.voters', 'education') IS NULL
          ALTER TABLE dbo.voters ADD education VARCHAR(100) NULL;
        IF COL_LENGTH('dbo.voters', 'vital_status') IS NULL
          ALTER TABLE dbo.voters ADD vital_status VARCHAR(50) DEFAULT 'Active';
        IF COL_LENGTH('dbo.voters', 'death_date') IS NULL
          ALTER TABLE dbo.voters ADD death_date VARCHAR(50) NULL;
        IF COL_LENGTH('dbo.voters', 'death_notes') IS NULL
          ALTER TABLE dbo.voters ADD death_notes NVARCHAR(MAX) NULL;
        IF COL_LENGTH('dbo.voters', 'physical_profile') IS NULL
          ALTER TABLE dbo.voters ADD physical_profile VARCHAR(50) DEFAULT 'General';
        IF COL_LENGTH('dbo.voters', 'disability_category') IS NULL
          ALTER TABLE dbo.voters ADD disability_category VARCHAR(50) DEFAULT 'None';
        IF COL_LENGTH('dbo.voters', 'eci_assistance_needed') IS NULL
          ALTER TABLE dbo.voters ADD eci_assistance_needed BIT DEFAULT 0;
        IF COL_LENGTH('dbo.voters', 'economic_category') IS NULL
          ALTER TABLE dbo.voters ADD economic_category VARCHAR(50) DEFAULT 'APL';
        IF COL_LENGTH('dbo.voters', 'income_range') IS NULL
          ALTER TABLE dbo.voters ADD income_range VARCHAR(50) DEFAULT '₹15,000 - ₹30,000';
        IF COL_LENGTH('dbo.voters', 'land_ownership') IS NULL
          ALTER TABLE dbo.voters ADD land_ownership VARCHAR(100) DEFAULT 'Small Farmer';
        IF COL_LENGTH('dbo.voters', 'ration_card_type') IS NULL
          ALTER TABLE dbo.voters ADD ration_card_type VARCHAR(50) NULL;
        IF COL_LENGTH('dbo.voters', 'ration_card_no') IS NULL
          ALTER TABLE dbo.voters ADD ration_card_no VARCHAR(50) NULL;
        IF COL_LENGTH('dbo.voters', 'panchayat_id') IS NULL
          ALTER TABLE dbo.voters ADD panchayat_id VARCHAR(64) NULL;
        IF COL_LENGTH('dbo.voters', 'panchayat_name') IS NULL
          ALTER TABLE dbo.voters ADD panchayat_name NVARCHAR(255) NULL;
        IF COL_LENGTH('dbo.voters', 'ward_id') IS NULL
          ALTER TABLE dbo.voters ADD ward_id VARCHAR(64) NULL;
        IF COL_LENGTH('dbo.voters', 'ward_name') IS NULL
          ALTER TABLE dbo.voters ADD ward_name NVARCHAR(255) NULL;
      END

      -- Panchayats / MC / ULBs Table
      IF OBJECT_ID(N'dbo.panchayats', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.panchayats (
          id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          name NVARCHAR(255) NOT NULL,
          code NVARCHAR(50) NULL,
          type NVARCHAR(50) DEFAULT 'Gram Panchayat',
          mandal_id INT NULL,
          constituency_id INT NULL,
          district_id INT NULL,
          state_id INT NULL,
          population INT NULL DEFAULT 0,
          created_by VARCHAR(128) NULL,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME()
        );
      END

      -- Wards / Villages Table
      IF OBJECT_ID(N'dbo.wards', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.wards (
          id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
          name NVARCHAR(255) NOT NULL,
          ward_number NVARCHAR(50) NULL,
          type NVARCHAR(50) DEFAULT 'Ward',
          panchayat_id INT NULL,
          mandal_id INT NULL,
          constituency_id INT NULL,
          district_id INT NULL,
          state_id INT NULL,
          population INT NULL DEFAULT 0,
          total_voters INT NULL DEFAULT 0,
          created_by VARCHAR(128) NULL,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME()
        );
      END

      IF OBJECT_ID(N'dbo.booths', N'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('dbo.booths', 'panchayat_id') IS NULL
          ALTER TABLE dbo.booths ADD panchayat_id VARCHAR(64) NULL;
        IF COL_LENGTH('dbo.booths', 'ward_id') IS NULL
          ALTER TABLE dbo.booths ADD ward_id VARCHAR(64) NULL;
        IF COL_LENGTH('dbo.booths', 'booth_label') IS NULL
          ALTER TABLE dbo.booths ADD booth_label NVARCHAR(100) NULL;
      END

      IF OBJECT_ID(N'dbo.states', N'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('dbo.states', 'population') IS NULL
          ALTER TABLE dbo.states ADD population INT NULL DEFAULT 0;
      END

      IF OBJECT_ID(N'dbo.districts', N'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('dbo.districts', 'population') IS NULL
          ALTER TABLE dbo.districts ADD population INT NULL DEFAULT 0;
      END

      IF OBJECT_ID(N'dbo.constituencies', N'U') IS NOT NULL
      BEGIN
        IF COL_LENGTH('dbo.constituencies', 'population') IS NULL
          ALTER TABLE dbo.constituencies ADD population INT NULL DEFAULT 0;
        IF COL_LENGTH('dbo.constituencies', 'category') IS NULL
          ALTER TABLE dbo.constituencies ADD category NVARCHAR(50) NULL DEFAULT 'General';
      END

      -- Dedicated Table for Voter Health & Economy (Linked with DB Voter ID, EPIC NO, and Aadhar Number)
      IF OBJECT_ID(N'dbo.voter_health_economy', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.voter_health_economy (
          id INT IDENTITY(1,1) PRIMARY KEY,
          voter_doc_id VARCHAR(64) NOT NULL,
          voter_epic VARCHAR(64) NULL,
          aadhar_number VARCHAR(64) NULL,
          vital_status VARCHAR(64) DEFAULT 'Active',
          death_date VARCHAR(64) NULL,
          death_notes NVARCHAR(MAX) NULL,
          physical_profile VARCHAR(64) DEFAULT 'General',
          disability_category VARCHAR(64) DEFAULT 'None',
          disability_percent VARCHAR(64) NULL,
          eci_assistance_needed BIT DEFAULT 0,
          health_notes NVARCHAR(MAX) NULL,
          economic_category VARCHAR(64) DEFAULT 'APL',
          income_range VARCHAR(64) DEFAULT '₹15,000 - ₹30,000',
          land_ownership VARCHAR(100) DEFAULT 'Small Farmer',
          ration_card_type VARCHAR(64) NULL,
          ration_card_no VARCHAR(64) NULL,
          housing_type VARCHAR(100) NULL,
          occupation_detail NVARCHAR(255) NULL,
          recorded_by VARCHAR(64) NULL,
          recorded_by_name NVARCHAR(256) NULL,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
          updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
        );
        CREATE INDEX idx_vhe_voter_doc ON dbo.voter_health_economy(voter_doc_id);
        CREATE INDEX idx_vhe_voter_epic ON dbo.voter_health_economy(voter_epic);
        CREATE INDEX idx_vhe_aadhar ON dbo.voter_health_economy(aadhar_number);
      END

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

      IF OBJECT_ID(N'dbo.mandal_directories', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.mandal_directories (
          id VARCHAR(64) PRIMARY KEY,
          mandal_id VARCHAR(64) NOT NULL,
          admin_id VARCHAR(64) NOT NULL,
          category_key VARCHAR(64) NOT NULL,
          label NVARCHAR(255) NOT NULL,
          english_label NVARCHAR(255) NOT NULL,
          target_count INT DEFAULT 10,
          icon VARCHAR(50) DEFAULT 'Users',
          color_class VARCHAR(100) DEFAULT 'text-blue-500 bg-blue-50 dark:bg-blue-950/20',
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
        BEGIN TRY CREATE INDEX idx_mandal_dirs_mandal_admin ON dbo.mandal_directories(mandal_id, admin_id); END TRY BEGIN CATCH END CATCH
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
        mandal_id = null,
        panchayat_id = null,
        ward_id = null,
        booth_id = null,
        stateId = null,
        districtId = null,
        constituencyId = null,
        mandalId = null,
        panchayatId = null,
        wardId = null,
        boothId = null
      } = req.body;

      const finalStateId = state_id || stateId || null;
      const finalDistrictId = district_id || districtId || null;
      const finalConstituencyId = constituency_id || constituencyId || null;
      const finalMandalId = mandal_id || mandalId || null;
      const finalPanchayatId = panchayat_id || panchayatId || null;
      const finalWardId = ward_id || wardId || null;
      const finalBoothId = booth_id || boothId || null;

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
      const assignedBoothsJson = JSON.stringify(assigned_booths || (finalBoothId ? [finalBoothId] : []));
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
        INSERT INTO dbo.user_invites (id, email, name, role, assigned_booths, rights, state_id, district_id, constituency_id, mandal_id, panchayat_id, ward_id, booth_id, token, status, created_by)
        VALUES (@id, @email, @name, @role, @assigned_booths, @rights, @state_id, @district_id, @constituency_id, @mandal_id, @panchayat_id, @ward_id, @booth_id, @token, 'pending', @created_by)
      `, {
        id: inviteId,
        email: cleanEmail,
        name,
        role: targetRole,
        assigned_booths: assignedBoothsJson,
        rights: rightsJson,
        state_id: finalStateId,
        district_id: finalDistrictId,
        constituency_id: finalConstituencyId,
        mandal_id: finalMandalId,
        panchayat_id: finalPanchayatId,
        ward_id: finalWardId,
        booth_id: finalBoothId,
        token,
        created_by: creatorIdentifier
      });

      // 3. Create or update user in dbo.users
      const existingUser = await query(`SELECT * FROM dbo.users WHERE LOWER(email) = @email`, { email: cleanEmail });
      const finalUserId = firebaseUid || (existingUser.length > 0 ? existingUser[0].id : `usr_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`);

      if (existingUser.length === 0) {
        await execute(`
          INSERT INTO dbo.users (id, email, password_hash, name, role, assigned_booths, rights, state_id, district_id, constituency_id, mandal_id, panchayat_id, ward_id, created_by, disabled)
          VALUES (@id, @email, @password_hash, @name, @role, @assigned_booths, @rights, @state_id, @district_id, @constituency_id, @mandal_id, @panchayat_id, @ward_id, @created_by, 0)
        `, {
          id: finalUserId,
          email: cleanEmail,
          password_hash: 'pending_invite',
          name,
          role: targetRole,
          assigned_booths: assignedBoothsJson,
          rights: rightsJson,
          state_id: finalStateId,
          district_id: finalDistrictId,
          constituency_id: finalConstituencyId,
          mandal_id: finalMandalId,
          panchayat_id: finalPanchayatId,
          ward_id: finalWardId,
          created_by: creatorIdentifier
        });
      } else {
        await execute(`
          UPDATE dbo.users 
          SET role = @role, rights = @rights, assigned_booths = @assigned_booths, 
              state_id = @state_id, district_id = @district_id, constituency_id = @constituency_id,
              mandal_id = @mandal_id, panchayat_id = @panchayat_id, ward_id = @ward_id
          WHERE LOWER(email) = @email
        `, {
          role: targetRole,
          rights: rightsJson,
          assigned_booths: assignedBoothsJson,
          state_id: finalStateId,
          district_id: finalDistrictId,
          constituency_id: finalConstituencyId,
          mandal_id: finalMandalId,
          panchayat_id: finalPanchayatId,
          ward_id: finalWardId,
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
        users = await query(`SELECT id, email, name, role, rights, assigned_booths, disabled, state_id, district_id, constituency_id, mandal_id, panchayat_id, ward_id, booth_id, election_settings, bio, created_by, created_at FROM dbo.users ORDER BY created_at DESC`);
      } else {
        // Regular Admin sees users created by them OR subordinates (volunteers, managers, guests) - but not other admins/super admins
        users = await query(`
          SELECT id, email, name, role, rights, assigned_booths, disabled, state_id, district_id, constituency_id, mandal_id, panchayat_id, ward_id, booth_id, election_settings, bio, created_by, created_at 
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
          mandalId: u.mandal_id || '',
          panchayatId: u.panchayat_id || '',
          wardId: u.ward_id || '',
          state_id: u.state_id || '',
          district_id: u.district_id || '',
          constituency_id: u.constituency_id || '',
          mandal_id: u.mandal_id || '',
          panchayat_id: u.panchayat_id || '',
          ward_id: u.ward_id || '',
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

      const { 
        role, name, bio, permissions, rights, disabled, assigned_booths, 
        state_id, district_id, constituency_id, mandal_id, panchayat_id, ward_id, booth_id,
        stateId, districtId, constituencyId, mandalId, panchayatId, wardId, boothId,
        election_settings, electionSettings 
      } = req.body;
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

      const rawBoothVal = booth_id !== undefined ? booth_id : boothId;
      const boothsData = assigned_booths !== undefined ? assigned_booths : (rawBoothVal !== undefined ? (rawBoothVal ? String(rawBoothVal).split(',').map((s: string) => s.trim()).filter(Boolean) : []) : undefined);
      const assignedBoothsJson = boothsData !== undefined ? (typeof boothsData === 'string' ? boothsData : JSON.stringify(boothsData)) : null;
      const boothIdStr = rawBoothVal !== undefined ? (rawBoothVal || null) : (Array.isArray(boothsData) && boothsData.length > 0 ? boothsData.join(',') : null);

      const finalStateVal = state_id !== undefined ? state_id : stateId;
      const finalDistrictVal = district_id !== undefined ? district_id : districtId;
      const finalConstVal = constituency_id !== undefined ? constituency_id : constituencyId;
      const finalMandalVal = mandal_id !== undefined ? mandal_id : mandalId;
      const finalPanchayatVal = panchayat_id !== undefined ? panchayat_id : panchayatId;
      const finalWardVal = ward_id !== undefined ? ward_id : wardId;

      // Consolidate election settings JSON
      const rawElectSettings = election_settings !== undefined ? election_settings : electionSettings;
      let electionSettingsJson: string | null = null;
      if (rawElectSettings !== undefined) {
        electionSettingsJson = typeof rawElectSettings === 'string' ? rawElectSettings : JSON.stringify(rawElectSettings);
      } else if (finalStateVal !== undefined || finalDistrictVal !== undefined || finalConstVal !== undefined || finalMandalVal !== undefined || finalPanchayatVal !== undefined || finalWardVal !== undefined || rawBoothVal !== undefined || assigned_booths !== undefined) {
        electionSettingsJson = JSON.stringify({
          state_id: finalStateVal || null,
          district_id: finalDistrictVal || null,
          constituency_id: finalConstVal || null,
          mandal_id: finalMandalVal || null,
          panchayat_id: finalPanchayatVal || null,
          ward_id: finalWardVal || null,
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
             mandal_id = CASE WHEN @has_mandal = 1 THEN @mandal_id ELSE mandal_id END,
             panchayat_id = CASE WHEN @has_panchayat = 1 THEN @panchayat_id ELSE panchayat_id END,
             ward_id = CASE WHEN @has_ward = 1 THEN @ward_id ELSE ward_id END,
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
          has_booths: (assigned_booths !== undefined || rawBoothVal !== undefined) ? 1 : 0,
          state_id: finalStateVal !== undefined ? (finalStateVal || null) : null,
          has_state: finalStateVal !== undefined ? 1 : 0,
          district_id: finalDistrictVal !== undefined ? (finalDistrictVal || null) : null,
          has_district: finalDistrictVal !== undefined ? 1 : 0,
          constituency_id: finalConstVal !== undefined ? (finalConstVal || null) : null,
          has_constituency: finalConstVal !== undefined ? 1 : 0,
          mandal_id: finalMandalVal !== undefined ? (finalMandalVal || null) : null,
          has_mandal: finalMandalVal !== undefined ? 1 : 0,
          panchayat_id: finalPanchayatVal !== undefined ? (finalPanchayatVal || null) : null,
          has_panchayat: finalPanchayatVal !== undefined ? 1 : 0,
          ward_id: finalWardVal !== undefined ? (finalWardVal || null) : null,
          has_ward: finalWardVal !== undefined ? 1 : 0,
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
  // 2. Demographics (States, Districts, Constituencies, Panchayats, Wards, Booths)
  // ============================================================================

  // --------------------------------------------------------------------------
  // 2.1 States
  // --------------------------------------------------------------------------
  app.get("/api/states", optionalAuth, async (req, res) => {
    try {
      const states = await query(`
        SELECT s.*, 
          (SELECT COUNT(1) FROM dbo.districts d WHERE d.state_id = s.id) as districtCount,
          (SELECT COUNT(1) FROM dbo.districts d WHERE d.state_id = s.id) as district_count
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
      const { id, name, code, population } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "State name is required." });
      }
      const trimmedName = String(name).trim();
      const stateCode = (code || trimmedName.substring(0, 3)).trim().toUpperCase();
      const pop = parseInt(population, 10) || 0;
      const userId = (req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || null;

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.states SET name = @name, code = @code, population = @population WHERE id = @id`, 
          { id: Number(id), name: trimmedName, code: stateCode, population: pop }
        );
        return res.json({ id: Number(id), name: trimmedName, code: stateCode, population: pop });
      }
      const inserted = await query(
        `INSERT INTO dbo.states (name, code, population, created_by) OUTPUT INSERTED.* VALUES (@name, @code, @population, @created_by)`, 
        { name: trimmedName, code: stateCode, population: pop, created_by: userId }
      );
      res.json(inserted[0] || { name: trimmedName, code: stateCode, population: pop, created_by: userId });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/states/:id", authenticateUser, async (req, res) => {
    try {
      const id = req.params.id;
      const { name, code, population } = req.body;
      if (!id || String(id).trim() === '') {
        return res.status(400).json({ error: "Invalid State ID." });
      }
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "State name is required." });
      }
      const trimmedName = String(name).trim();
      const stateCode = (code || trimmedName.substring(0, 3)).trim().toUpperCase();
      const pop = population !== undefined ? (parseInt(population, 10) || 0) : 0;
      const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);

      await execute(
        `UPDATE dbo.states SET name = @name, code = @code, population = @population WHERE id = @id`, 
        { id: parsedId, name: trimmedName, code: stateCode, population: pop }
      );
      res.json({ id, name: trimmedName, code: stateCode, population: pop });
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

      // 7. Delete wards in this state
      await execute(`
        DELETE FROM dbo.wards WHERE state_id = @stateId OR district_id IN (
          SELECT id FROM dbo.districts WHERE state_id = @stateId
        )
      `, { stateId });

      // 8. Delete panchayats in this state
      await execute(`
        DELETE FROM dbo.panchayats WHERE state_id = @stateId OR district_id IN (
          SELECT id FROM dbo.districts WHERE state_id = @stateId
        )
      `, { stateId });

      // 9. Delete mandal members in mandals of this state
      await execute(`
        DELETE FROM dbo.mandal_members WHERE mandal_id IN (
          SELECT m.id FROM dbo.mandals m
          LEFT JOIN dbo.districts d ON m.district_id = d.id
          LEFT JOIN dbo.constituencies c ON m.constituency_id = c.id
          WHERE m.state_id = @stateId OR d.state_id = @stateId OR c.state_id = @stateId
        )
      `, { stateId });

      // 10. Delete mandals in this state
      await execute(`
        DELETE FROM dbo.mandals WHERE id IN (
          SELECT m.id FROM dbo.mandals m
          LEFT JOIN dbo.districts d ON m.district_id = d.id
          LEFT JOIN dbo.constituencies c ON m.constituency_id = c.id
          WHERE m.state_id = @stateId OR d.state_id = @stateId OR c.state_id = @stateId
        )
      `, { stateId });

      // 11. Delete constituencies in this state
      await execute(`
        DELETE FROM dbo.constituencies WHERE id IN (
          SELECT c.id FROM dbo.constituencies c
          LEFT JOIN dbo.districts d ON c.district_id = d.id
          WHERE c.state_id = @stateId OR d.state_id = @stateId
        )
      `, { stateId });

      // 12. Delete districts in this state
      await execute(`DELETE FROM dbo.districts WHERE state_id = @stateId`, { stateId });

      // 13. Finally delete the state
      await execute(`DELETE FROM dbo.states WHERE id = @stateId`, { stateId });
      res.json({ success: true, message: 'State and all dependent records deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // --------------------------------------------------------------------------
  // 2.2 Districts
  // --------------------------------------------------------------------------
  app.get("/api/districts", optionalAuth, async (req, res) => {
    try {
      const { stateId, stateIds, search } = req.query;
      let sqlQuery = `
        SELECT d.*, s.name as state_name,
          (SELECT COUNT(1) FROM dbo.constituencies c WHERE c.district_id = d.id) as constituencyCount,
          (SELECT COUNT(1) FROM dbo.constituencies c WHERE c.district_id = d.id) as constituency_count
        FROM dbo.districts d 
        LEFT JOIN dbo.states s ON d.state_id = s.id
        WHERE 1=1
      `;
      const params: Record<string, any> = {};
      const stClause = buildSafeInClause(stateId || stateIds, 'dst_st', ['d.state_id', 's.id'], params);
      if (stClause) {
        sqlQuery += ` AND ${stClause}`;
      }
      if (search && String(search).trim()) {
        sqlQuery += ` AND (d.name LIKE @search OR s.name LIKE @search)`;
        params.search = `%${String(search).trim()}%`;
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
      const { id, name, state_id, stateId, population } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "District name is required." });
      }
      const rawStateId = state_id !== undefined ? state_id : stateId;
      if (!rawStateId || String(rawStateId).trim() === '') {
        return res.status(400).json({ error: "Please select a valid parent state for this district." });
      }
      const numStateId = !isNaN(Number(rawStateId)) ? Number(rawStateId) : String(rawStateId);
      const trimmedName = String(name).trim();
      const pop = parseInt(population, 10) || 0;
      const userId = (req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || null;

      if (id && String(id).trim() !== '') {
        const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);
        await execute(
          `UPDATE dbo.districts SET name = @name, state_id = @state_id, population = @population WHERE id = @id`, 
          { id: parsedId, name: trimmedName, state_id: numStateId, population: pop }
        );
        return res.json({ id, name: trimmedName, state_id: numStateId, population: pop });
      }
      const inserted = await query(
        `INSERT INTO dbo.districts (name, state_id, population, created_by) OUTPUT INSERTED.* VALUES (@name, @state_id, @population, @created_by)`,
        { name: trimmedName, state_id: numStateId, population: pop, created_by: userId }
      );
      res.json(inserted[0] || { name: trimmedName, state_id: numStateId, population: pop, created_by: userId });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/districts/:id", authenticateUser, async (req, res) => {
    try {
      const id = req.params.id;
      const { name, state_id, stateId, population } = req.body;
      if (!id || String(id).trim() === '') {
        return res.status(400).json({ error: "Invalid District ID." });
      }
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "District name is required." });
      }
      const rawStateId = state_id !== undefined ? state_id : stateId;
      if (!rawStateId || String(rawStateId).trim() === '') {
        return res.status(400).json({ error: "Please select a valid parent state for this district." });
      }
      const numStateId = !isNaN(Number(rawStateId)) ? Number(rawStateId) : String(rawStateId);
      const trimmedName = String(name).trim();
      const pop = population !== undefined ? (parseInt(population, 10) || 0) : 0;
      const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);

      await execute(
        `UPDATE dbo.districts SET name = @name, state_id = @state_id, population = @population WHERE id = @id`, 
        { id: parsedId, name: trimmedName, state_id: numStateId, population: pop }
      );
      res.json({ id, name: trimmedName, state_id: numStateId, population: pop });
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

      // 7. Delete wards in this district
      await execute(`DELETE FROM dbo.wards WHERE district_id = @districtId`, { districtId });

      // 8. Delete panchayats in this district
      await execute(`DELETE FROM dbo.panchayats WHERE district_id = @districtId`, { districtId });

      // 9. Delete mandal members
      await execute(`
        DELETE FROM dbo.mandal_members WHERE mandal_id IN (
          SELECT m.id FROM dbo.mandals m
          LEFT JOIN dbo.constituencies c ON m.constituency_id = c.id
          WHERE m.district_id = @districtId OR c.district_id = @districtId
        )
      `, { districtId });

      // 10. Delete mandals
      await execute(`
        DELETE FROM dbo.mandals WHERE id IN (
          SELECT m.id FROM dbo.mandals m
          LEFT JOIN dbo.constituencies c ON m.constituency_id = c.id
          WHERE m.district_id = @districtId OR c.district_id = @districtId
        )
      `, { districtId });

      // 11. Delete constituencies
      await execute(`DELETE FROM dbo.constituencies WHERE district_id = @districtId`, { districtId });

      // 12. Delete district
      await execute(`DELETE FROM dbo.districts WHERE id = @districtId`, { districtId });
      res.json({ success: true, message: 'District and all dependent records deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // --------------------------------------------------------------------------
  // 2.3 Constituencies
  // --------------------------------------------------------------------------
  app.get("/api/constituencies", optionalAuth, async (req, res) => {
    try {
      const { districtId, districtIds, stateId, stateIds, search } = req.query;
      let sqlQuery = `
        SELECT c.*, ISNULL(c.category, 'General') as category, d.name as district_name, s.name as state_name,
          (SELECT COUNT(1) FROM dbo.mandals m WHERE m.constituency_id = c.id) as blockCount,
          (SELECT COUNT(1) FROM dbo.booths b WHERE b.constituency_id = c.id) as boothCount,
          (SELECT COUNT(1) FROM dbo.booths b WHERE b.constituency_id = c.id) as booth_count
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
      if (search && String(search).trim()) {
        sqlQuery += ` AND (c.name LIKE @search OR d.name LIKE @search OR c.category LIKE @search)`;
        params.search = `%${String(search).trim()}%`;
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
      const { id, name, district_id, state_id, districtId, stateId, category, seat_type, reservation, population } = req.body;
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
      const pop = parseInt(population, 10) || 0;
      const userId = (req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || null;
      const targetId = id !== undefined && id !== null && String(id).trim() !== '' ? id : null;

      if (targetId) {
        const parsedId = !isNaN(Number(targetId)) ? Number(targetId) : String(targetId);
        await execute(
          `UPDATE dbo.constituencies SET name = @name, district_id = @district_id, state_id = @state_id, category = @category, population = @population WHERE id = @id`,
          { id: parsedId, name: trimmedName, district_id: finalDistrictId, state_id: finalStateId, category: seatCategory, population: pop }
        );
        return res.json({ id: targetId, name: trimmedName, district_id: finalDistrictId, state_id: finalStateId, category: seatCategory, population: pop });
      }
      const inserted = await query(
        `INSERT INTO dbo.constituencies (name, district_id, state_id, category, population, created_by) OUTPUT INSERTED.* VALUES (@name, @district_id, @state_id, @category, @population, @created_by)`, 
        { name: trimmedName, district_id: finalDistrictId, state_id: finalStateId, category: seatCategory, population: pop, created_by: userId }
      );
      res.json(inserted[0] || { name: trimmedName, district_id: finalDistrictId, state_id: finalStateId, category: seatCategory, population: pop, created_by: userId });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/constituencies/:id", authenticateUser, async (req, res) => {
    try {
      const id = req.params.id;
      const { name, district_id, state_id, districtId, stateId, category, seat_type, reservation, population } = req.body;
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
      const pop = population !== undefined ? (parseInt(population, 10) || 0) : 0;
      const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);

      await execute(
        `UPDATE dbo.constituencies SET name = @name, district_id = @district_id, state_id = @state_id, category = @category, population = @population WHERE id = @id`,
        { id: parsedId, name: trimmedName, district_id: finalDistrictId, state_id: finalStateId, category: seatCategory, population: pop }
      );
      res.json({ id, name: trimmedName, district_id: finalDistrictId, state_id: finalStateId, category: seatCategory, population: pop });
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

      // 7. Delete wards under this constituency
      await execute(`DELETE FROM dbo.wards WHERE constituency_id = @constituencyId`, { constituencyId });

      // 8. Delete panchayats under this constituency
      await execute(`DELETE FROM dbo.panchayats WHERE constituency_id = @constituencyId`, { constituencyId });

      // 9. Delete mandal members & mandals
      await execute(`
        DELETE FROM dbo.mandal_members WHERE mandal_id IN (
          SELECT id FROM dbo.mandals WHERE constituency_id = @constituencyId
        )
      `, { constituencyId });

      await execute(`DELETE FROM dbo.mandals WHERE constituency_id = @constituencyId`, { constituencyId });

      // 10. Delete constituency
      await execute(`DELETE FROM dbo.constituencies WHERE id = @constituencyId`, { constituencyId });
      res.json({ success: true, message: 'Constituency and all dependent records deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // --------------------------------------------------------------------------
  // 2.4 Panchayats / MC / ULBs (Local Bodies)
  // --------------------------------------------------------------------------
  app.get("/api/panchayats", optionalAuth, async (req, res) => {
    try {
      const { mandalId, mandalIds, constituencyId, constituencyIds, districtId, districtIds, stateId, stateIds, search } = req.query;
      let sqlQuery = `
        SELECT p.*,
               m.name as mandal_name,
               m.mandal_code as mandal_code,
               c.name as constituency_name,
               d.name as district_name,
               s.name as state_name,
               (SELECT COUNT(1) FROM dbo.wards w WHERE w.panchayat_id = p.id) as wardCount,
               (SELECT COUNT(1) FROM dbo.wards w WHERE w.panchayat_id = p.id) as ward_count,
               (SELECT COUNT(1) FROM dbo.booths b WHERE b.panchayat_id = p.id OR b.panchayat_id = CAST(p.id AS NVARCHAR(64))) as boothCount,
               (SELECT COUNT(1) FROM dbo.booths b WHERE b.panchayat_id = p.id OR b.panchayat_id = CAST(p.id AS NVARCHAR(64))) as booth_count
        FROM dbo.panchayats p
        LEFT JOIN dbo.mandals m ON p.mandal_id = m.id
        LEFT JOIN dbo.constituencies c ON p.constituency_id = c.id OR m.constituency_id = c.id
        LEFT JOIN dbo.districts d ON p.district_id = d.id OR c.district_id = d.id OR m.district_id = d.id
        LEFT JOIN dbo.states s ON p.state_id = s.id OR d.state_id = s.id OR c.state_id = s.id OR m.state_id = s.id
        WHERE 1=1
      `;
      const params: Record<string, any> = {};
      const mndClause = buildSafeInClause(mandalId || mandalIds, 'pan_mnd', ['p.mandal_id', 'm.id'], params);
      if (mndClause) sqlQuery += ` AND ${mndClause}`;
      const cstClause = buildSafeInClause(constituencyId || constituencyIds, 'pan_cst', ['p.constituency_id', 'm.constituency_id', 'c.id'], params);
      if (cstClause) sqlQuery += ` AND ${cstClause}`;
      const dstClause = buildSafeInClause(districtId || districtIds, 'pan_dst', ['p.district_id', 'c.district_id', 'd.id'], params);
      if (dstClause) sqlQuery += ` AND ${dstClause}`;
      const stClause = buildSafeInClause(stateId || stateIds, 'pan_st', ['p.state_id', 'd.state_id', 'c.state_id', 's.id'], params);
      if (stClause) sqlQuery += ` AND ${stClause}`;
      if (search && String(search).trim()) {
        sqlQuery += ` AND (p.name LIKE @search OR p.code LIKE @search OR p.type LIKE @search)`;
        params.search = `%${String(search).trim()}%`;
      }
      sqlQuery += ` ORDER BY p.name ASC`;
      const rows = await query(sqlQuery, params);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/panchayats", authenticateUser, async (req, res) => {
    try {
      const { id, name, code, type, mandal_id, mandalId, constituency_id, constituencyId, district_id, districtId, state_id, stateId, population } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Panchayat / Local Body name is required." });
      }
      const rawMid = mandal_id !== undefined ? mandal_id : mandalId;
      const finalMid = rawMid && String(rawMid).trim() !== '' ? (!isNaN(Number(rawMid)) ? Number(rawMid) : String(rawMid)) : null;

      const rawCid = constituency_id !== undefined ? constituency_id : constituencyId;
      let finalCid = rawCid && String(rawCid).trim() !== '' ? (!isNaN(Number(rawCid)) ? Number(rawCid) : String(rawCid)) : null;

      const rawDid = district_id !== undefined ? district_id : districtId;
      let finalDid = rawDid && String(rawDid).trim() !== '' ? (!isNaN(Number(rawDid)) ? Number(rawDid) : String(rawDid)) : null;

      const rawSid = state_id !== undefined ? state_id : stateId;
      let finalSid = rawSid && String(rawSid).trim() !== '' ? (!isNaN(Number(rawSid)) ? Number(rawSid) : String(rawSid)) : null;

      // Auto-lookup hierarchy if missing
      if (finalMid && (!finalCid || !finalDid || !finalSid)) {
        const mRow = await query(`SELECT constituency_id, district_id, state_id FROM dbo.mandals WHERE id = @mid`, { mid: finalMid });
        if (mRow && mRow[0]) {
          if (!finalCid) finalCid = mRow[0].constituency_id;
          if (!finalDid) finalDid = mRow[0].district_id;
          if (!finalSid) finalSid = mRow[0].state_id;
        }
      }
      if (finalCid && (!finalDid || !finalSid)) {
        const cRow = await query(`SELECT district_id, state_id FROM dbo.constituencies WHERE id = @cid`, { cid: finalCid });
        if (cRow && cRow[0]) {
          if (!finalDid) finalDid = cRow[0].district_id;
          if (!finalSid) finalSid = cRow[0].state_id;
        }
      }
      if (finalDid && !finalSid) {
        const dRow = await query(`SELECT state_id FROM dbo.districts WHERE id = @did`, { did: finalDid });
        if (dRow && dRow[0]) finalSid = dRow[0].state_id;
      }

      const trimmedName = String(name).trim();
      const pCode = (code || '').trim();
      const pType = (type || 'Gram Panchayat').trim();
      const pop = parseInt(population, 10) || 0;
      const userId = (req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || null;
      const targetId = id !== undefined && id !== null && String(id).trim() !== '' ? id : null;

      if (targetId) {
        const parsedId = !isNaN(Number(targetId)) ? Number(targetId) : String(targetId);
        await execute(
          `UPDATE dbo.panchayats
           SET name = @name, code = @code, type = @type, mandal_id = @mandal_id, constituency_id = @constituency_id, district_id = @district_id, state_id = @state_id, population = @population
           WHERE id = @id`,
          { id: parsedId, name: trimmedName, code: pCode, type: pType, mandal_id: finalMid, constituency_id: finalCid, district_id: finalDid, state_id: finalSid, population: pop }
        );
        return res.json({ id: targetId, name: trimmedName, code: pCode, type: pType, mandal_id: finalMid, constituency_id: finalCid, district_id: finalDid, state_id: finalSid, population: pop });
      }

      const inserted = await query(
        `INSERT INTO dbo.panchayats (name, code, type, mandal_id, constituency_id, district_id, state_id, population, created_by)
         OUTPUT INSERTED.*
         VALUES (@name, @code, @type, @mandal_id, @constituency_id, @district_id, @state_id, @population, @created_by)`,
        { name: trimmedName, code: pCode, type: pType, mandal_id: finalMid, constituency_id: finalCid, district_id: finalDid, state_id: finalSid, population: pop, created_by: userId }
      );
      res.json(inserted[0] || { name: trimmedName, code: pCode, type: pType, mandal_id: finalMid, constituency_id: finalCid, district_id: finalDid, state_id: finalSid, population: pop, created_by: userId });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/panchayats/:id", authenticateUser, async (req, res) => {
    try {
      const id = req.params.id;
      const { name, code, type, mandal_id, mandalId, constituency_id, constituencyId, district_id, districtId, state_id, stateId, population } = req.body;
      if (!id || String(id).trim() === '') {
        return res.status(400).json({ error: "Invalid Panchayat ID." });
      }
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Panchayat / Local Body name is required." });
      }
      const rawMid = mandal_id !== undefined ? mandal_id : mandalId;
      const finalMid = rawMid && String(rawMid).trim() !== '' ? (!isNaN(Number(rawMid)) ? Number(rawMid) : String(rawMid)) : null;

      const rawCid = constituency_id !== undefined ? constituency_id : constituencyId;
      let finalCid = rawCid && String(rawCid).trim() !== '' ? (!isNaN(Number(rawCid)) ? Number(rawCid) : String(rawCid)) : null;

      const rawDid = district_id !== undefined ? district_id : districtId;
      let finalDid = rawDid && String(rawDid).trim() !== '' ? (!isNaN(Number(rawDid)) ? Number(rawDid) : String(rawDid)) : null;

      const rawSid = state_id !== undefined ? state_id : stateId;
      let finalSid = rawSid && String(rawSid).trim() !== '' ? (!isNaN(Number(rawSid)) ? Number(rawSid) : String(rawSid)) : null;

      if (finalMid && (!finalCid || !finalDid || !finalSid)) {
        const mRow = await query(`SELECT constituency_id, district_id, state_id FROM dbo.mandals WHERE id = @mid`, { mid: finalMid });
        if (mRow && mRow[0]) {
          if (!finalCid) finalCid = mRow[0].constituency_id;
          if (!finalDid) finalDid = mRow[0].district_id;
          if (!finalSid) finalSid = mRow[0].state_id;
        }
      }
      if (finalCid && (!finalDid || !finalSid)) {
        const cRow = await query(`SELECT district_id, state_id FROM dbo.constituencies WHERE id = @cid`, { cid: finalCid });
        if (cRow && cRow[0]) {
          if (!finalDid) finalDid = cRow[0].district_id;
          if (!finalSid) finalSid = cRow[0].state_id;
        }
      }
      if (finalDid && !finalSid) {
        const dRow = await query(`SELECT state_id FROM dbo.districts WHERE id = @did`, { did: finalDid });
        if (dRow && dRow[0]) finalSid = dRow[0].state_id;
      }

      const trimmedName = String(name).trim();
      const pCode = (code || '').trim();
      const pType = (type || 'Gram Panchayat').trim();
      const pop = population !== undefined ? (parseInt(population, 10) || 0) : 0;
      const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);

      await execute(
        `UPDATE dbo.panchayats
         SET name = @name, code = @code, type = @type, mandal_id = @mandal_id, constituency_id = @constituency_id, district_id = @district_id, state_id = @state_id, population = @population
         WHERE id = @id`,
        { id: parsedId, name: trimmedName, code: pCode, type: pType, mandal_id: finalMid, constituency_id: finalCid, district_id: finalDid, state_id: finalSid, population: pop }
      );
      res.json({ id, name: trimmedName, code: pCode, type: pType, mandal_id: finalMid, constituency_id: finalCid, district_id: finalDid, state_id: finalSid, population: pop });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/panchayats/:id", authenticateUser, async (req, res) => {
    try {
      const panchayatId = req.params.id;
      const parsedId = !isNaN(Number(panchayatId)) ? Number(panchayatId) : String(panchayatId);

      // Unlink booths and voters
      await execute(`UPDATE dbo.booths SET panchayat_id = NULL WHERE panchayat_id = @panchayatId OR panchayat_id = CAST(@panchayatId AS NVARCHAR(64))`, { panchayatId: parsedId });
      await execute(`UPDATE dbo.voters SET panchayat_id = NULL WHERE panchayat_id = @panchayatId OR panchayat_id = CAST(@panchayatId AS NVARCHAR(64))`, { panchayatId: parsedId });
      
      // Delete wards under this panchayat
      await execute(`DELETE FROM dbo.wards WHERE panchayat_id = @panchayatId OR panchayat_id = CAST(@panchayatId AS INT)`, { panchayatId: parsedId });
      
      // Delete panchayat
      await execute(`DELETE FROM dbo.panchayats WHERE id = @panchayatId`, { panchayatId: parsedId });
      res.json({ success: true, message: 'Panchayat / Local Body deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // --------------------------------------------------------------------------
  // 2.5 Wards / Villages
  // --------------------------------------------------------------------------
  app.get("/api/wards", optionalAuth, async (req, res) => {
    try {
      const { panchayatId, panchayatIds, mandalId, mandalIds, constituencyId, constituencyIds, districtId, districtIds, stateId, stateIds, search } = req.query;
      let sqlQuery = `
        SELECT w.*,
               p.name as panchayat_name,
               p.type as panchayat_type,
               m.name as mandal_name,
               c.name as constituency_name,
               d.name as district_name,
               s.name as state_name,
               (SELECT COUNT(1) FROM dbo.booths b WHERE b.ward_id = w.id OR b.ward_id = CAST(w.id AS NVARCHAR(64))) as boothCount,
               (SELECT COUNT(1) FROM dbo.booths b WHERE b.ward_id = w.id OR b.ward_id = CAST(w.id AS NVARCHAR(64))) as booth_count
        FROM dbo.wards w
        LEFT JOIN dbo.panchayats p ON w.panchayat_id = p.id
        LEFT JOIN dbo.mandals m ON w.mandal_id = m.id OR p.mandal_id = m.id
        LEFT JOIN dbo.constituencies c ON w.constituency_id = c.id OR p.constituency_id = c.id OR m.constituency_id = c.id
        LEFT JOIN dbo.districts d ON w.district_id = d.id OR p.district_id = d.id OR c.district_id = d.id OR m.district_id = d.id
        LEFT JOIN dbo.states s ON w.state_id = s.id OR p.state_id = s.id OR d.state_id = s.id OR c.state_id = s.id
        WHERE 1=1
      `;
      const params: Record<string, any> = {};
      const panClause = buildSafeInClause(panchayatId || panchayatIds, 'wrd_pan', ['w.panchayat_id', 'p.id'], params);
      if (panClause) sqlQuery += ` AND ${panClause}`;
      const mndClause = buildSafeInClause(mandalId || mandalIds, 'wrd_mnd', ['w.mandal_id', 'p.mandal_id', 'm.id'], params);
      if (mndClause) sqlQuery += ` AND ${mndClause}`;
      const cstClause = buildSafeInClause(constituencyId || constituencyIds, 'wrd_cst', ['w.constituency_id', 'p.constituency_id', 'c.id'], params);
      if (cstClause) sqlQuery += ` AND ${cstClause}`;
      const dstClause = buildSafeInClause(districtId || districtIds, 'wrd_dst', ['w.district_id', 'd.id'], params);
      if (dstClause) sqlQuery += ` AND ${dstClause}`;
      const stClause = buildSafeInClause(stateId || stateIds, 'wrd_st', ['w.state_id', 's.id'], params);
      if (stClause) sqlQuery += ` AND ${stClause}`;
      if (search && String(search).trim()) {
        sqlQuery += ` AND (w.name LIKE @search OR w.ward_number LIKE @search OR w.type LIKE @search)`;
        params.search = `%${String(search).trim()}%`;
      }
      sqlQuery += ` ORDER BY w.ward_number ASC, w.name ASC`;
      const rows = await query(sqlQuery, params);
      res.json(rows);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/wards", authenticateUser, async (req, res) => {
    try {
      const { id, name, ward_number, wardNumber, type, panchayat_id, panchayatId, mandal_id, mandalId, constituency_id, constituencyId, district_id, districtId, state_id, stateId, population, total_voters, totalVoters } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Ward / Village name is required." });
      }
      const rawPid = panchayat_id !== undefined ? panchayat_id : panchayatId;
      const finalPid = rawPid && String(rawPid).trim() !== '' ? (!isNaN(Number(rawPid)) ? Number(rawPid) : String(rawPid)) : null;

      const rawMid = mandal_id !== undefined ? mandal_id : mandalId;
      let finalMid = rawMid && String(rawMid).trim() !== '' ? (!isNaN(Number(rawMid)) ? Number(rawMid) : String(rawMid)) : null;

      const rawCid = constituency_id !== undefined ? constituency_id : constituencyId;
      let finalCid = rawCid && String(rawCid).trim() !== '' ? (!isNaN(Number(rawCid)) ? Number(rawCid) : String(rawCid)) : null;

      const rawDid = district_id !== undefined ? district_id : districtId;
      let finalDid = rawDid && String(rawDid).trim() !== '' ? (!isNaN(Number(rawDid)) ? Number(rawDid) : String(rawDid)) : null;

      const rawSid = state_id !== undefined ? state_id : stateId;
      let finalSid = rawSid && String(rawSid).trim() !== '' ? (!isNaN(Number(rawSid)) ? Number(rawSid) : String(rawSid)) : null;

      // Auto-lookup hierarchy from parent panchayat if available
      if (finalPid && (!finalMid || !finalCid || !finalDid || !finalSid)) {
        const pRow = await query(`SELECT mandal_id, constituency_id, district_id, state_id FROM dbo.panchayats WHERE id = @pid`, { pid: finalPid });
        if (pRow && pRow[0]) {
          if (!finalMid) finalMid = pRow[0].mandal_id;
          if (!finalCid) finalCid = pRow[0].constituency_id;
          if (!finalDid) finalDid = pRow[0].district_id;
          if (!finalSid) finalSid = pRow[0].state_id;
        }
      }
      if (finalMid && (!finalCid || !finalDid || !finalSid)) {
        const mRow = await query(`SELECT constituency_id, district_id, state_id FROM dbo.mandals WHERE id = @mid`, { mid: finalMid });
        if (mRow && mRow[0]) {
          if (!finalCid) finalCid = mRow[0].constituency_id;
          if (!finalDid) finalDid = mRow[0].district_id;
          if (!finalSid) finalSid = mRow[0].state_id;
        }
      }
      if (finalCid && (!finalDid || !finalSid)) {
        const cRow = await query(`SELECT district_id, state_id FROM dbo.constituencies WHERE id = @cid`, { cid: finalCid });
        if (cRow && cRow[0]) {
          if (!finalDid) finalDid = cRow[0].district_id;
          if (!finalSid) finalSid = cRow[0].state_id;
        }
      }
      if (finalDid && !finalSid) {
        const dRow = await query(`SELECT state_id FROM dbo.districts WHERE id = @did`, { did: finalDid });
        if (dRow && dRow[0]) finalSid = dRow[0].state_id;
      }

      const trimmedName = String(name).trim();
      const wNum = String(ward_number !== undefined ? ward_number : (wardNumber || '')).trim();
      const wType = (type || 'Ward').trim();
      const pop = parseInt(population, 10) || 0;
      const vTot = total_voters !== undefined ? parseInt(total_voters, 10) : (totalVoters !== undefined ? parseInt(totalVoters, 10) : pop);
      const userId = (req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || null;
      const targetId = id !== undefined && id !== null && String(id).trim() !== '' ? id : null;

      if (targetId) {
        const parsedId = !isNaN(Number(targetId)) ? Number(targetId) : String(targetId);
        await execute(
          `UPDATE dbo.wards
           SET name = @name, ward_number = @ward_number, type = @type, panchayat_id = @panchayat_id, mandal_id = @mandal_id, constituency_id = @constituency_id, district_id = @district_id, state_id = @state_id, population = @population, total_voters = @total_voters
           WHERE id = @id`,
          { id: parsedId, name: trimmedName, ward_number: wNum, type: wType, panchayat_id: finalPid, mandal_id: finalMid, constituency_id: finalCid, district_id: finalDid, state_id: finalSid, population: pop, total_voters: vTot }
        );
        return res.json({ id: targetId, name: trimmedName, ward_number: wNum, type: wType, panchayat_id: finalPid, mandal_id: finalMid, constituency_id: finalCid, district_id: finalDid, state_id: finalSid, population: pop, total_voters: vTot });
      }

      const inserted = await query(
        `INSERT INTO dbo.wards (name, ward_number, type, panchayat_id, mandal_id, constituency_id, district_id, state_id, population, total_voters, created_by)
         OUTPUT INSERTED.*
         VALUES (@name, @ward_number, @type, @panchayat_id, @mandal_id, @constituency_id, @district_id, @state_id, @population, @total_voters, @created_by)`,
        { name: trimmedName, ward_number: wNum, type: wType, panchayat_id: finalPid, mandal_id: finalMid, constituency_id: finalCid, district_id: finalDid, state_id: finalSid, population: pop, total_voters: vTot, created_by: userId }
      );
      res.json(inserted[0] || { name: trimmedName, ward_number: wNum, type: wType, panchayat_id: finalPid, mandal_id: finalMid, constituency_id: finalCid, district_id: finalDid, state_id: finalSid, population: pop, total_voters: vTot, created_by: userId });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/wards/:id", authenticateUser, async (req, res) => {
    try {
      const id = req.params.id;
      const { name, ward_number, wardNumber, type, panchayat_id, panchayatId, mandal_id, mandalId, constituency_id, constituencyId, district_id, districtId, state_id, stateId, population, total_voters, totalVoters } = req.body;
      if (!id || String(id).trim() === '') {
        return res.status(400).json({ error: "Invalid Ward ID." });
      }
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Ward / Village name is required." });
      }
      const rawPid = panchayat_id !== undefined ? panchayat_id : panchayatId;
      const finalPid = rawPid && String(rawPid).trim() !== '' ? (!isNaN(Number(rawPid)) ? Number(rawPid) : String(rawPid)) : null;

      const rawMid = mandal_id !== undefined ? mandal_id : mandalId;
      let finalMid = rawMid && String(rawMid).trim() !== '' ? (!isNaN(Number(rawMid)) ? Number(rawMid) : String(rawMid)) : null;

      const rawCid = constituency_id !== undefined ? constituency_id : constituencyId;
      let finalCid = rawCid && String(rawCid).trim() !== '' ? (!isNaN(Number(rawCid)) ? Number(rawCid) : String(rawCid)) : null;

      const rawDid = district_id !== undefined ? district_id : districtId;
      let finalDid = rawDid && String(rawDid).trim() !== '' ? (!isNaN(Number(rawDid)) ? Number(rawDid) : String(rawDid)) : null;

      const rawSid = state_id !== undefined ? state_id : stateId;
      let finalSid = rawSid && String(rawSid).trim() !== '' ? (!isNaN(Number(rawSid)) ? Number(rawSid) : String(rawSid)) : null;

      if (finalPid && (!finalMid || !finalCid || !finalDid || !finalSid)) {
        const pRow = await query(`SELECT mandal_id, constituency_id, district_id, state_id FROM dbo.panchayats WHERE id = @pid`, { pid: finalPid });
        if (pRow && pRow[0]) {
          if (!finalMid) finalMid = pRow[0].mandal_id;
          if (!finalCid) finalCid = pRow[0].constituency_id;
          if (!finalDid) finalDid = pRow[0].district_id;
          if (!finalSid) finalSid = pRow[0].state_id;
        }
      }
      if (finalMid && (!finalCid || !finalDid || !finalSid)) {
        const mRow = await query(`SELECT constituency_id, district_id, state_id FROM dbo.mandals WHERE id = @mid`, { mid: finalMid });
        if (mRow && mRow[0]) {
          if (!finalCid) finalCid = mRow[0].constituency_id;
          if (!finalDid) finalDid = mRow[0].district_id;
          if (!finalSid) finalSid = mRow[0].state_id;
        }
      }
      if (finalCid && (!finalDid || !finalSid)) {
        const cRow = await query(`SELECT district_id, state_id FROM dbo.constituencies WHERE id = @cid`, { cid: finalCid });
        if (cRow && cRow[0]) {
          if (!finalDid) finalDid = cRow[0].district_id;
          if (!finalSid) finalSid = cRow[0].state_id;
        }
      }
      if (finalDid && !finalSid) {
        const dRow = await query(`SELECT state_id FROM dbo.districts WHERE id = @did`, { did: finalDid });
        if (dRow && dRow[0]) finalSid = dRow[0].state_id;
      }

      const trimmedName = String(name).trim();
      const wNum = String(ward_number !== undefined ? ward_number : (wardNumber || '')).trim();
      const wType = (type || 'Ward').trim();
      const pop = population !== undefined ? (parseInt(population, 10) || 0) : 0;
      const vTot = total_voters !== undefined ? parseInt(total_voters, 10) : (totalVoters !== undefined ? parseInt(totalVoters, 10) : pop);
      const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);

      await execute(
        `UPDATE dbo.wards
         SET name = @name, ward_number = @ward_number, type = @type, panchayat_id = @panchayat_id, mandal_id = @mandal_id, constituency_id = @constituency_id, district_id = @district_id, state_id = @state_id, population = @population, total_voters = @total_voters
         WHERE id = @id`,
        { id: parsedId, name: trimmedName, ward_number: wNum, type: wType, panchayat_id: finalPid, mandal_id: finalMid, constituency_id: finalCid, district_id: finalDid, state_id: finalSid, population: pop, total_voters: vTot }
      );
      res.json({ id, name: trimmedName, ward_number: wNum, type: wType, panchayat_id: finalPid, mandal_id: finalMid, constituency_id: finalCid, district_id: finalDid, state_id: finalSid, population: pop, total_voters: vTot });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/wards/:id", authenticateUser, async (req, res) => {
    try {
      const wardId = req.params.id;
      const parsedId = !isNaN(Number(wardId)) ? Number(wardId) : String(wardId);

      // Unlink booths and voters
      await execute(`UPDATE dbo.booths SET ward_id = NULL WHERE ward_id = @wardId OR ward_id = CAST(@wardId AS NVARCHAR(64))`, { wardId: parsedId });
      await execute(`UPDATE dbo.voters SET ward_id = NULL WHERE ward_id = @wardId OR ward_id = CAST(@wardId AS NVARCHAR(64))`, { wardId: parsedId });
      
      // Delete ward
      await execute(`DELETE FROM dbo.wards WHERE id = @wardId`, { wardId: parsedId });
      res.json({ success: true, message: 'Ward / Village deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // --------------------------------------------------------------------------
  // 2.6 Booths
  // --------------------------------------------------------------------------
  app.get("/api/booths", optionalAuth, async (req, res) => {
    try {
      const { constituencyId, constituencyIds, mandalId, mandalIds, panchayatId, panchayatIds, wardId, wardIds, districtId, districtIds, stateId, stateIds, search } = req.query;
      let sqlQuery = `
        SELECT b.*, 
               c.name as constituency_name, 
               m.name as mandal_name, 
               p.name as panchayat_name,
               w.name as ward_name,
               c.district_id, 
               c.state_id,
               d.name as district_name,
               s.name as state_name,
               COALESCE((SELECT COUNT(1) FROM dbo.voters v WHERE v.booth_id = b.id OR v.booth_id = CAST(b.id as nvarchar(64)) OR v.booth_id = b.booth_number), b.total_voters, 0) as voter_count
        FROM dbo.booths b 
        LEFT JOIN dbo.constituencies c ON b.constituency_id = c.id
        LEFT JOIN dbo.districts d ON c.district_id = d.id
        LEFT JOIN dbo.states s ON c.state_id = s.id OR d.state_id = s.id
        LEFT JOIN dbo.mandals m ON b.mandal_id = m.id
        LEFT JOIN dbo.panchayats p ON b.panchayat_id = p.id OR b.panchayat_id = CAST(p.id AS NVARCHAR(64))
        LEFT JOIN dbo.wards w ON b.ward_id = w.id OR b.ward_id = CAST(w.id AS NVARCHAR(64))
        WHERE 1=1
      `;
      const params: Record<string, any> = {};
      const cstClause = buildSafeInClause(constituencyId || constituencyIds, 'bth_cst', ['b.constituency_id', 'c.id'], params);
      if (cstClause) sqlQuery += ` AND ${cstClause}`;
      const mndClause = buildSafeInClause(mandalId || mandalIds, 'bth_mnd', ['b.mandal_id', 'm.id'], params);
      if (mndClause) sqlQuery += ` AND ${mndClause}`;
      const panClause = buildSafeInClause(panchayatId || panchayatIds, 'bth_pan', ['b.panchayat_id', 'p.id'], params);
      if (panClause) sqlQuery += ` AND ${panClause}`;
      const wrdClause = buildSafeInClause(wardId || wardIds, 'bth_wrd', ['b.ward_id', 'w.id'], params);
      if (wrdClause) sqlQuery += ` AND ${wrdClause}`;
      const dstClause = buildSafeInClause(districtId || districtIds, 'bth_dst', ['c.district_id', 'd.id'], params);
      if (dstClause) sqlQuery += ` AND ${dstClause}`;
      const stClause = buildSafeInClause(stateId || stateIds, 'bth_st', ['c.state_id', 'd.state_id', 's.id'], params);
      if (stClause) sqlQuery += ` AND ${stClause}`;
      if (search && String(search).trim()) {
        sqlQuery += ` AND (b.name LIKE @search OR b.booth_number LIKE @search OR b.booth_label LIKE @search OR b.address LIKE @search)`;
        params.search = `%${String(search).trim()}%`;
      }
      
      sqlQuery += ` ORDER BY b.booth_number ASC, b.name ASC`;
      const booths = await query(sqlQuery, params);
      res.json(booths);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/booths", authenticateUser, async (req, res) => {
    try {
      const { id, booth_number, boothNumber, booth_label, boothLabel, name, constituency_id, constituencyId, mandal_id, mandalId, panchayat_id, panchayatId, ward_id, wardId, total_voters, totalVoters, population, address } = req.body;
      const cid = constituency_id !== undefined ? constituency_id : constituencyId;
      if (!cid || String(cid).trim() === '') {
        return res.status(400).json({ error: "Please select a valid parent constituency for this booth." });
      }
      const finalConstituencyId = !isNaN(Number(cid)) ? Number(cid) : String(cid);
      const mid = mandal_id !== undefined ? mandal_id : mandalId;
      const finalMandalId = mid && String(mid).trim() !== '' ? (!isNaN(Number(mid)) ? Number(mid) : String(mid)) : null;
      const pid = panchayat_id !== undefined ? panchayat_id : panchayatId;
      const finalPanchayatId = pid && String(pid).trim() !== '' ? (!isNaN(Number(pid)) ? Number(pid) : String(pid)) : null;
      const wid = ward_id !== undefined ? ward_id : wardId;
      const finalWardId = wid && String(wid).trim() !== '' ? (!isNaN(Number(wid)) ? Number(wid) : String(wid)) : null;

      const bnum = String(booth_number !== undefined ? booth_number : (boothNumber || '1')).trim();
      const blabel = String(booth_label !== undefined ? booth_label : (boothLabel || '')).trim();
      const bname = String(name || `Booth #${bnum}`).trim();
      const vtotal = total_voters !== undefined ? Number(total_voters) : (Number(totalVoters) || Number(population) || 0);
      const userId = (req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || null;
      const targetId = id !== undefined && id !== null && String(id).trim() !== '' ? id : null;

      if (targetId) {
        const parsedId = !isNaN(Number(targetId)) ? Number(targetId) : String(targetId);
        await execute(
          `UPDATE dbo.booths 
           SET booth_number = @booth_number, booth_label = @booth_label, name = @name, constituency_id = @constituency_id, mandal_id = @mandal_id, panchayat_id = @panchayat_id, ward_id = @ward_id, total_voters = @total_voters, address = @address 
           WHERE id = @id`,
          { id: parsedId, booth_number: bnum, booth_label: blabel, name: bname, constituency_id: finalConstituencyId, mandal_id: finalMandalId, panchayat_id: finalPanchayatId, ward_id: finalWardId, total_voters: vtotal, address: address || '' }
        );
        return res.json({ id: targetId, booth_number: bnum, booth_label: blabel, name: bname, constituency_id: finalConstituencyId, mandal_id: finalMandalId, panchayat_id: finalPanchayatId, ward_id: finalWardId, total_voters: vtotal, address });
      }

      const inserted = await query(
        `INSERT INTO dbo.booths (booth_number, booth_label, name, constituency_id, mandal_id, panchayat_id, ward_id, total_voters, address, created_by)
         OUTPUT INSERTED.*
         VALUES (@booth_number, @booth_label, @name, @constituency_id, @mandal_id, @panchayat_id, @ward_id, @total_voters, @address, @created_by)`,
        { booth_number: bnum, booth_label: blabel, name: bname, constituency_id: finalConstituencyId, mandal_id: finalMandalId, panchayat_id: finalPanchayatId, ward_id: finalWardId, total_voters: vtotal, address: address || '', created_by: userId }
      );
      res.json(inserted[0] || { booth_number: bnum, booth_label: blabel, name: bname, constituency_id: finalConstituencyId, mandal_id: finalMandalId, panchayat_id: finalPanchayatId, ward_id: finalWardId, total_voters: vtotal, address, created_by: userId });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/booths/:id", authenticateUser, async (req, res) => {
    try {
      const id = req.params.id;
      const { booth_number, boothNumber, booth_label, boothLabel, name, constituency_id, constituencyId, mandal_id, mandalId, panchayat_id, panchayatId, ward_id, wardId, total_voters, totalVoters, population, address } = req.body;
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
      const pid = panchayat_id !== undefined ? panchayat_id : panchayatId;
      const finalPanchayatId = pid && String(pid).trim() !== '' ? (!isNaN(Number(pid)) ? Number(pid) : String(pid)) : null;
      const wid = ward_id !== undefined ? ward_id : wardId;
      const finalWardId = wid && String(wid).trim() !== '' ? (!isNaN(Number(wid)) ? Number(wid) : String(wid)) : null;

      const bnum = String(booth_number !== undefined ? booth_number : (boothNumber || '1')).trim();
      const blabel = String(booth_label !== undefined ? booth_label : (boothLabel || '')).trim();
      const bname = String(name || `Booth #${bnum}`).trim();
      const vtotal = total_voters !== undefined ? Number(total_voters) : (Number(totalVoters) || Number(population) || 0);
      const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);

      await execute(
        `UPDATE dbo.booths 
         SET booth_number = @booth_number, booth_label = @booth_label, name = @name, constituency_id = @constituency_id, mandal_id = @mandal_id, panchayat_id = @panchayat_id, ward_id = @ward_id, total_voters = @total_voters, address = @address 
         WHERE id = @id`,
        { id: parsedId, booth_number: bnum, booth_label: blabel, name: bname, constituency_id: finalConstituencyId, mandal_id: finalMandalId, panchayat_id: finalPanchayatId, ward_id: finalWardId, total_voters: vtotal, address: address || '' }
      );
      res.json({ id, booth_number: bnum, booth_label: blabel, name: bname, constituency_id: finalConstituencyId, mandal_id: finalMandalId, panchayat_id: finalPanchayatId, ward_id: finalWardId, total_voters: vtotal, address });
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
               (SELECT COUNT(*) FROM dbo.voters v WHERE v.mandal_id = m.id) as real_voter_count,
               (CASE 
                  WHEN EXISTS (SELECT 1 FROM dbo.mandal_directories md WHERE md.mandal_id = CAST(m.id AS NVARCHAR(100))) 
                  THEN (SELECT COUNT(*) FROM dbo.mandal_directories md WHERE md.mandal_id = CAST(m.id AS NVARCHAR(100)))
                  ELSE 8 
                END) as committee_count
        FROM dbo.mandals m 
        LEFT JOIN dbo.constituencies c ON m.constituency_id = c.id
        LEFT JOIN dbo.districts d ON m.district_id = d.id OR c.district_id = d.id
        LEFT JOIN dbo.states s ON m.state_id = s.id OR d.state_id = s.id OR c.state_id = s.id
        LEFT JOIN dbo.users u ON m.admin_id = u.id OR (m.admin_id IS NOT NULL AND LOWER(m.admin_id) = LOWER(u.email))
        WHERE 1=1
      `;
      const params: Record<string, any> = {};

      if (adminId && adminId !== 'All' && String(adminId).trim() !== '') {
        sqlQuery += ` AND (m.admin_id = @reqAdminId OR LOWER(m.admin_id) = LOWER(@reqAdminId))`;
        params.reqAdminId = String(adminId).trim();
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
      const { name, mandal_code, mandalCode, code, president_name, presidentName, president_phone, presidentPhone, voter_count, voterCount, population, state_id, stateId, district_id, districtId, constituency_id, constituencyId, admin_id, adminId } = req.body;
      const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);
      
      const existing = await query(`SELECT * FROM dbo.mandals WHERE id = @id`, { id: parsedId });
      if (!existing || existing.length === 0) {
        return res.status(404).json({ error: 'Mandal not found' });
      }

      const mandal = existing[0];
      const effectiveAdminId = userRow?.parent_admin_id || reqUid;

      const rawCid = constituency_id !== undefined ? constituency_id : constituencyId;
      let finalCid = rawCid && String(rawCid).trim() !== '' ? (!isNaN(Number(rawCid)) ? Number(rawCid) : String(rawCid)) : (mandal.constituency_id || null);

      const rawDid = district_id !== undefined ? district_id : districtId;
      let finalDid = rawDid && String(rawDid).trim() !== '' ? (!isNaN(Number(rawDid)) ? Number(rawDid) : String(rawDid)) : (mandal.district_id || null);

      const rawSid = state_id !== undefined ? state_id : stateId;
      let finalSid = rawSid && String(rawSid).trim() !== '' ? (!isNaN(Number(rawSid)) ? Number(rawSid) : String(rawSid)) : (mandal.state_id || null);

      // Auto-lookup district and state if omitted or if constituency changed
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

      const mcode = (mandal_code || mandalCode || code) ? String(mandal_code || mandalCode || code).trim().toUpperCase() : null;
      const targetAdmin = (admin_id || adminId) ? (admin_id || adminId) : (mandal.admin_id || effectiveAdminId || null);

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
          mandal_code: mcode, 
          president_name: president_name !== undefined ? president_name : (presidentName !== undefined ? presidentName : mandal.president_name), 
          president_phone: president_phone !== undefined ? president_phone : (presidentPhone !== undefined ? presidentPhone : mandal.president_phone), 
          voter_count: (voter_count !== undefined && voter_count !== '') ? parseInt(voter_count, 10) : ((voterCount !== undefined && voterCount !== '') ? parseInt(voterCount, 10) : null), 
          population: (population !== undefined && population !== '') ? parseInt(population, 10) : null,
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
      const strId = String(mandalId);

      // 1. Delete mandal members
      await execute(`DELETE FROM dbo.mandal_members WHERE mandal_id = @strId OR mandal_id = @numId`, { strId, numId: parsedId });
      // 2. Delete mandal custom directories
      await execute(`DELETE FROM dbo.mandal_directories WHERE mandal_id = @strId OR mandal_id = @numId`, { strId, numId: parsedId });
      // 3. Unlink booths and voters
      await execute(`UPDATE dbo.booths SET mandal_id = NULL WHERE mandal_id = @strId OR mandal_id = @numId`, { strId, numId: parsedId });
      await execute(`UPDATE dbo.voters SET mandal_id = NULL WHERE mandal_id = @strId OR mandal_id = @numId`, { strId, numId: parsedId });
      // 4. Delete mandal
      await execute(`DELETE FROM dbo.mandals WHERE id = @numId`, { numId: parsedId });
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

  // Mandal Custom Directories / Committees
  app.get("/api/mandals/:mandalId/directories", optionalAuth, async (req, res) => {
    try {
      const { mandalId } = req.params;
      const parsedMandalId = !isNaN(Number(mandalId)) ? Number(mandalId) : String(mandalId);

      // Directories belong to the mandal and are visible to everyone viewing this mandal
      const sql = `SELECT * FROM dbo.mandal_directories WHERE mandal_id = @mandalId ORDER BY created_at ASC`;
      let dirs = await query(sql, { mandalId: String(parsedMandalId) }).catch(() => []);

      // If no directories exist yet for this mandal, seed the 8 core directories so they can be modified/updated/deleted
      if (!dirs || dirs.length === 0) {
        const DEFAULT_CATEGORIES = [
          { key: 'office_bearers', label: 'मण्डल पदाधिकारी व कार्यसमिति सदस्य', english_label: 'Mandal Office Bearers & Executive Committee Members', target_count: 45, icon: 'Shield', color_class: 'text-blue-500 bg-blue-50 dark:bg-blue-950/20' },
          { key: 'morcha_leaders', label: 'मोर्चा के अध्यक्ष व महामंत्री', english_label: 'Morcha Presidents & General Secretaries', target_count: 21, icon: 'Award', color_class: 'text-amber-500 bg-amber-50 dark:bg-amber-950/20' },
          { key: 'district_representatives', label: 'मण्डल से जिला में पदाधिकारी व कार्यसमिति सदस्य', english_label: 'Mandal to District Office Bearers & Executive Members', target_count: 8, icon: 'Layers', color_class: 'text-purple-500 bg-purple-50 dark:bg-purple-950/20' },
          { key: 'morcha_coordinators', label: 'मण्डल से जिला में मोर्चों में व प्रकोष्ठ में संयोजक / सह-संयोजक', english_label: 'Convenor / Co-convenor in Morchas & Cells (Mandal to District)', target_count: 10, icon: 'Briefcase', color_class: 'text-teal-500 bg-teal-50 dark:bg-teal-950/20' },
          { key: 'state_representatives', label: 'मण्डल से प्रदेश भाजपा, मोर्चा एवं प्रकोष्ठ', english_label: 'Mandal to State BJP, Morcha & Cells', target_count: 10, icon: 'Globe', color_class: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-950/20' },
          { key: 'cell_convenors', label: 'सभी प्रकोष्ठों के संयोजक', english_label: 'Convenors of all Cells', target_count: 17, icon: 'SlidersHorizontal', color_class: 'text-emerald-500 bg-emerald-50 dark:bg-emerald-950/20' },
          { key: 'former_representatives', label: 'चुने हुए पूर्व प्रतिनिधि', english_label: 'Elected Former Representatives', target_count: 20, icon: 'UserCheck', color_class: 'text-rose-500 bg-rose-50 dark:bg-rose-950/20' },
          { key: 'gram_kendra_pramukh', label: 'ग्राम केन्द्र प्रमुख', english_label: 'Gram Kendra Pramukh (Village Center Chiefs)', target_count: 15, icon: 'MapPin', color_class: 'text-orange-500 bg-orange-50 dark:bg-orange-950/20' }
        ];

        for (const cat of DEFAULT_CATEGORIES) {
          const dirId = `mdir_${cat.key}_${parsedMandalId}`;
          await execute(
            `INSERT INTO dbo.mandal_directories (id, mandal_id, admin_id, category_key, label, english_label, target_count, icon, color_class)
             VALUES (@id, @mandal_id, @admin_id, @category_key, @label, @english_label, @target_count, @icon, @color_class)`,
            { id: dirId, mandal_id: String(parsedMandalId), admin_id: 'default', category_key: cat.key, label: cat.label, english_label: cat.english_label, target_count: cat.target_count, icon: cat.icon, color_class: cat.color_class }
          ).catch(() => {});
        }
        dirs = await query(sql, { mandalId: String(parsedMandalId) }).catch(() => []);
      }

      res.json(dirs || []);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/mandals/:mandalId/directories", authenticateUser, async (req, res) => {
    try {
      const caller = (req as any).user;
      const { reqUid, userRow } = await getRequesterInfo(caller);
      const { mandalId } = req.params;
      const { id, category_key, categoryKey, label, english_label, englishLabel, target_count, targetCount, icon, color_class, colorClass, admin_id, adminId } = req.body;
      const parsedMandalId = !isNaN(Number(mandalId)) ? Number(mandalId) : String(mandalId);

      const mandals = await query(`SELECT * FROM dbo.mandals WHERE id = @id`, { id: parsedMandalId });
      const mandal = mandals && mandals.length > 0 ? mandals[0] : null;

      const effectiveAdminId = userRow?.parent_admin_id || reqUid;
      const dirId = id || `mdir_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const catKey = String(category_key || categoryKey || `custom_${Date.now()}`).trim();
      const lbl = String(label || 'नई डायरेक्टरी').trim();
      const engLbl = String(english_label || englishLabel || lbl).trim();
      const target = Number(target_count || targetCount || 10);
      const ic = String(icon || 'Users').trim();
      const clr = String(color_class || colorClass || 'text-blue-500 bg-blue-50 dark:bg-blue-950/20').trim();
      const assignedAdmin = admin_id || adminId || mandal?.admin_id || effectiveAdminId || 'default';

      await execute(
        `INSERT INTO dbo.mandal_directories (id, mandal_id, admin_id, category_key, label, english_label, target_count, icon, color_class)
         VALUES (@id, @mandal_id, @admin_id, @category_key, @label, @english_label, @target_count, @icon, @color_class)`,
        { id: dirId, mandal_id: String(parsedMandalId), admin_id: assignedAdmin, category_key: catKey, label: lbl, english_label: engLbl, target_count: target, icon: ic, color_class: clr }
      );

      res.json({ id: dirId, mandal_id: String(parsedMandalId), admin_id: assignedAdmin, category_key: catKey, label: lbl, english_label: engLbl, target_count: target, icon: ic, color_class: clr });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/mandals/directories/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { label, english_label, englishLabel, target_count, targetCount, icon, color_class, colorClass } = req.body;

      let dirs = await query(`SELECT * FROM dbo.mandal_directories WHERE id = @id`, { id });
      if ((!dirs || dirs.length === 0) && id.startsWith('core_')) {
        const catKey = id.replace('core_', '');
        dirs = await query(`SELECT * FROM dbo.mandal_directories WHERE category_key = @catKey`, { catKey });
      }
      if (!dirs || dirs.length === 0) {
        return res.status(404).json({ error: 'Directory not found' });
      }

      const dir = dirs[0];
      const realId = dir.id;
      const lbl = label !== undefined ? String(label).trim() : dir.label;
      const engLbl = (english_label !== undefined ? english_label : (englishLabel !== undefined ? englishLabel : dir.english_label));
      const target = (target_count !== undefined ? Number(target_count) : (targetCount !== undefined ? Number(targetCount) : dir.target_count));
      const ic = icon !== undefined ? String(icon).trim() : dir.icon;
      const clr = (color_class !== undefined ? color_class : (colorClass !== undefined ? colorClass : dir.color_class));

      await execute(
        `UPDATE dbo.mandal_directories 
         SET label = @label, english_label = @english_label, target_count = @target_count, icon = @icon, color_class = @color_class, updated_at = CURRENT_TIMESTAMP
         WHERE id = @id`,
        { id: realId, label: lbl, english_label: engLbl, target_count: target, icon: ic, color_class: clr }
      );

      res.json({ success: true, id: realId, label: lbl, english_label: engLbl, target_count: target, icon: ic, color_class: clr });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/mandals/directories/:id", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;

      let dirs = await query(`SELECT * FROM dbo.mandal_directories WHERE id = @id`, { id });
      if ((!dirs || dirs.length === 0) && id.startsWith('core_')) {
        const catKey = id.replace('core_', '');
        dirs = await query(`SELECT * FROM dbo.mandal_directories WHERE category_key = @catKey`, { catKey });
      }
      if (!dirs || dirs.length === 0) {
        return res.status(404).json({ error: 'Directory not found' });
      }

      const dir = dirs[0];
      await execute(`DELETE FROM dbo.mandal_directories WHERE id = @id`, { id: dir.id });
      await execute(`DELETE FROM dbo.mandal_members WHERE mandal_id = @mandalId AND category_key = @catKey`, { mandalId: dir.mandal_id, catKey: dir.category_key }).catch(() => {});
      res.json({ success: true, id: dir.id });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // ============================================================================
  // 3b. Panchayats / MC / ULBs & Wards / Villages
  // ============================================================================

  // Panchayats
  app.get("/api/panchayats", optionalAuth, async (req, res) => {
    try {
      res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
      const { mandalId, mandalIds, constituencyId, constituencyIds, districtId, districtIds, stateId, stateIds } = req.query;
      let sqlQuery = `
        SELECT p.*,
               m.name as mandal_name,
               c.name as constituency_name,
               d.name as district_name,
               s.name as state_name,
               COALESCE(p.constituency_id, m.constituency_id) as constituency_id,
               COALESCE(p.district_id, c.district_id, m.district_id) as district_id,
               COALESCE(p.state_id, d.state_id, c.state_id, m.state_id) as state_id,
               (SELECT COUNT(1) FROM dbo.wards w WHERE w.panchayat_id = p.id OR w.panchayat_id = CAST(p.id AS VARCHAR(64))) as wardCount,
               (SELECT COUNT(1) FROM dbo.booths b WHERE b.panchayat_id = p.id OR b.panchayat_id = CAST(p.id AS VARCHAR(64))) as boothCount
        FROM dbo.panchayats p
        LEFT JOIN dbo.mandals m ON p.mandal_id = m.id
        LEFT JOIN dbo.constituencies c ON p.constituency_id = c.id OR m.constituency_id = c.id
        LEFT JOIN dbo.districts d ON p.district_id = d.id OR c.district_id = d.id
        LEFT JOIN dbo.states s ON p.state_id = s.id OR d.state_id = s.id OR c.state_id = s.id
        WHERE 1=1
      `;
      const params: Record<string, any> = {};
      const mndClause = buildSafeInClause(mandalId || mandalIds, 'p_mnd', ['p.mandal_id', 'm.id'], params);
      if (mndClause) sqlQuery += ` AND ${mndClause}`;
      const cstClause = buildSafeInClause(constituencyId || constituencyIds, 'p_cst', ['p.constituency_id', 'c.id', 'm.constituency_id'], params);
      if (cstClause) sqlQuery += ` AND ${cstClause}`;
      const dstClause = buildSafeInClause(districtId || districtIds, 'p_dst', ['p.district_id', 'd.id', 'c.district_id'], params);
      if (dstClause) sqlQuery += ` AND ${dstClause}`;
      const stClause = buildSafeInClause(stateId || stateIds, 'p_st', ['p.state_id', 's.id', 'd.state_id'], params);
      if (stClause) sqlQuery += ` AND ${stClause}`;

      sqlQuery += ` ORDER BY p.name ASC`;
      const panchayats = await query(sqlQuery, params);
      res.json(panchayats);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/panchayats", authenticateUser, async (req, res) => {
    try {
      const { id, name, code, type, mandal_id, mandalId, constituency_id, constituencyId, district_id, districtId, state_id, stateId, population } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Panchayat / Local body name is required." });
      }
      const rawMandalId = mandal_id !== undefined ? mandal_id : mandalId;
      let finalMandalId = rawMandalId && String(rawMandalId).trim() !== '' ? (!isNaN(Number(rawMandalId)) ? Number(rawMandalId) : String(rawMandalId)) : null;
      const rawConstId = constituency_id !== undefined ? constituency_id : constituencyId;
      let finalConstId = rawConstId && String(rawConstId).trim() !== '' ? (!isNaN(Number(rawConstId)) ? Number(rawConstId) : String(rawConstId)) : null;
      const rawDistId = district_id !== undefined ? district_id : districtId;
      let finalDistId = rawDistId && String(rawDistId).trim() !== '' ? (!isNaN(Number(rawDistId)) ? Number(rawDistId) : String(rawDistId)) : null;
      const rawStateId = state_id !== undefined ? state_id : stateId;
      let finalStateId = rawStateId && String(rawStateId).trim() !== '' ? (!isNaN(Number(rawStateId)) ? Number(rawStateId) : String(rawStateId)) : null;

      // Auto-resolve hierarchy
      if (finalMandalId && (!finalConstId || !finalDistId || !finalStateId)) {
        const mRow = await query(`SELECT constituency_id, district_id, state_id FROM dbo.mandals WHERE id = @mid`, { mid: finalMandalId });
        if (mRow && mRow[0]) {
          if (!finalConstId) finalConstId = mRow[0].constituency_id;
          if (!finalDistId) finalDistId = mRow[0].district_id;
          if (!finalStateId) finalStateId = mRow[0].state_id;
        }
      }
      if (finalConstId && (!finalDistId || !finalStateId)) {
        const cRow = await query(`SELECT district_id, state_id FROM dbo.constituencies WHERE id = @cid`, { cid: finalConstId });
        if (cRow && cRow[0]) {
          if (!finalDistId) finalDistId = cRow[0].district_id;
          if (!finalStateId) finalStateId = cRow[0].state_id;
        }
      }
      if (finalDistId && !finalStateId) {
        const dRow = await query(`SELECT state_id FROM dbo.districts WHERE id = @did`, { did: finalDistId });
        if (dRow && dRow[0]) {
          finalStateId = dRow[0].state_id;
        }
      }

      const trimmedName = String(name).trim();
      const pCode = code ? String(code).trim() : null;
      const pType = type ? String(type).trim() : 'Gram Panchayat';
      const pop = population ? Number(population) : 0;
      const userId = (req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || null;

      const targetId = id !== undefined && id !== null && String(id).trim() !== '' ? id : null;
      if (targetId) {
        const parsedId = !isNaN(Number(targetId)) ? Number(targetId) : String(targetId);
        await execute(
          `UPDATE dbo.panchayats 
           SET name = @name, code = @code, type = @type, mandal_id = @mandal_id, constituency_id = @constituency_id, district_id = @district_id, state_id = @state_id, population = @population 
           WHERE id = @id`,
          { id: parsedId, name: trimmedName, code: pCode, type: pType, mandal_id: finalMandalId, constituency_id: finalConstId, district_id: finalDistId, state_id: finalStateId, population: pop }
        );
        return res.json({ id: targetId, name: trimmedName, code: pCode, type: pType, mandal_id: finalMandalId, constituency_id: finalConstId, district_id: finalDistId, state_id: finalStateId, population: pop });
      }

      const inserted = await query(
        `INSERT INTO dbo.panchayats (name, code, type, mandal_id, constituency_id, district_id, state_id, population, created_by)
         OUTPUT INSERTED.*
         VALUES (@name, @code, @type, @mandal_id, @constituency_id, @district_id, @state_id, @population, @created_by)`,
        { name: trimmedName, code: pCode, type: pType, mandal_id: finalMandalId, constituency_id: finalConstId, district_id: finalDistId, state_id: finalStateId, population: pop, created_by: userId }
      );
      res.json(inserted[0] || { name: trimmedName, code: pCode, type: pType, mandal_id: finalMandalId, constituency_id: finalConstId, district_id: finalDistId, state_id: finalStateId, population: pop });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/panchayats/:id", authenticateUser, async (req, res) => {
    try {
      const id = req.params.id;
      const { name, code, type, mandal_id, mandalId, constituency_id, constituencyId, district_id, districtId, state_id, stateId, population } = req.body;
      if (!id || String(id).trim() === '') return res.status(400).json({ error: "Invalid Panchayat ID." });
      if (!name || !String(name).trim()) return res.status(400).json({ error: "Name is required." });
      const parsedId = !isNaN(Number(id)) ? Number(id) : String(id);

      const rawMandalId = mandal_id !== undefined ? mandal_id : mandalId;
      let finalMandalId = rawMandalId && String(rawMandalId).trim() !== '' ? (!isNaN(Number(rawMandalId)) ? Number(rawMandalId) : String(rawMandalId)) : null;
      const rawConstId = constituency_id !== undefined ? constituency_id : constituencyId;
      let finalConstId = rawConstId && String(rawConstId).trim() !== '' ? (!isNaN(Number(rawConstId)) ? Number(rawConstId) : String(rawConstId)) : null;
      const rawDistId = district_id !== undefined ? district_id : districtId;
      let finalDistId = rawDistId && String(rawDistId).trim() !== '' ? (!isNaN(Number(rawDistId)) ? Number(rawDistId) : String(rawDistId)) : null;
      const rawStateId = state_id !== undefined ? state_id : stateId;
      let finalStateId = rawStateId && String(rawStateId).trim() !== '' ? (!isNaN(Number(rawStateId)) ? Number(rawStateId) : String(rawStateId)) : null;

      // Auto-resolve hierarchy
      if (finalMandalId && (!finalConstId || !finalDistId || !finalStateId)) {
        const mRow = await query(`SELECT constituency_id, district_id, state_id FROM dbo.mandals WHERE id = @mid`, { mid: finalMandalId });
        if (mRow && mRow[0]) {
          if (!finalConstId) finalConstId = mRow[0].constituency_id;
          if (!finalDistId) finalDistId = mRow[0].district_id;
          if (!finalStateId) finalStateId = mRow[0].state_id;
        }
      }
      if (finalConstId && (!finalDistId || !finalStateId)) {
        const cRow = await query(`SELECT district_id, state_id FROM dbo.constituencies WHERE id = @cid`, { cid: finalConstId });
        if (cRow && cRow[0]) {
          if (!finalDistId) finalDistId = cRow[0].district_id;
          if (!finalStateId) finalStateId = cRow[0].state_id;
        }
      }
      if (finalDistId && !finalStateId) {
        const dRow = await query(`SELECT state_id FROM dbo.districts WHERE id = @did`, { did: finalDistId });
        if (dRow && dRow[0]) {
          finalStateId = dRow[0].state_id;
        }
      }

      await execute(
        `UPDATE dbo.panchayats 
         SET name = @name, code = @code, type = @type, mandal_id = @mandal_id, constituency_id = @constituency_id, district_id = @district_id, state_id = @state_id, population = @population 
         WHERE id = @id`,
        { id: parsedId, name: String(name).trim(), code: code || null, type: type || 'Gram Panchayat', mandal_id: finalMandalId, constituency_id: finalConstId, district_id: finalDistId, state_id: finalStateId, population: Number(population) || 0 }
      );
      res.json({ id: parsedId, name: String(name).trim(), code, type, mandal_id: finalMandalId, constituency_id: finalConstId, district_id: finalDistId, state_id: finalStateId, population });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/panchayats/:id", authenticateUser, async (req, res) => {
    try {
      const pid = req.params.id;
      const parsedId = !isNaN(Number(pid)) ? Number(pid) : String(pid);
      await execute(`UPDATE dbo.wards SET panchayat_id = NULL WHERE panchayat_id = @pid OR panchayat_id = CAST(@pid AS NVARCHAR(64))`, { pid: parsedId });
      await execute(`UPDATE dbo.booths SET panchayat_id = NULL WHERE panchayat_id = @pid OR panchayat_id = CAST(@pid AS NVARCHAR(64))`, { pid: parsedId });
      await execute(`UPDATE dbo.voters SET panchayat_id = NULL WHERE panchayat_id = @pid OR panchayat_id = CAST(@pid AS NVARCHAR(64))`, { pid: parsedId });
      await execute(`DELETE FROM dbo.panchayats WHERE id = @pid`, { pid: parsedId });
      res.json({ success: true, message: 'Panchayat deleted successfully' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Wards / Villages
  app.get("/api/wards", optionalAuth, async (req, res) => {
    try {
      const { panchayatId, panchayatIds, mandalId, mandalIds, constituencyId, constituencyIds, districtId, districtIds, stateId, stateIds } = req.query;
      let sqlQuery = `
        SELECT w.*,
               p.name as panchayat_name,
               m.name as mandal_name,
               c.name as constituency_name,
               d.name as district_name,
               s.name as state_name,
               (SELECT COUNT(1) FROM dbo.booths b WHERE b.ward_id = w.id OR b.ward_id = CAST(w.id AS VARCHAR(64))) as boothCount,
               (SELECT COUNT(1) FROM dbo.voters v WHERE v.ward_id = w.id OR v.ward_id = CAST(w.id AS VARCHAR(64))) as voterCount
        FROM dbo.wards w
        LEFT JOIN dbo.panchayats p ON w.panchayat_id = p.id
        LEFT JOIN dbo.mandals m ON w.mandal_id = m.id OR p.mandal_id = m.id
        LEFT JOIN dbo.constituencies c ON w.constituency_id = c.id OR p.constituency_id = c.id OR m.constituency_id = c.id
        LEFT JOIN dbo.districts d ON w.district_id = d.id OR c.district_id = d.id
        LEFT JOIN dbo.states s ON w.state_id = s.id OR d.state_id = s.id OR c.state_id = s.id
        WHERE 1=1
      `;
      const params: Record<string, any> = {};
      const pchClause = buildSafeInClause(panchayatId || panchayatIds, 'w_pch', ['w.panchayat_id', 'p.id'], params);
      if (pchClause) sqlQuery += ` AND ${pchClause}`;
      const mndClause = buildSafeInClause(mandalId || mandalIds, 'w_mnd', ['w.mandal_id', 'm.id', 'p.mandal_id'], params);
      if (mndClause) sqlQuery += ` AND ${mndClause}`;
      const cstClause = buildSafeInClause(constituencyId || constituencyIds, 'w_cst', ['w.constituency_id', 'c.id', 'm.constituency_id'], params);
      if (cstClause) sqlQuery += ` AND ${cstClause}`;
      const dstClause = buildSafeInClause(districtId || districtIds, 'w_dst', ['w.district_id', 'd.id', 'c.district_id'], params);
      if (dstClause) sqlQuery += ` AND ${dstClause}`;
      const stClause = buildSafeInClause(stateId || stateIds, 'w_st', ['w.state_id', 's.id', 'd.state_id'], params);
      if (stClause) sqlQuery += ` AND ${stClause}`;

      sqlQuery += ` ORDER BY w.ward_number ASC, w.name ASC`;
      const wards = await query(sqlQuery, params);
      res.json(wards);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.post("/api/wards", authenticateUser, async (req, res) => {
    try {
      const { id, name, ward_number, wardNumber, type, panchayat_id, panchayatId, mandal_id, mandalId, constituency_id, constituencyId, district_id, districtId, state_id, stateId, population, total_voters, totalVoters } = req.body;
      if (!name || !String(name).trim()) {
        return res.status(400).json({ error: "Ward / Village name is required." });
      }
      const rawPchId = panchayat_id !== undefined ? panchayat_id : panchayatId;
      const finalPchId = rawPchId && !isNaN(Number(rawPchId)) ? Number(rawPchId) : null;
      const rawMandalId = mandal_id !== undefined ? mandal_id : mandalId;
      const finalMandalId = rawMandalId && !isNaN(Number(rawMandalId)) ? Number(rawMandalId) : null;
      const rawConstId = constituency_id !== undefined ? constituency_id : constituencyId;
      const finalConstId = rawConstId && !isNaN(Number(rawConstId)) ? Number(rawConstId) : null;
      const rawDistId = district_id !== undefined ? district_id : districtId;
      const finalDistId = rawDistId && !isNaN(Number(rawDistId)) ? Number(rawDistId) : null;
      const rawStateId = state_id !== undefined ? state_id : stateId;
      const finalStateId = rawStateId && !isNaN(Number(rawStateId)) ? Number(rawStateId) : null;

      const trimmedName = String(name).trim();
      const wNumber = ward_number || wardNumber || '';
      const wType = type ? String(type).trim() : 'Ward';
      const pop = population ? Number(population) : 0;
      const vTotal = total_voters !== undefined ? Number(total_voters) : (Number(totalVoters) || 0);
      const userId = (req as any).user?.uid || (req as any).user?.id || (req as any).user?.email || null;

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.wards 
           SET name = @name, ward_number = @ward_number, type = @type, panchayat_id = @panchayat_id, mandal_id = @mandal_id, constituency_id = @constituency_id, district_id = @district_id, state_id = @state_id, population = @population, total_voters = @total_voters 
           WHERE id = @id`,
          { id: Number(id), name: trimmedName, ward_number: wNumber, type: wType, panchayat_id: finalPchId, mandal_id: finalMandalId, constituency_id: finalConstId, district_id: finalDistId, state_id: finalStateId, population: pop, total_voters: vTotal }
        );
        return res.json({ id: Number(id), name: trimmedName, ward_number: wNumber, type: wType, panchayat_id: finalPchId, mandal_id: finalMandalId, constituency_id: finalConstId, district_id: finalDistId, state_id: finalStateId, population: pop, total_voters: vTotal });
      }

      const inserted = await query(
        `INSERT INTO dbo.wards (name, ward_number, type, panchayat_id, mandal_id, constituency_id, district_id, state_id, population, total_voters, created_by)
         OUTPUT INSERTED.*
         VALUES (@name, @ward_number, @type, @panchayat_id, @mandal_id, @constituency_id, @district_id, @state_id, @population, @total_voters, @created_by)`,
        { name: trimmedName, ward_number: wNumber, type: wType, panchayat_id: finalPchId, mandal_id: finalMandalId, constituency_id: finalConstId, district_id: finalDistId, state_id: finalStateId, population: pop, total_voters: vTotal, created_by: userId }
      );
      res.json(inserted[0] || { name: trimmedName, ward_number: wNumber, type: wType, panchayat_id: finalPchId, mandal_id: finalMandalId, constituency_id: finalConstId, district_id: finalDistId, state_id: finalStateId, population: pop, total_voters: vTotal });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.put("/api/wards/:id", authenticateUser, async (req, res) => {
    try {
      const id = req.params.id;
      const { name, ward_number, wardNumber, type, panchayat_id, panchayatId, mandal_id, mandalId, constituency_id, constituencyId, district_id, districtId, state_id, stateId, population, total_voters, totalVoters } = req.body;
      if (!id || String(id).trim() === '') return res.status(400).json({ error: "Invalid Ward ID." });
      if (!name || !String(name).trim()) return res.status(400).json({ error: "Name is required." });
      const rawPchId = panchayat_id !== undefined ? panchayat_id : panchayatId;
      const finalPchId = rawPchId && !isNaN(Number(rawPchId)) ? Number(rawPchId) : null;
      const rawMandalId = mandal_id !== undefined ? mandal_id : mandalId;
      const finalMandalId = rawMandalId && !isNaN(Number(rawMandalId)) ? Number(rawMandalId) : null;
      const rawConstId = constituency_id !== undefined ? constituency_id : constituencyId;
      const finalConstId = rawConstId && !isNaN(Number(rawConstId)) ? Number(rawConstId) : null;
      const rawDistId = district_id !== undefined ? district_id : districtId;
      const finalDistId = rawDistId && !isNaN(Number(rawDistId)) ? Number(rawDistId) : null;
      const rawStateId = state_id !== undefined ? state_id : stateId;
      const finalStateId = rawStateId && !isNaN(Number(rawStateId)) ? Number(rawStateId) : null;

      await execute(
        `UPDATE dbo.wards 
         SET name = @name, ward_number = @ward_number, type = @type, panchayat_id = @panchayat_id, mandal_id = @mandal_id, constituency_id = @constituency_id, district_id = @district_id, state_id = @state_id, population = @population, total_voters = @total_voters 
         WHERE id = @id`,
        { id: Number(id), name: String(name).trim(), ward_number: ward_number || wardNumber || '', type: type || 'Ward', panchayat_id: finalPchId, mandal_id: finalMandalId, constituency_id: finalConstId, district_id: finalDistId, state_id: finalStateId, population: Number(population) || 0, total_voters: Number(total_voters || totalVoters) || 0 }
      );
      res.json({ id: Number(id), name: String(name).trim(), ward_number, type, panchayat_id: finalPchId, mandal_id: finalMandalId, constituency_id: finalConstId, district_id: finalDistId, state_id: finalStateId, population, total_voters });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  app.delete("/api/wards/:id", authenticateUser, async (req, res) => {
    try {
      const wid = req.params.id;
      await execute(`UPDATE dbo.booths SET ward_id = NULL WHERE ward_id = @wid`, { wid });
      await execute(`UPDATE dbo.voters SET ward_id = NULL WHERE ward_id = @wid`, { wid });
      await execute(`DELETE FROM dbo.wards WHERE id = @wid`, { wid });
      res.json({ success: true, message: 'Ward deleted successfully' });
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
        boothId, mandalId, panchayatId, wardId, constituencyId, districtId, stateId,
        boothIds, mandalIds, panchayatIds, wardIds, constituencyIds, districtIds, stateIds,
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

          const rawState = userRow.state_id || userRow.stateId || electSettings.state_id || electSettings.stateId || electSettings.state_ids || electSettings.stateIds || electSettings.states;
          const rawDist = userRow.district_id || userRow.districtId || electSettings.district_id || electSettings.districtId || electSettings.district_ids || electSettings.districtIds || electSettings.districts;
          const rawConst = userRow.constituency_id || userRow.constituencyId || electSettings.constituency_id || electSettings.constituencyId || electSettings.constituency_ids || electSettings.constituencyIds || electSettings.constituencies;
          const rawMandal = userRow.mandal_id || userRow.mandalId || electSettings.mandal_id || electSettings.mandalId || electSettings.mandal_ids || electSettings.mandalIds || electSettings.mandals || electSettings.block_id || electSettings.block_ids;
          const rawPanchayat = userRow.panchayat_id || userRow.panchayatId || electSettings.panchayat_id || electSettings.panchayatId || electSettings.panchayat_ids || electSettings.panchayatIds || electSettings.panchayats;
          const rawWard = userRow.ward_id || userRow.wardId || electSettings.ward_id || electSettings.wardId || electSettings.ward_ids || electSettings.wardIds || electSettings.wards;
          const rawBooth = userRow.booth_id || userRow.boothId || electSettings.booth_id || electSettings.boothId || electSettings.booth_ids || electSettings.boothIds || electSettings.booths;
          const rawBooths = userRow.assigned_booths || electSettings.assigned_booths;

          const userStates = rawState ? String(rawState).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          const userDistricts = rawDist ? String(rawDist).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          const userConstituencies = rawConst ? String(rawConst).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          const userMandals = rawMandal ? String(rawMandal).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          const userPanchayats = rawPanchayat ? String(rawPanchayat).split(',').map((s: string) => s.trim()).filter(Boolean) : [];
          const userWards = rawWard ? String(rawWard).split(',').map((s: string) => s.trim()).filter(Boolean) : [];

          let userBooths: string[] = [];
          try {
            userBooths = rawBooths ? (typeof rawBooths === 'string' ? JSON.parse(rawBooths) : rawBooths) : [];
          } catch {}
          if (!Array.isArray(userBooths) || userBooths.length === 0) {
            if (rawBooth) userBooths = String(rawBooth).split(',').map((s: string) => s.trim()).filter(Boolean);
          }

          // Enforce all assigned demographic levels
          if (userBooths.length > 0) {
            const bClause = buildSafeInClause(userBooths.join(','), 'u_bth', ['v.booth_id', 'b.id', 'b.booth_number', 'v.part_no'], params);
            if (bClause) whereConditions.push(bClause);
          }
          if (userWards.length > 0) {
            const wrdClause = buildSafeInClause(userWards.join(','), 'u_wrd', ['v.ward_id', 'b.ward_id', 'w.id'], params);
            if (wrdClause) whereConditions.push(wrdClause);
          }
          if (userPanchayats.length > 0) {
            const pchClause = buildSafeInClause(userPanchayats.join(','), 'u_pch', ['v.panchayat_id', 'b.panchayat_id', 'p.id'], params);
            if (pchClause) whereConditions.push(pchClause);
          }
          if (userMandals.length > 0) {
            const mClause = buildSafeInClause(userMandals.join(','), 'u_mnd', ['v.mandal_id', 'b.mandal_id', 'm.id'], params);
            if (mClause) whereConditions.push(mClause);
          }
          if (userConstituencies.length > 0) {
            const cClause = buildSafeInClause(userConstituencies.join(','), 'u_cst', ['v.constituency_id', 'b.constituency_id', 'c.id'], params);
            if (cClause) whereConditions.push(cClause);
          }
          if (userDistricts.length > 0) {
            const dClause = buildSafeInClause(userDistricts.join(','), 'u_dst', ['v.district_id', 'c.district_id', 'd.id'], params);
            if (dClause) whereConditions.push(dClause);
          }
          if (userStates.length > 0) {
            const sClause = buildSafeInClause(userStates.join(','), 'u_st', ['v.state_id', 'c.state_id', 'd.state_id', 's.id'], params);
            if (sClause) whereConditions.push(sClause);
          }
        }
      }

      // 2. Query level filter parameters (from dropdowns or multi-selects)
      const bClause = buildSafeInClause(boothId || boothIds, 'f_bth', ['v.booth_id', 'b.id', 'b.booth_number', 'v.part_no'], params);
      if (bClause) whereConditions.push(bClause);

      const wrdClause = buildSafeInClause(wardId || wardIds, 'f_wrd', ['v.ward_id', 'b.ward_id', 'w.id'], params);
      if (wrdClause) whereConditions.push(wrdClause);

      const pchClause = buildSafeInClause(panchayatId || panchayatIds, 'f_pch', ['v.panchayat_id', 'b.panchayat_id', 'p.id'], params);
      if (pchClause) whereConditions.push(pchClause);

      const mClause = buildSafeInClause(mandalId || mandalIds, 'f_mnd', ['v.mandal_id', 'b.mandal_id', 'm.id'], params);
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
        whereConditions.push(`(v.name LIKE @search OR v.voter_id LIKE @search OR v.mobile LIKE @search OR v.house_no LIKE @search OR v.village LIKE @search OR v.panchayat_name LIKE @search OR v.ward_name LIKE @search)`);
        params.search = `%${String(search).trim()}%`;
      }

      const whereSql = whereConditions.join(' AND ');

      // Get total count
      const countResult = await query(`
        SELECT COUNT(*) as total 
        FROM dbo.voters v 
        LEFT JOIN dbo.booths b ON v.booth_id = b.id
        LEFT JOIN dbo.wards w ON v.ward_id = w.id OR b.ward_id = w.id
        LEFT JOIN dbo.panchayats p ON v.panchayat_id = p.id OR b.panchayat_id = p.id OR w.panchayat_id = p.id
        LEFT JOIN dbo.mandals m ON v.mandal_id = m.id OR b.mandal_id = m.id OR p.mandal_id = m.id
        LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id OR b.constituency_id = c.id OR m.constituency_id = c.id
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
          COALESCE(he.vital_status, v.vital_status, 'Active') as vital_status,
          COALESCE(he.death_date, v.death_date) as death_date,
          COALESCE(he.death_notes, v.death_notes) as death_notes,
          COALESCE(he.physical_profile, v.physical_profile, 'General') as physical_profile,
          COALESCE(he.disability_category, v.disability_category, 'None') as disability_category,
          COALESCE(he.disability_percent, v.disability_percent, 0) as disability_percent,
          COALESCE(he.eci_assistance_needed, v.eci_assistance_needed, 0) as eci_assistance_needed,
          COALESCE(he.economic_category, v.economic_category, 'APL') as economic_category,
          COALESCE(he.income_range, v.income_range, '₹15,000 - ₹30,000') as income_range,
          COALESCE(he.land_ownership, v.land_ownership, 'Small Farmer') as land_ownership,
          COALESCE(he.ration_card_type, v.ration_card_type) as ration_card_type,
          COALESCE(he.ration_card_no, v.ration_card_no) as ration_card_no,
          COALESCE(he.housing_type, v.housing_type) as housing_type,
          b.name as booth_name, 
          b.booth_number, 
          COALESCE(w.name, v.ward_name) as ward_name,
          COALESCE(w.ward_number, '') as ward_number,
          COALESCE(p.name, v.panchayat_name, v.village) as panchayat_name,
          m.name as mandal_name, 
          c.name as constituency_name,
          d.name as district_name,
          s.name as state_name
        FROM dbo.voters v
        LEFT JOIN dbo.voter_health_economy he ON (he.voter_doc_id = CAST(v.id AS VARCHAR(64)) OR he.voter_epic = v.voter_id)
        LEFT JOIN dbo.booths b ON v.booth_id = b.id
        LEFT JOIN dbo.wards w ON v.ward_id = w.id OR b.ward_id = w.id
        LEFT JOIN dbo.panchayats p ON v.panchayat_id = p.id OR b.panchayat_id = p.id OR w.panchayat_id = p.id
        LEFT JOIN dbo.mandals m ON v.mandal_id = m.id OR b.mandal_id = m.id OR p.mandal_id = m.id
        LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id OR b.constituency_id = c.id OR m.constituency_id = c.id
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
      const reqUserId = (req as any).user?.uid || (req as any).user?.email || 'admin';
      const reqUserName = (req as any).user?.name || (req as any).user?.username || 'Staff';

      const pid = v.panchayat_id !== undefined ? v.panchayat_id : v.panchayatId;
      const wid = v.ward_id !== undefined ? v.ward_id : v.wardId;
      const pname = v.panchayat_name || v.panchayatName || null;
      const wname = v.ward_name || v.wardName || null;

      if (id && String(id).trim() !== '') {
        const idParam = String(id);
        await execute(
          `UPDATE dbo.voters 
           SET voter_id = COALESCE(@voter_id, voter_id),
               name = COALESCE(@name, name),
               relation_name = COALESCE(@relation_name, relation_name),
               relation_type = COALESCE(@relation_type, relation_type),
               aadhar_number = COALESCE(@aadhar_number, aadhar_number),
               gender = COALESCE(@gender, gender),
               age = COALESCE(@age, age),
               dob = COALESCE(@dob, dob),
               mobile = COALESCE(@mobile, mobile),
               additional_mobile = COALESCE(@additional_mobile, additional_mobile),
               email = COALESCE(@email, email),
               address = COALESCE(@address, address),
               new_address = COALESCE(@new_address, new_address),
               house_no = COALESCE(@house_no, house_no),
               village = COALESCE(@village, village),
               caste = COALESCE(@caste, caste),
               occupation = COALESCE(@occupation, occupation),
               education = COALESCE(@education, education),
               is_karyakarta = COALESCE(@is_karyakarta, is_karyakarta),
               voting_status = COALESCE(@voting_status, voting_status),
               party_inclination = COALESCE(@party_inclination, party_inclination),
               booth_id = COALESCE(@booth_id, booth_id),
               ward_id = COALESCE(@ward_id, ward_id),
               ward_name = COALESCE(@ward_name, ward_name),
               panchayat_id = COALESCE(@panchayat_id, panchayat_id),
               panchayat_name = COALESCE(@panchayat_name, panchayat_name),
               mandal_id = COALESCE(@mandal_id, mandal_id),
               constituency_id = COALESCE(@constituency_id, constituency_id),
               vital_status = COALESCE(@vital_status, vital_status),
               death_date = COALESCE(@death_date, death_date),
               death_notes = COALESCE(@death_notes, death_notes),
               physical_profile = COALESCE(@physical_profile, physical_profile),
               disability_category = COALESCE(@disability_category, disability_category),
               disability_percent = COALESCE(@disability_percent, disability_percent),
               eci_assistance_needed = COALESCE(@eci_assistance_needed, eci_assistance_needed),
               economic_category = COALESCE(@economic_category, economic_category),
               income_range = COALESCE(@income_range, income_range),
               land_ownership = COALESCE(@land_ownership, land_ownership),
               ration_card_type = COALESCE(@ration_card_type, ration_card_type),
               ration_card_no = COALESCE(@ration_card_no, ration_card_no),
               housing_type = COALESCE(@housing_type, housing_type)
           WHERE voter_id = @idParam OR CAST(id AS VARCHAR(64)) = @idParam`,
          {
            idParam,
            voter_id: v.voter_id || v.voterId,
            name: v.name,
            relation_name: v.relation_name || v.relationName || '',
            relation_type: v.relation_type || v.relationType || 'Father',
            aadhar_number: v.aadhar_number || v.aadharNumber || null,
            gender: v.gender || 'Male',
            age: v.age !== undefined && v.age !== null && v.age !== '' ? parseInt(String(v.age), 10) : null,
            dob: v.dob || null,
            mobile: v.mobile || '',
            additional_mobile: v.additional_mobile || v.additionalMobile || null,
            email: v.email || '',
            address: v.address || '',
            new_address: v.new_address || v.newAddress || null,
            house_no: v.house_no || v.houseNo || '',
            village: v.village || '',
            caste: v.caste || '',
            occupation: v.occupation || '',
            education: v.education || 'Unspecified',
            is_karyakarta: v.is_karyakarta !== undefined ? (v.is_karyakarta ? 1 : 0) : (v.isKaryakarta ? 1 : 0),
            voting_status: v.voting_status || (v.voted ? 'voted' : 'unvoted') || 'unvoted',
            party_inclination: v.party_inclination || v.partyInclination || 'Neutral',
            booth_id: bid ? String(bid) : null,
            ward_id: wid ? String(wid) : null,
            ward_name: wname,
            panchayat_id: pid ? String(pid) : null,
            panchayat_name: pname,
            mandal_id: mid ? String(mid) : null,
            constituency_id: cid ? String(cid) : null,
            vital_status: v.vital_status || v.vitalStatus || 'Active',
            death_date: v.death_date || v.deathDate || null,
            death_notes: v.death_notes || v.deathNotes || null,
            physical_profile: v.physical_profile || v.physicalProfile || 'General',
            disability_category: v.disability_category || v.disabilityCategory || 'None',
            disability_percent: v.disability_percent !== undefined ? Number(v.disability_percent) : (v.disabilityPercent !== undefined ? Number(v.disabilityPercent) : 0),
            eci_assistance_needed: v.eci_assistance_needed !== undefined ? (v.eci_assistance_needed ? 1 : 0) : (v.eciAssistanceNeeded ? 1 : 0),
            economic_category: v.economic_category || v.economicCategory || 'APL',
            income_range: v.income_range || v.incomeRange || '₹15,000 - ₹30,000',
            land_ownership: v.land_ownership || v.landOwnership || 'Small Farmer',
            ration_card_type: v.ration_card_type || v.rationCardType || null,
            ration_card_no: v.ration_card_no || v.rationCardNo || null,
            housing_type: v.housing_type || v.housingType || null
          }
        );

        // Upsert into dedicated dbo.voter_health_economy table
        const voterEpicVal = v.voter_id || v.voterId || idParam;
        const aadharVal = v.aadhar_number || v.aadharNumber || null;
        await execute(
          `IF EXISTS (SELECT 1 FROM dbo.voter_health_economy WHERE voter_doc_id = @idParam OR voter_epic = @voterEpicVal)
           BEGIN
             UPDATE dbo.voter_health_economy SET
               voter_epic = @voterEpicVal,
               aadhar_number = COALESCE(@aadharVal, aadhar_number),
               vital_status = COALESCE(@vital_status, vital_status),
               death_date = COALESCE(@death_date, death_date),
               death_notes = COALESCE(@death_notes, death_notes),
               physical_profile = COALESCE(@physical_profile, physical_profile),
               disability_category = COALESCE(@disability_category, disability_category),
               disability_percent = COALESCE(@disability_percent, disability_percent),
               eci_assistance_needed = COALESCE(@eci_assistance_needed, eci_assistance_needed),
               economic_category = COALESCE(@economic_category, economic_category),
               income_range = COALESCE(@income_range, income_range),
               land_ownership = COALESCE(@land_ownership, land_ownership),
               ration_card_type = COALESCE(@ration_card_type, ration_card_type),
               ration_card_no = COALESCE(@ration_card_no, ration_card_no),
               housing_type = COALESCE(@housing_type, housing_type),
               recorded_by = @reqUserId,
               recorded_by_name = @reqUserName,
               updated_at = SYSUTCDATETIME()
             WHERE voter_doc_id = @idParam OR voter_epic = @voterEpicVal
           END
           ELSE
           BEGIN
             INSERT INTO dbo.voter_health_economy (
               voter_doc_id, voter_epic, aadhar_number, vital_status, death_date, death_notes,
               physical_profile, disability_category, disability_percent, eci_assistance_needed,
               economic_category, income_range, land_ownership, ration_card_type, ration_card_no, housing_type,
               recorded_by, recorded_by_name
             ) VALUES (
               @idParam, @voterEpicVal, @aadharVal, @vital_status, @death_date, @death_notes,
               @physical_profile, @disability_category, @disability_percent, @eci_assistance_needed,
               @economic_category, @income_range, @land_ownership, @ration_card_type, @ration_card_no, @housing_type,
               @reqUserId, @reqUserName
             )
           END`,
          {
            idParam,
            voterEpicVal,
            aadharVal,
            vital_status: v.vital_status || v.vitalStatus || 'Active',
            death_date: v.death_date || v.deathDate || null,
            death_notes: v.death_notes || v.deathNotes || null,
            physical_profile: v.physical_profile || v.physicalProfile || 'General',
            disability_category: v.disability_category || v.disabilityCategory || 'None',
            disability_percent: v.disability_percent !== undefined ? Number(v.disability_percent) : (v.disabilityPercent !== undefined ? Number(v.disabilityPercent) : 0),
            eci_assistance_needed: v.eci_assistance_needed !== undefined ? (v.eci_assistance_needed ? 1 : 0) : (v.eciAssistanceNeeded ? 1 : 0),
            economic_category: v.economic_category || v.economicCategory || 'APL',
            income_range: v.income_range || v.incomeRange || '₹15,000 - ₹30,000',
            land_ownership: v.land_ownership || v.landOwnership || 'Small Farmer',
            ration_card_type: v.ration_card_type || v.rationCardType || null,
            ration_card_no: v.ration_card_no || v.rationCardNo || null,
            housing_type: v.housing_type || v.housingType || null,
            reqUserId,
            reqUserName
          }
        );

        return res.json({ id: idParam, ...v });
      }

      const voterEpic = v.voter_id || v.voterId || `EPIC${Date.now()}`;
      const inserted = await query(
        `INSERT INTO dbo.voters (
          voter_id, name, relation_name, relation_type, aadhar_number, gender, age, dob,
          part_no, sr_no, mobile, additional_mobile, email, address, new_address, house_no, village, 
          caste, occupation, education, is_karyakarta, voting_status, party_inclination, 
          booth_id, ward_id, ward_name, panchayat_id, panchayat_name, mandal_id, constituency_id, state_id, district_id,
          vital_status, death_date, death_notes, physical_profile, disability_category, disability_percent,
          eci_assistance_needed, economic_category, income_range, land_ownership, ration_card_type, ration_card_no, housing_type
        ) 
        OUTPUT INSERTED.*
        VALUES (
          @voter_id, @name, @relation_name, @relation_type, @aadhar_number, @gender, @age, @dob,
          @part_no, @sr_no, @mobile, @additional_mobile, @email, @address, @new_address, @house_no, @village,
          @caste, @occupation, @education, @is_karyakarta, @voting_status, @party_inclination,
          @booth_id, @ward_id, @ward_name, @panchayat_id, @panchayat_name, @mandal_id, @constituency_id, @state_id, @district_id,
          @vital_status, @death_date, @death_notes, @physical_profile, @disability_category, @disability_percent,
          @eci_assistance_needed, @economic_category, @income_range, @land_ownership, @ration_card_type, @ration_card_no, @housing_type
        )`,
        {
          voter_id: voterEpic,
          name: v.name,
          relation_name: v.relation_name || v.relationName || '',
          relation_type: v.relation_type || v.relationType || 'Father',
          aadhar_number: v.aadhar_number || v.aadharNumber || null,
          gender: v.gender || 'Male',
          age: v.age !== undefined && v.age !== null && v.age !== '' ? parseInt(String(v.age), 10) : null,
          dob: v.dob || null,
          part_no: v.part_no || v.partNo || '',
          sr_no: v.sr_no || v.srNo || '',
          mobile: v.mobile || '',
          additional_mobile: v.additional_mobile || v.additionalMobile || null,
          email: v.email || '',
          address: v.address || '',
          new_address: v.new_address || v.newAddress || null,
          house_no: v.house_no || v.houseNo || '',
          village: v.village || '',
          caste: v.caste || '',
          occupation: v.occupation || '',
          education: v.education || 'Unspecified',
          is_karyakarta: v.is_karyakarta || v.isKaryakarta ? 1 : 0,
          voting_status: v.voting_status || (v.voted ? 'voted' : 'unvoted') || 'unvoted',
          party_inclination: v.party_inclination || v.partyInclination || 'Neutral',
          booth_id: bid ? String(bid) : null,
          ward_id: wid ? String(wid) : null,
          ward_name: wname,
          panchayat_id: pid ? String(pid) : null,
          panchayat_name: pname,
          mandal_id: mid ? String(mid) : null,
          constituency_id: cid ? String(cid) : null,
          state_id: sid ? String(sid) : null,
          district_id: did ? String(did) : null,
          vital_status: v.vital_status || v.vitalStatus || 'Active',
          death_date: v.death_date || v.deathDate || null,
          death_notes: v.death_notes || v.deathNotes || null,
          physical_profile: v.physical_profile || v.physicalProfile || 'General',
          disability_category: v.disability_category || v.disabilityCategory || 'None',
          disability_percent: v.disability_percent !== undefined ? Number(v.disability_percent) : (v.disabilityPercent !== undefined ? Number(v.disabilityPercent) : 0),
          eci_assistance_needed: v.eci_assistance_needed || v.eciAssistanceNeeded ? 1 : 0,
          economic_category: v.economic_category || v.economicCategory || 'APL',
          income_range: v.income_range || v.incomeRange || '₹15,000 - ₹30,000',
          land_ownership: v.land_ownership || v.landOwnership || 'Small Farmer',
          ration_card_type: v.ration_card_type || v.rationCardType || null,
          ration_card_no: v.ration_card_no || v.rationCardNo || null,
          housing_type: v.housing_type || v.housingType || null
        }
      );

      const createdVoter = inserted[0] || v;
      const createdId = String(createdVoter.id || voterEpic);

      // Insert into dedicated dbo.voter_health_economy table
      await execute(
        `INSERT INTO dbo.voter_health_economy (
           voter_doc_id, voter_epic, aadhar_number, vital_status, death_date, death_notes,
           physical_profile, disability_category, disability_percent, eci_assistance_needed,
           economic_category, income_range, land_ownership, ration_card_type, ration_card_no, housing_type,
           recorded_by, recorded_by_name
         ) VALUES (
           @voter_doc_id, @voter_epic, @aadhar_number, @vital_status, @death_date, @death_notes,
           @physical_profile, @disability_category, @disability_percent, @eci_assistance_needed,
           @economic_category, @income_range, @land_ownership, @ration_card_type, @ration_card_no, @housing_type,
           @reqUserId, @reqUserName
         )`,
        {
          voter_doc_id: createdId,
          voter_epic: voterEpic,
          aadhar_number: v.aadhar_number || v.aadharNumber || null,
          vital_status: v.vital_status || v.vitalStatus || 'Active',
          death_date: v.death_date || v.deathDate || null,
          death_notes: v.death_notes || v.deathNotes || null,
          physical_profile: v.physical_profile || v.physicalProfile || 'General',
          disability_category: v.disability_category || v.disabilityCategory || 'None',
          disability_percent: v.disability_percent !== undefined ? Number(v.disability_percent) : 0,
          eci_assistance_needed: v.eci_assistance_needed || v.eciAssistanceNeeded ? 1 : 0,
          economic_category: v.economic_category || v.economicCategory || 'APL',
          income_range: v.income_range || v.incomeRange || '₹15,000 - ₹30,000',
          land_ownership: v.land_ownership || v.landOwnership || 'Small Farmer',
          ration_card_type: v.ration_card_type || v.rationCardType || null,
          ration_card_no: v.ration_card_no || v.rationCardNo || null,
          housing_type: v.housing_type || v.housingType || null,
          reqUserId,
          reqUserName
        }
      ).catch(e => console.warn('Note on health_economy initial insert:', e));

      res.json(createdVoter);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Bulk Import Voters Endpoint
  app.post("/api/voters/bulk", authenticateUser, async (req, res) => {
    try {
      const userRole = (req as any).user?.role || 'volunteer';
      const isSuperAdmin = (req as any).user?.isSuperAdmin || (req as any).user?.role === 'superadmin' || (req as any).user?.role === 'admin';
      if (userRole === 'volunteer' && !isSuperAdmin) {
        return res.status(403).json({ 
          error: 'Karyakartas are not permitted to bulk upload voters. Only Managers and Admins can import voter lists.' 
        });
      }

      const voterList: any[] = req.body.voters || [];
      let inserted = 0;
      let updated = 0;

      for (const v of voterList) {
        const voterEpic = (v.voter_id || v.voterId || v.epic || v['EPIC No'] || '').trim().toUpperCase();
        if (!voterEpic) continue;

        const name = v.name || v['Voter Name'] || 'Unnamed Voter';
        const relationName = v.relation_name || v['Relative Name'] || v.relationName || '';
        const relationType = v.relation_type || v['Relation'] || v.relationType || 'Father';
        const gender = v.gender || v['Gender'] || 'Male';
        const age = parseInt(v.age || v['Age']) || 18;
        const mobile = v.mobile || v['Mobile'] || '';
        const houseNo = v.house_no || v['House No'] || v.houseNo || '';
        const wardName = v.ward_name || v['Ward Name'] || v.wardName || v.village || '';
        const village = v.village || wardName || '';
        const address = v.address || (houseNo ? `House No ${houseNo}, ${wardName}` : wardName);
        const partNo = v.part_no || v['Part No'] || v.partNo || '';
        const srNo = v.sr_no || v['Serial No'] || v.srNo || '';
        const caste = v.caste || v['Caste'] || 'General';
        const occupation = v.occupation || v['Occupation'] || 'Service';
        const isKaryakarta = (v.is_karyakarta || v['Is Karyakarta'] || v.isKaryakarta) ? 1 : 0;
        const votingStatus = v.voting_status || v['Voting Status'] || v.votingStatus || 'unvoted';
        const partyInclination = v.party_inclination || v['Favored Party'] || v.partyInclination || 'Neutral';
        const boothId = v.booth_id || v.boothId || null;
        const constituencyId = v.constituency_id || v.constituencyId || null;
        const stateId = v.state_id || v.stateId || null;
        const districtId = v.district_id || v.districtId || null;
        const mandalId = v.mandal_id || v.mandalId || null;
        const panchayatId = v.panchayat_id || v.panchayatId || null;
        const panchayatName = v.panchayat_name || v.panchayatName || null;
        const wardId = v.ward_id || v.wardId || null;

        // Check if voter with this voter_id (EPIC) exists
        const existingRows = await query<any>(`SELECT id FROM dbo.voters WHERE voter_id = @voterEpic`, { voterEpic });
        const existing = existingRows && existingRows.length > 0 ? existingRows[0] : null;
        if (existing && existing.id) {
          await execute(
            `UPDATE dbo.voters SET
              name = COALESCE(@name, name),
              relation_name = COALESCE(@relationName, relation_name),
              relation_type = COALESCE(@relationType, relation_type),
              gender = COALESCE(@gender, gender),
              age = COALESCE(@age, age),
              mobile = COALESCE(@mobile, mobile),
              house_no = COALESCE(@houseNo, house_no),
              village = COALESCE(@village, village),
              ward_name = COALESCE(@wardName, ward_name),
              ward_id = COALESCE(@wardId, ward_id),
              panchayat_id = COALESCE(@panchayatId, panchayat_id),
              panchayat_name = COALESCE(@panchayatName, panchayat_name),
              mandal_id = COALESCE(@mandalId, mandal_id),
              address = COALESCE(@address, address),
              part_no = COALESCE(@partNo, part_no),
              sr_no = COALESCE(@srNo, sr_no),
              caste = COALESCE(@caste, caste),
              occupation = COALESCE(@occupation, occupation),
              is_karyakarta = COALESCE(@isKaryakarta, is_karyakarta),
              voting_status = COALESCE(@votingStatus, voting_status),
              party_inclination = COALESCE(@partyInclination, party_inclination),
              booth_id = COALESCE(@boothId, booth_id),
              constituency_id = COALESCE(@constituencyId, constituency_id),
              state_id = COALESCE(@stateId, state_id),
              district_id = COALESCE(@districtId, district_id)
            WHERE id = @id`,
            {
              id: existing.id,
              name,
              relationName,
              relationType,
              gender,
              age,
              mobile,
              houseNo,
              village,
              wardName,
              wardId,
              panchayatId,
              panchayatName,
              mandalId,
              address,
              partNo,
              srNo,
              caste,
              occupation,
              isKaryakarta,
              votingStatus,
              partyInclination,
              boothId,
              constituencyId,
              stateId,
              districtId
            }
          );
          updated++;
        } else {
          await execute(
            `INSERT INTO dbo.voters (
              voter_id, name, relation_name, relation_type, gender, age, mobile, 
              house_no, village, ward_name, ward_id, panchayat_id, panchayat_name, mandal_id,
              address, part_no, sr_no, caste, occupation, 
              is_karyakarta, voting_status, party_inclination, booth_id, constituency_id, state_id, district_id
            ) VALUES (
              @voterEpic, @name, @relationName, @relationType, @gender, @age, @mobile,
              @houseNo, @village, @wardName, @wardId, @panchayatId, @panchayatName, @mandalId,
              @address, @partNo, @srNo, @caste, @occupation,
              @isKaryakarta, @votingStatus, @partyInclination, @boothId, @constituencyId, @stateId, @districtId
            )`,
            {
              voterEpic,
              name,
              relationName,
              relationType,
              gender,
              age,
              mobile,
              houseNo,
              village,
              wardName,
              wardId,
              panchayatId,
              panchayatName,
              mandalId,
              address,
              partNo,
              srNo,
              caste,
              occupation,
              isKaryakarta,
              votingStatus,
              partyInclination,
              boothId,
              constituencyId,
              stateId,
              districtId
            }
          );
          inserted++;
        }
      }

      res.json({ success: true, count: inserted + updated, inserted, updated, total: voterList.length });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Quick vital status update (e.g. mark Active / Deceased / Migrated)
  app.put("/api/voters/:id/status", authenticateUser, async (req, res) => {
    try {
      const { id } = req.params;
      const { vitalStatus, vital_status, deathDate, death_date, deathNotes, death_notes, newAddress, new_address } = req.body;
      const idParam = String(id);
      const vStatus = vitalStatus || vital_status || 'Active';
      const dDate = deathDate || death_date || null;
      const dNotes = deathNotes || death_notes || null;
      const nAddress = newAddress || new_address || null;
      const reqUserId = (req as any).user?.uid || (req as any).user?.email || 'admin';
      const reqUserName = (req as any).user?.name || (req as any).user?.username || 'Staff';

      await execute(
        `UPDATE dbo.voters SET
           vital_status = @vStatus,
           death_date = @dDate,
           death_notes = @dNotes,
           new_address = COALESCE(@nAddress, new_address),
           updated_at = SYSUTCDATETIME()
         WHERE id = @idParam OR voter_id = @idParam`,
        { idParam, vStatus, dDate, dNotes, nAddress }
      );

      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.voter_health_economy WHERE voter_doc_id = @idParam OR voter_epic = @idParam)
         BEGIN
           UPDATE dbo.voter_health_economy SET
             vital_status = @vStatus,
             death_date = @dDate,
             death_notes = @dNotes,
             recorded_by = @reqUserId,
             recorded_by_name = @reqUserName,
             updated_at = SYSUTCDATETIME()
           WHERE voter_doc_id = @idParam OR voter_epic = @idParam
         END
         ELSE
         BEGIN
           INSERT INTO dbo.voter_health_economy (
             voter_doc_id, voter_epic, vital_status, death_date, death_notes, recorded_by, recorded_by_name
           ) VALUES (
             @idParam, @idParam, @vStatus, @dDate, @dNotes, @reqUserId, @reqUserName
           )
         END`,
        { idParam, vStatus, dDate, dNotes, reqUserId, reqUserName }
      );

      res.json({ success: true, id: idParam, vitalStatus: vStatus, message: `Status updated to ${vStatus}` });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Get multi-admin assessments for a voter
  app.get("/api/voters/:id/assessments", optionalAuth, async (req, res) => {
    try {
      const voterDocId = String(req.params.id);
      const reqUser = (req as any).user;
      let isSuperAdmin = false;
      let effectiveAdminId = '';

      if (reqUser) {
        const info = await getRequesterInfo(reqUser);
        isSuperAdmin = info.isSuperAdmin;
        if (!isSuperAdmin && info.userRow) {
          effectiveAdminId = String(info.userRow.parent_admin_id || info.userRow.admin_id || info.userRow.id || info.reqUid);
        }
      }

      let sqlQuery = `
        SELECT 
           va.*,
           COALESCE(u.name, 'Admin (' + va.admin_id + ')') AS admin_name,
           u.email AS admin_email,
           u.role AS admin_role,
           COALESCE(va.recorded_by_name, rec.name, 'Staff') AS recorded_by_display_name,
           rec.email AS recorded_by_email,
           rec.role AS recorded_by_role
         FROM dbo.voter_assessments va
         LEFT JOIN dbo.users u ON CAST(va.admin_id AS NVARCHAR(64)) = CAST(u.id AS NVARCHAR(64))
         LEFT JOIN dbo.users rec ON CAST(va.recorded_by AS NVARCHAR(64)) = CAST(rec.id AS NVARCHAR(64))
         WHERE (va.voter_id = @voterDocId 
            OR va.voter_epic = @voterDocId
            OR va.id = @voterDocId
            OR va.id LIKE @likeDocId)
      `;
      const params: Record<string, any> = { voterDocId, likeDocId: `%_${voterDocId}` };

      // Non-super-admins can strictly only inspect their own admin's assessment
      if (!isSuperAdmin && effectiveAdminId) {
        sqlQuery += ` AND va.admin_id = @adminId`;
        params.adminId = effectiveAdminId;
      }

      sqlQuery += ` ORDER BY va.updated_at DESC`;
      const assessments = await query(sqlQuery, params);
      res.json(assessments);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Get multi-admin assessments (Scoped per admin for staff/managers/karyakartas, global/selectable for Super Admin)
  app.get("/api/voter-assessments", optionalAuth, async (req, res) => {
    try {
      const { voterId, voterDocId, adminId } = req.query;
      const targetVoter = String(voterId || voterDocId || '').trim();
      const reqUser = (req as any).user;

      let isSuperAdmin = false;
      let userRow = null;
      let effectiveAdminId = '';

      if (reqUser) {
        const info = await getRequesterInfo(reqUser);
        isSuperAdmin = info.isSuperAdmin;
        userRow = info.userRow;
        if (isSuperAdmin) {
          effectiveAdminId = String(adminId || '').trim();
        } else if (userRow?.role === 'admin') {
          effectiveAdminId = String(userRow.id || info.reqUid);
        } else {
          effectiveAdminId = String(userRow?.parent_admin_id || userRow?.admin_id || userRow?.id || info.reqUid);
        }
      } else {
        effectiveAdminId = String(adminId || '').trim();
      }

      let sqlQuery = `
        SELECT 
          va.*,
          COALESCE(u.name, 'Admin (' + va.admin_id + ')') AS admin_name,
          u.email AS admin_email,
          u.role AS admin_role,
          COALESCE(va.recorded_by_name, rec.name, 'Staff') AS recorded_by_display_name,
          rec.email AS recorded_by_email,
          rec.role AS recorded_by_role,
          v.voter_id AS voter_epic,
          COALESCE(v.name, va.voter_name) AS voter_full_name,
          v.gender AS voter_gender,
          v.age AS voter_age,
          v.mobile AS voter_mobile,
          v.village AS voter_village,
          v.house_no AS voter_house_no,
          v.booth_id AS voter_booth_id,
          v.booth_id AS booth_id,
          v.booth_id AS boothId,
          b.name AS booth_name,
          b.name AS boothName,
          b.booth_number,
          b.booth_number AS boothNumber,
          v.constituency_id AS voter_constituency_id,
          v.constituency_id AS constituency_id,
          v.constituency_id AS constituencyId,
          c.name AS constituency_name,
          c.name AS constituencyName,
          p.name AS party_name,
          COALESCE(va.party_color, p.color, '#3b82f6') AS effective_party_color,
          COALESCE(va.party_symbol, p.symbol, '🗳️') AS effective_party_symbol
        FROM dbo.voter_assessments va
        LEFT JOIN dbo.users u ON CAST(va.admin_id AS NVARCHAR(64)) = CAST(u.id AS NVARCHAR(64))
        LEFT JOIN dbo.users rec ON CAST(va.recorded_by AS NVARCHAR(64)) = CAST(rec.id AS NVARCHAR(64))
        LEFT JOIN dbo.voters v ON (CAST(va.voter_id AS NVARCHAR(64)) = CAST(v.id AS NVARCHAR(64)) OR va.voter_id = v.voter_id)
        LEFT JOIN dbo.booths b ON CAST(v.booth_id AS NVARCHAR(64)) = CAST(b.id AS NVARCHAR(64))
        LEFT JOIN dbo.constituencies c ON (CAST(v.constituency_id AS NVARCHAR(64)) = CAST(c.id AS NVARCHAR(64)) OR CAST(b.constituency_id AS NVARCHAR(64)) = CAST(c.id AS NVARCHAR(64)))
        LEFT JOIN dbo.parties p ON CAST(va.favored_party_id AS NVARCHAR(64)) = CAST(p.id AS NVARCHAR(64))
        WHERE 1=1
      `;
      const params: Record<string, any> = {};

      if (!isSuperAdmin) {
        if (effectiveAdminId) {
          sqlQuery += ` AND va.admin_id = @adminId`;
          params.adminId = effectiveAdminId;
        }
      } else {
        if (adminId && String(adminId).trim() !== '' && adminId !== 'all') {
          sqlQuery += ` AND va.admin_id = @adminId`;
          params.adminId = String(adminId).trim();
        }
      }

      if (targetVoter) {
        sqlQuery += ` AND (va.voter_id = @voterId OR va.voter_epic = @voterId OR va.id = @voterId OR va.id LIKE @likeDocId)`;
        params.voterId = targetVoter;
        params.likeDocId = `%_${targetVoter}`;
      }

      sqlQuery += ` ORDER BY va.updated_at DESC`;
      const assessments = await query(sqlQuery, params);
      res.json(assessments);
    } catch (error: any) {
      console.error('Error fetching voter assessments:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Create or Update single Admin Political Sentiment & Assessment Record
  app.post("/api/voter-assessments", authenticateUser, async (req, res) => {
    try {
      const a = req.body;
      const reqUser = (req as any).user;
      const { isSuperAdmin, userRow, reqUid } = await getRequesterInfo(reqUser);

      // Determine target admin role context:
      // 1. Super Admin: can act on behalf of any admin passed in payload
      // 2. Admin: acts on behalf of own admin ID
      // 3. Manager, Volunteer, Karyakarta: acts strictly on behalf of their parent admin
      let targetAdmin = '';
      if (isSuperAdmin) {
        targetAdmin = String(a.adminId || a.admin_id || reqUid).trim();
      } else if (userRow?.role === 'admin') {
        targetAdmin = String(userRow.id || reqUid).trim();
      } else {
        targetAdmin = String(userRow?.parent_admin_id || userRow?.admin_id || userRow?.id || reqUid).trim();
      }

      const voterDocId = String(a.voterId || a.voter_id || a.voterDocId || '').trim();
      if (!voterDocId) {
        return res.status(400).json({ error: "voterId or voterDocId is required" });
      }

      const assessmentId = `${targetAdmin}_${voterDocId}`;
      const sentimentStatus = a.sentiment || 'Neutral';
      const sentimentScore = a.sentimentScore !== undefined ? Number(a.sentimentScore) : (a.sentiment_score !== undefined ? Number(a.sentiment_score) : 3.0);
      const favoredPartyId = a.favoredPartyId || a.favored_party_id || null;
      const favoredPartyName = a.favoredPartyName || a.favored_party_name || null;
      const partyColor = a.partyColor || a.party_color || '#3b82f6';
      const partySymbol = a.partySymbol || a.party_symbol || '🗳️';
      const notes = a.notes || '';
      const isKaryakarta = (a.isKaryakarta || a.is_karyakarta) ? 1 : 0;
      const recordedBy = String(a.recordedBy || a.recorded_by || reqUid || 'Staff');
      const recordedByName = String(a.recordedByName || a.recorded_by_name || userRow?.name || reqUser?.name || 'Staff');
      const voterName = a.voterName || a.voter_name || null;
      const voterEpic = a.voterEpic || a.voter_epic || null;

      // Upsert into dbo.voter_assessments with exactly ONE record per (admin_id, voter_id)
      await execute(`
        IF EXISTS (SELECT 1 FROM dbo.voter_assessments WHERE id = @id OR (admin_id = @admin_id AND voter_id = @voter_id))
        BEGIN
          UPDATE dbo.voter_assessments SET
            voter_name = COALESCE(@voter_name, voter_name),
            voter_epic = COALESCE(@voter_epic, voter_epic),
            vital_status = COALESCE(@vital_status, vital_status),
            physical_profile = COALESCE(@physical_profile, physical_profile),
            disability_category = COALESCE(@disability_category, disability_category),
            eci_assistance_needed = COALESCE(@eci_assistance_needed, eci_assistance_needed),
            economic_category = COALESCE(@economic_category, economic_category),
            income_range = COALESCE(@income_range, income_range),
            land_ownership = COALESCE(@land_ownership, land_ownership),
            education = COALESCE(@education, education),
            sentiment = @sentiment,
            sentiment_score = @sentiment_score,
            favored_party_id = @favored_party_id,
            favored_party_name = @favored_party_name,
            party_color = @party_color,
            party_symbol = @party_symbol,
            notes = @notes,
            is_karyakarta = @is_karyakarta,
            recorded_by = @recorded_by,
            recorded_by_name = @recorded_by_name,
            updated_at = SYSUTCDATETIME()
          WHERE id = @id OR (admin_id = @admin_id AND voter_id = @voter_id);
        END
        ELSE
        BEGIN
          INSERT INTO dbo.voter_assessments (
            id, admin_id, voter_id, voter_epic, voter_name,
            vital_status, physical_profile, disability_category, eci_assistance_needed,
            economic_category, income_range, land_ownership, education,
            sentiment, sentiment_score, favored_party_id, favored_party_name,
            party_color, party_symbol, notes, is_karyakarta,
            recorded_by, recorded_by_name, created_at, updated_at
          ) VALUES (
            @id, @admin_id, @voter_id, @voter_epic, @voter_name,
            @vital_status, @physical_profile, @disability_category, @eci_assistance_needed,
            @economic_category, @income_range, @land_ownership, @education,
            @sentiment, @sentiment_score, @favored_party_id, @favored_party_name,
            @party_color, @party_symbol, @notes, @is_karyakarta,
            @recorded_by, @recorded_by_name, SYSUTCDATETIME(), SYSUTCDATETIME()
          );
        END
      `, {
        id: assessmentId,
        admin_id: targetAdmin,
        voter_id: voterDocId,
        voter_epic: voterEpic,
        voter_name: voterName,
        vital_status: a.vitalStatus || a.vital_status || 'Active',
        physical_profile: a.physicalProfile || a.physical_profile || 'General',
        disability_category: a.disabilityCategory || a.disability_category || 'None',
        eci_assistance_needed: a.eciAssistanceNeeded ? 1 : 0,
        economic_category: a.economicCategory || a.economic_category || 'APL',
        income_range: a.incomeRange || a.income_range || '₹15,000 - ₹30,000',
        land_ownership: a.landOwnership || a.land_ownership || 'Small Farmer',
        education: a.education || 'Unspecified',
        sentiment: sentimentStatus,
        sentiment_score: sentimentScore,
        favored_party_id: favoredPartyId,
        favored_party_name: favoredPartyName,
        party_color: partyColor,
        party_symbol: partySymbol,
        notes: notes,
        is_karyakarta: isKaryakarta,
        recorded_by: recordedBy,
        recorded_by_name: recordedByName
      });

      // Synchronize with dbo.voter_sentiments with admin_id preservation
      try {
        await execute(`
          IF EXISTS (SELECT 1 FROM dbo.voter_sentiments WHERE admin_id = @admin_id AND (voter_id = @voter_id OR voter_id = @voter_epic) AND (survey_id IS NULL OR survey_id = ''))
          BEGIN
            UPDATE dbo.voter_sentiments SET
              favored_party_id = COALESCE(@favored_party_id, favored_party_id),
              favored_party_name = COALESCE(@favored_party_name, favored_party_name),
              sentiment_score = @sentiment_score,
              party_color = @party_color,
              party_symbol = @party_symbol,
              notes = @notes,
              is_karyakarta = @is_karyakarta,
              recorded_by = @recorded_by,
              recorded_by_name = @recorded_by_name
            WHERE admin_id = @admin_id AND (voter_id = @voter_id OR voter_id = @voter_epic) AND (survey_id IS NULL OR survey_id = '');
          END
          ELSE
          BEGIN
            INSERT INTO dbo.voter_sentiments (
              voter_id, voter_name, election_id, election_year,
              favored_party_id, favored_party_name, sentiment_score,
              party_color, party_symbol, notes, is_karyakarta,
              admin_id, recorded_by, recorded_by_name, created_at
            ) VALUES (
              @voter_id, COALESCE(@voter_name, 'Voter'), '1', 2026,
              COALESCE(@favored_party_id, 'none'), COALESCE(@favored_party_name, 'Undecided'), @sentiment_score,
              @party_color, @party_symbol, @notes, @is_karyakarta,
              @admin_id, @recorded_by, @recorded_by_name, SYSUTCDATETIME()
            );
          END
        `, {
          admin_id: targetAdmin,
          voter_id: voterDocId,
          voter_epic: voterEpic,
          voter_name: voterName,
          favored_party_id: favoredPartyId,
          favored_party_name: favoredPartyName,
          sentiment_score: sentimentScore,
          party_color: partyColor,
          party_symbol: partySymbol,
          notes: notes,
          is_karyakarta: isKaryakarta,
          recorded_by: recordedBy,
          recorded_by_name: recordedByName
        });
      } catch (syncErr) {
        console.warn('Note on voter_sentiments sync:', syncErr);
      }

      res.json({
        success: true,
        id: assessmentId,
        adminId: targetAdmin,
        voterId: voterDocId,
        sentiment: sentimentStatus,
        sentimentScore,
        favoredPartyId,
        favoredPartyName,
        partyColor,
        partySymbol,
        notes,
        isKaryakarta: Boolean(isKaryakarta),
        recordedBy,
        recordedByName
      });
    } catch (error: any) {
      console.error('Error saving voter assessment:', error);
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // ============================================================================
  // Broadcast Feed Links & WhatsApp Extension Feed
  // ============================================================================
  const inMemoryBroadcastLinks = new Map<string, any>();

  async function ensureBroadcastTable() {
    try {
      await execute(`
        IF NOT EXISTS (SELECT * FROM sys.tables WHERE name = 'broadcast_feed_links')
        BEGIN
          CREATE TABLE dbo.broadcast_feed_links (
            id NVARCHAR(64) PRIMARY KEY,
            token NVARCHAR(128) NOT NULL UNIQUE,
            title NVARCHAR(255) NOT NULL,
            filter_criteria NVARCHAR(MAX) NOT NULL,
            columns NVARCHAR(MAX) NOT NULL,
            expiry_hours INT DEFAULT 24,
            expires_at DATETIME2 NULL,
            created_by NVARCHAR(128) NULL,
            created_at DATETIME2 DEFAULT SYSUTCDATETIME()
          );
        END
      `);
    } catch (e) {
      console.warn('Note on broadcast_feed_links table check:', e);
    }
  }

  // Create new Broadcast Feed Link
  app.post("/api/broadcast-links", authenticateUser, async (req, res) => {
    try {
      await ensureBroadcastTable();
      const { title, filterCriteria, columns, expiryHours = 24 } = req.body;
      const user = (req as any).user;
      const createdBy = user?.uid || user?.email || 'admin';
      const id = `bfl_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
      const token = `wa_${Math.random().toString(36).substring(2, 10)}${Math.random().toString(36).substring(2, 8)}`;
      
      const expHoursNum = parseInt(String(expiryHours), 10);
      let expiresAt: Date | null = null;
      if (expHoursNum > 0) {
        expiresAt = new Date(Date.now() + expHoursNum * 3600000);
      }

      const linkRecord = {
        id,
        token,
        title: title || 'WhatsApp Voter Broadcast',
        filter_criteria: typeof filterCriteria === 'string' ? filterCriteria : JSON.stringify(filterCriteria || {}),
        columns: typeof columns === 'string' ? columns : JSON.stringify(columns || ['phone', 'name', 'relation_name', 'relation_type', 'epic_no', 'house_no', 'ward_name']),
        expiry_hours: expHoursNum,
        expires_at: expiresAt ? expiresAt.toISOString() : null,
        created_by: createdBy,
        created_at: new Date().toISOString()
      };

      inMemoryBroadcastLinks.set(token, linkRecord);
      inMemoryBroadcastLinks.set(id, linkRecord);

      try {
        await execute(
          `INSERT INTO dbo.broadcast_feed_links (id, token, title, filter_criteria, columns, expiry_hours, expires_at, created_by, created_at)
           VALUES (@id, @token, @title, @filter_criteria, @columns, @expiry_hours, @expires_at, @created_by, SYSUTCDATETIME())`,
          {
            id,
            token,
            title: linkRecord.title,
            filter_criteria: linkRecord.filter_criteria,
            columns: linkRecord.columns,
            expiry_hours: linkRecord.expiry_hours,
            expires_at: expiresAt,
            created_by: linkRecord.created_by
          }
        );
      } catch (dbErr) {
        console.warn('DB insert fallback for broadcast link:', dbErr);
      }

      res.json({
        success: true,
        id,
        token,
        title: linkRecord.title,
        expiresAt: linkRecord.expires_at,
        url: `/broadcast-feed/${token}`
      });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Get active broadcast links for user
  app.get("/api/broadcast-links", authenticateUser, async (req, res) => {
    try {
      await ensureBroadcastTable();
      let links: any[] = [];
      try {
        links = await query(
          `SELECT * FROM dbo.broadcast_feed_links ORDER BY created_at DESC`
        );
      } catch (err) {
        links = Array.from(inMemoryBroadcastLinks.values()).filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      }

      const activeLinks = links.map(l => {
        const isExpired = l.expires_at ? new Date(l.expires_at).getTime() < Date.now() : false;
        return {
          id: l.id,
          token: l.token,
          title: l.title,
          filterCriteria: typeof l.filter_criteria === 'string' ? JSON.parse(l.filter_criteria || '{}') : l.filter_criteria,
          columns: typeof l.columns === 'string' ? JSON.parse(l.columns || '[]') : l.columns,
          expiryHours: l.expiry_hours,
          expiresAt: l.expires_at,
          isExpired,
          createdAt: l.created_at,
          createdBy: l.created_by
        };
      });

      res.json(activeLinks);
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Revoke/Delete broadcast link
  app.delete("/api/broadcast-links/:idOrToken", authenticateUser, async (req, res) => {
    try {
      const { idOrToken } = req.params;
      inMemoryBroadcastLinks.delete(idOrToken);
      try {
        await execute(
          `DELETE FROM dbo.broadcast_feed_links WHERE id = @idOrToken OR token = @idOrToken`,
          { idOrToken }
        );
      } catch (err) {}
      res.json({ success: true, message: 'Broadcast link revoked successfully.' });
    } catch (error: any) {
      res.status(500).json({ error: sanitizeError(error) });
    }
  });

  // Resolve Public Broadcast Feed for Extension / Webpage
  app.get("/api/broadcast-feed/:token", optionalAuth, async (req, res) => {
    try {
      const { token } = req.params;
      let link: any = inMemoryBroadcastLinks.get(token);

      if (!link) {
        await ensureBroadcastTable();
        try {
          const rows = await query<any>(
            `SELECT * FROM dbo.broadcast_feed_links WHERE token = @token`,
            { token }
          );
          if (rows && rows.length > 0) link = rows[0];
        } catch (err) {}
      }

      if (!link) {
        return res.status(404).json({ error: 'Broadcast feed link not found or invalid token.' });
      }

      if (link.expires_at && new Date(link.expires_at).getTime() < Date.now()) {
        return res.status(410).json({ error: 'This broadcast link has expired.' });
      }

      const filters = typeof link.filter_criteria === 'string' ? JSON.parse(link.filter_criteria || '{}') : (link.filter_criteria || {});
      const selectedColumns: string[] = typeof link.columns === 'string' ? JSON.parse(link.columns || '[]') : (link.columns || []);

      // Build WHERE conditions matching the filter criteria
      const whereConditions: string[] = ["v.mobile IS NOT NULL AND LEN(TRIM(v.mobile)) >= 8"];
      const params: Record<string, any> = {};

      if (filters.stateIds && filters.stateIds.length > 0) {
        const clause = buildSafeInClause(filters.stateIds.join(','), 'bf_st', ['v.state_id', 'b.state_id', 'c.state_id'], params);
        if (clause) whereConditions.push(clause);
      }
      if (filters.districtIds && filters.districtIds.length > 0) {
        const clause = buildSafeInClause(filters.districtIds.join(','), 'bf_dt', ['v.district_id', 'b.district_id', 'c.district_id'], params);
        if (clause) whereConditions.push(clause);
      }
      if (filters.constituencyIds && filters.constituencyIds.length > 0) {
        const clause = buildSafeInClause(filters.constituencyIds.join(','), 'bf_cn', ['v.constituency_id', 'b.constituency_id', 'm.constituency_id'], params);
        if (clause) whereConditions.push(clause);
      }
      if (filters.mandalIds && filters.mandalIds.length > 0) {
        const clause = buildSafeInClause(filters.mandalIds.join(','), 'bf_mn', ['v.mandal_id', 'b.mandal_id'], params);
        if (clause) whereConditions.push(clause);
      }
      if (filters.panchayatIds && filters.panchayatIds.length > 0) {
        const clause = buildSafeInClause(filters.panchayatIds.join(','), 'bf_pn', ['v.panchayat_id', 'b.panchayat_id'], params);
        if (clause) whereConditions.push(clause);
      }
      if (filters.wardIds && filters.wardIds.length > 0) {
        const clause = buildSafeInClause(filters.wardIds.join(','), 'bf_wd', ['v.ward_id', 'b.ward_id'], params);
        if (clause) whereConditions.push(clause);
      }
      if (filters.boothIds && filters.boothIds.length > 0) {
        const clause = buildSafeInClause(filters.boothIds.join(','), 'bf_bt', ['v.booth_id'], params);
        if (clause) whereConditions.push(clause);
      }

      if (filters.gender && filters.gender !== 'all') {
        whereConditions.push("LOWER(v.gender) = LOWER(@bf_gender)");
        params.bf_gender = filters.gender;
      }
      if (filters.caste && filters.caste !== 'all') {
        whereConditions.push("LOWER(v.caste) = LOWER(@bf_caste)");
        params.bf_caste = filters.caste;
      }
      if (filters.vitalStatus && filters.vitalStatus !== 'all') {
        whereConditions.push("LOWER(COALESCE(v.vital_status, 'active')) = LOWER(@bf_vital)");
        params.bf_vital = filters.vitalStatus;
      }
      if (filters.sentiment && filters.sentiment !== 'all') {
        whereConditions.push("LOWER(COALESCE(v.party_inclination, 'neutral')) = LOWER(@bf_sentiment)");
        params.bf_sentiment = filters.sentiment;
      }
      if (filters.isKaryakarta && filters.isKaryakarta !== 'all') {
        whereConditions.push(filters.isKaryakarta === 'yes' ? "v.is_karyakarta = 1" : "(v.is_karyakarta = 0 OR v.is_karyakarta IS NULL)");
      }
      if (filters.search && String(filters.search).trim()) {
        whereConditions.push("(v.name LIKE @bf_search OR v.voter_id LIKE @bf_search OR v.mobile LIKE @bf_search OR v.house_no LIKE @bf_search OR v.village LIKE @bf_search)");
        params.bf_search = `%${String(filters.search).trim()}%`;
      }

      const whereSql = whereConditions.join(" AND ");

      const voters = await query<any>(`
        SELECT 
          v.id,
          v.voter_id,
          v.name,
          v.relation_name,
          v.relation_type,
          v.gender,
          v.age,
          v.mobile,
          v.additional_mobile,
          v.house_no,
          COALESCE(v.ward_name, v.village) AS ward_name,
          v.village,
          v.address,
          v.part_no,
          v.sr_no,
          v.caste,
          v.occupation,
          v.voting_status,
          v.party_inclination,
          v.is_karyakarta,
          b.name AS booth_name,
          b.booth_number,
          c.name AS constituency_name
        FROM dbo.voters v
        LEFT JOIN dbo.booths b ON v.booth_id = b.id
        LEFT JOIN dbo.wards w ON v.ward_id = w.id OR b.ward_id = w.id
        LEFT JOIN dbo.panchayats p ON v.panchayat_id = p.id OR b.panchayat_id = p.id OR w.panchayat_id = p.id
        LEFT JOIN dbo.mandals m ON v.mandal_id = m.id OR b.mandal_id = m.id OR p.mandal_id = m.id
        LEFT JOIN dbo.constituencies c ON v.constituency_id = c.id OR b.constituency_id = c.id OR m.constituency_id = c.id
        LEFT JOIN dbo.districts d ON v.district_id = d.id OR c.district_id = d.id
        LEFT JOIN dbo.states s ON v.state_id = s.id OR c.state_id = s.id OR d.state_id = s.id
        WHERE ${whereSql}
        ORDER BY v.name ASC
      `, params);

      // Clean, format, and structure records specifically for WhatsApp extension automation
      const recipients = voters.map(v => {
        let cleanPhone = String(v.mobile || '').replace(/\D/g, '');
        if (cleanPhone.length === 10) cleanPhone = `91${cleanPhone}`;
        else if (cleanPhone.length > 10 && cleanPhone.startsWith('0')) cleanPhone = `91${cleanPhone.substring(1)}`;

        return {
          phone: cleanPhone,
          name: v.name || '',
          relation_name: v.relation_name || '',
          relation_type: v.relation_type || 'Father',
          epic_no: v.voter_id || '',
          house_no: v.house_no || '',
          ward_name: v.ward_name || v.village || '',
          booth_name: v.booth_name ? `${v.booth_number ? `#${v.booth_number} ` : ''}${v.booth_name}` : '',
          age: v.age || '',
          gender: v.gender || '',
          caste: v.caste || '',
          part_no: v.part_no || '',
          sr_no: v.sr_no || '',
          occupation: v.occupation || '',
          voting_status: v.voting_status || 'unvoted',
          party_inclination: v.party_inclination || 'Neutral',
          is_karyakarta: v.is_karyakarta === 1 ? 'Yes' : 'No'
        };
      }).filter(r => r.phone && r.phone.length >= 10);

      res.json({
        success: true,
        title: link.title,
        token,
        totalCount: recipients.length,
        columns: selectedColumns.length > 0 ? selectedColumns : ['phone', 'name', 'relation_name', 'relation_type', 'epic_no', 'house_no', 'ward_name'],
        expiresAt: link.expires_at,
        createdAt: link.created_at,
        recipients
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
      const reqUser = (req as any).user;
      const info = await getRequesterInfo(reqUser);
      const reqUserId = info.reqUid || reqUser?.uid || 'admin';
      const reqUserName = info.userRow?.name || reqUser?.name || reqUser?.username || 'Staff';

      let targetAdmin = '';
      if (info.isSuperAdmin) {
        targetAdmin = String(v.adminId || v.admin_id || reqUserId).trim();
      } else if (info.userRow?.role === 'admin') {
        targetAdmin = String(info.userRow.id || reqUserId).trim();
      } else {
        targetAdmin = String(info.userRow?.parent_admin_id || info.userRow?.admin_id || info.userRow?.id || reqUserId).trim();
      }

      await execute(
        `UPDATE dbo.voters 
         SET name = COALESCE(@name, name),
             relation_name = COALESCE(@relation_name, relation_name),
             relation_type = COALESCE(@relation_type, relation_type),
             aadhar_number = COALESCE(@aadhar_number, aadhar_number),
             gender = COALESCE(@gender, gender),
             age = COALESCE(@age, age),
             dob = COALESCE(@dob, dob),
             mobile = COALESCE(@mobile, mobile),
             additional_mobile = COALESCE(@additional_mobile, additional_mobile),
             email = COALESCE(@email, email),
             address = COALESCE(@address, address),
             new_address = COALESCE(@new_address, new_address),
             house_no = COALESCE(@house_no, house_no),
             village = COALESCE(@village, village),
             caste = COALESCE(@caste, caste),
             occupation = COALESCE(@occupation, occupation),
             education = COALESCE(@education, education),
             is_karyakarta = COALESCE(@is_karyakarta, is_karyakarta),
             voting_status = COALESCE(@voting_status, voting_status),
             party_inclination = COALESCE(@party_inclination, party_inclination),
             booth_id = COALESCE(@booth_id, booth_id),
             ward_id = COALESCE(@ward_id, ward_id),
             ward_name = COALESCE(@ward_name, ward_name),
             panchayat_id = COALESCE(@panchayat_id, panchayat_id),
             panchayat_name = COALESCE(@panchayat_name, panchayat_name),
             mandal_id = COALESCE(@mandal_id, mandal_id),
             constituency_id = COALESCE(@constituency_id, constituency_id),
             vital_status = COALESCE(@vital_status, vital_status),
             death_date = COALESCE(@death_date, death_date),
             death_notes = COALESCE(@death_notes, death_notes),
             physical_profile = COALESCE(@physical_profile, physical_profile),
             disability_category = COALESCE(@disability_category, disability_category),
             disability_percent = COALESCE(@disability_percent, disability_percent),
             eci_assistance_needed = COALESCE(@eci_assistance_needed, eci_assistance_needed),
             economic_category = COALESCE(@economic_category, economic_category),
             income_range = COALESCE(@income_range, income_range),
             land_ownership = COALESCE(@land_ownership, land_ownership),
             ration_card_type = COALESCE(@ration_card_type, ration_card_type),
             ration_card_no = COALESCE(@ration_card_no, ration_card_no),
             housing_type = COALESCE(@housing_type, housing_type),
             updated_at = SYSUTCDATETIME()
         WHERE voter_id = @idParam OR CAST(id AS VARCHAR(64)) = @idParam`,
        {
          idParam,
          name: v.name,
          relation_name: v.relation_name || v.relationName,
          relation_type: v.relation_type || v.relationType,
          aadhar_number: v.aadhar_number || v.aadharNumber || null,
          gender: v.gender,
          age: v.age !== undefined && v.age !== null && v.age !== '' ? parseInt(String(v.age), 10) : null,
          dob: v.dob || null,
          mobile: v.mobile,
          additional_mobile: v.additional_mobile || v.additionalMobile || null,
          email: v.email,
          address: v.address,
          new_address: v.new_address || v.newAddress || null,
          house_no: v.house_no || v.houseNo,
          village: v.village,
          caste: v.caste,
          occupation: v.occupation,
          education: v.education || null,
          is_karyakarta: v.is_karyakarta !== undefined ? (v.is_karyakarta ? 1 : 0) : (v.isKaryakarta !== undefined ? (v.isKaryakarta ? 1 : 0) : null),
          voting_status: v.voting_status || (v.voted !== undefined ? (v.voted ? 'voted' : 'unvoted') : null),
          party_inclination: v.party_inclination || v.partyInclination,
          booth_id: v.booth_id ? String(v.booth_id) : (v.boothId ? String(v.boothId) : null),
          ward_id: v.ward_id ? String(v.ward_id) : (v.wardId ? String(v.wardId) : null),
          ward_name: v.ward_name || v.wardName || null,
          panchayat_id: v.panchayat_id ? String(v.panchayat_id) : (v.panchayatId ? String(v.panchayatId) : null),
          panchayat_name: v.panchayat_name || v.panchayatName || null,
          mandal_id: v.mandal_id ? String(v.mandal_id) : (v.mandalId ? String(v.mandalId) : null),
          constituency_id: v.constituency_id ? String(v.constituency_id) : (v.constituencyId ? String(v.constituencyId) : null),
          vital_status: v.vital_status || v.vitalStatus || null,
          death_date: v.death_date || v.deathDate || null,
          death_notes: v.death_notes || v.deathNotes || null,
          physical_profile: v.physical_profile || v.physicalProfile || null,
          disability_category: v.disability_category || v.disabilityCategory || null,
          disability_percent: v.disability_percent !== undefined ? Number(v.disability_percent) : (v.disabilityPercent !== undefined ? Number(v.disabilityPercent) : null),
          eci_assistance_needed: v.eci_assistance_needed !== undefined ? (v.eci_assistance_needed ? 1 : 0) : (v.eciAssistanceNeeded !== undefined ? (v.eciAssistanceNeeded ? 1 : 0) : null),
          economic_category: v.economic_category || v.economicCategory || null,
          income_range: v.income_range || v.incomeRange || null,
          land_ownership: v.land_ownership || v.landOwnership || null,
          ration_card_type: v.ration_card_type || v.rationCardType || null,
          ration_card_no: v.ration_card_no || v.rationCardNo || null,
          housing_type: v.housing_type || v.housingType || null
        }
      );

      // Upsert into dedicated dbo.voter_health_economy table
      const voterEpicVal = v.voter_id || v.voterId || idParam;
      const aadharVal = v.aadhar_number || v.aadharNumber || null;
      await execute(
        `IF EXISTS (SELECT 1 FROM dbo.voter_health_economy WHERE voter_doc_id = @idParam OR voter_epic = @voterEpicVal)
         BEGIN
           UPDATE dbo.voter_health_economy SET
             voter_epic = @voterEpicVal,
             aadhar_number = COALESCE(@aadharVal, aadhar_number),
             vital_status = COALESCE(@vital_status, vital_status),
             death_date = COALESCE(@death_date, death_date),
             death_notes = COALESCE(@death_notes, death_notes),
             physical_profile = COALESCE(@physical_profile, physical_profile),
             disability_category = COALESCE(@disability_category, disability_category),
             disability_percent = COALESCE(@disability_percent, disability_percent),
             eci_assistance_needed = COALESCE(@eci_assistance_needed, eci_assistance_needed),
             economic_category = COALESCE(@economic_category, economic_category),
             income_range = COALESCE(@income_range, income_range),
             land_ownership = COALESCE(@land_ownership, land_ownership),
             ration_card_type = COALESCE(@ration_card_type, ration_card_type),
             ration_card_no = COALESCE(@ration_card_no, ration_card_no),
             housing_type = COALESCE(@housing_type, housing_type),
             recorded_by = @reqUserId,
             recorded_by_name = @reqUserName,
             updated_at = SYSUTCDATETIME()
           WHERE voter_doc_id = @idParam OR voter_epic = @voterEpicVal
         END
         ELSE
         BEGIN
           INSERT INTO dbo.voter_health_economy (
             voter_doc_id, voter_epic, aadhar_number, vital_status, death_date, death_notes,
             physical_profile, disability_category, disability_percent, eci_assistance_needed,
             economic_category, income_range, land_ownership, ration_card_type, ration_card_no, housing_type,
             recorded_by, recorded_by_name
           ) VALUES (
             @idParam, @voterEpicVal, @aadharVal, @vital_status, @death_date, @death_notes,
             @physical_profile, @disability_category, @disability_percent, @eci_assistance_needed,
             @economic_category, @income_range, @land_ownership, @ration_card_type, @ration_card_no, @housing_type,
             @reqUserId, @reqUserName
           )
         END`,
        {
          idParam,
          voterEpicVal,
          aadharVal,
          vital_status: v.vital_status || v.vitalStatus || 'Active',
          death_date: v.death_date || v.deathDate || null,
          death_notes: v.death_notes || v.deathNotes || null,
          physical_profile: v.physical_profile || v.physicalProfile || 'General',
          disability_category: v.disability_category || v.disabilityCategory || 'None',
          disability_percent: v.disability_percent !== undefined ? Number(v.disability_percent) : (v.disabilityPercent !== undefined ? Number(v.disabilityPercent) : 0),
          eci_assistance_needed: v.eci_assistance_needed !== undefined ? (v.eci_assistance_needed ? 1 : 0) : (v.eciAssistanceNeeded !== undefined ? (v.eciAssistanceNeeded ? 1 : 0) : 0),
          economic_category: v.economic_category || v.economicCategory || 'APL',
          income_range: v.income_range || v.incomeRange || '₹15,000 - ₹30,000',
          land_ownership: v.land_ownership || v.landOwnership || 'Small Farmer',
          ration_card_type: v.ration_card_type || v.rationCardType || null,
          ration_card_no: v.ration_card_no || v.rationCardNo || null,
          housing_type: v.housing_type || v.housingType || null,
          reqUserId,
          reqUserName
        }
      );

      // If assessment / sentiment fields are present, upsert into dbo.voter_assessments
      if (v.adminId || v.sentiment || v.sentimentScore !== undefined || v.notes) {
        const assessmentAdmin = targetAdmin || String(v.adminId || v.admin_id || reqUserId);
        const assessmentId = `${assessmentAdmin}_${idParam}`;
        await execute(
          `IF EXISTS (SELECT 1 FROM dbo.voter_assessments WHERE id = @assessmentId OR (admin_id = @targetAdmin AND voter_id = @idParam))
           BEGIN
             UPDATE dbo.voter_assessments SET
               vital_status = COALESCE(@vital_status, vital_status),
               physical_profile = COALESCE(@physical_profile, physical_profile),
               disability_category = COALESCE(@disability_category, disability_category),
               eci_assistance_needed = COALESCE(@eci_assistance_needed, eci_assistance_needed),
               economic_category = COALESCE(@economic_category, economic_category),
               income_range = COALESCE(@income_range, income_range),
               land_ownership = COALESCE(@land_ownership, land_ownership),
               education = COALESCE(@education, education),
               sentiment_score = COALESCE(@sentiment_score, sentiment_score),
               sentiment = COALESCE(@sentiment, sentiment),
               favored_party_id = COALESCE(@favored_party_id, favored_party_id),
               favored_party_name = COALESCE(@favored_party_name, favored_party_name),
               notes = COALESCE(@notes, notes),
               is_karyakarta = COALESCE(@is_karyakarta, is_karyakarta),
               voted = COALESCE(@voted, voted),
               recorded_by = @reqUserId,
               recorded_by_name = @reqUserName,
               updated_at = SYSUTCDATETIME()
             WHERE id = @assessmentId OR (admin_id = @targetAdmin AND voter_id = @idParam)
           END
           ELSE
           BEGIN
             INSERT INTO dbo.voter_assessments (
               id, admin_id, voter_id, voter_epic, aadhar_number, voter_name,
               vital_status, physical_profile, disability_category, eci_assistance_needed,
               economic_category, income_range, land_ownership, education,
               sentiment_score, sentiment, favored_party_id, favored_party_name, notes,
               is_karyakarta, voted, recorded_by, recorded_by_name
             ) VALUES (
               @assessmentId, @targetAdmin, @idParam, @voterEpicVal, @aadharVal, @name,
               @vital_status, @physical_profile, @disability_category, @eci_assistance_needed,
               @economic_category, @income_range, @land_ownership, @education,
               @sentiment_score, @sentiment, @favored_party_id, @favored_party_name, @notes,
               @is_karyakarta, @voted, @reqUserId, @reqUserName
             )
           END`,
          {
            assessmentId,
            targetAdmin: assessmentAdmin,
            idParam,
            voterEpicVal,
            aadharVal,
            name: v.name || '',
            vital_status: v.vital_status || v.vitalStatus || 'Active',
            physical_profile: v.physical_profile || v.physicalProfile || 'General',
            disability_category: v.disability_category || v.disabilityCategory || 'None',
            eci_assistance_needed: v.eci_assistance_needed !== undefined ? (v.eci_assistance_needed ? 1 : 0) : 0,
            economic_category: v.economic_category || v.economicCategory || 'APL',
            income_range: v.income_range || v.incomeRange || '₹15,000 - ₹30,000',
            land_ownership: v.land_ownership || v.landOwnership || 'Small Farmer',
            education: v.education || 'Unspecified',
            sentiment_score: v.sentimentScore !== undefined ? Number(v.sentimentScore) : 3.0,
            sentiment: v.sentiment || v.party_inclination || v.partyInclination || 'Neutral',
            favored_party_id: v.favoredPartyId || v.favored_party_id || null,
            favored_party_name: v.favoredPartyName || v.favored_party_name || null,
            notes: v.notes !== undefined ? v.notes : null,
            is_karyakarta: v.isKaryakarta !== undefined ? (v.isKaryakarta ? 1 : 0) : (v.is_karyakarta ? 1 : 0),
            voted: v.voted !== undefined ? (v.voted ? 1 : 0) : (v.voting_status === 'voted' ? 1 : 0),
            reqUserId,
            reqUserName
          }
        ).catch(e => console.warn('Note on assessment update:', e));
      }

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
        await execute(`DELETE FROM dbo.voter_health_economy WHERE voter_doc_id = @voterId OR voter_epic IN (SELECT voter_id FROM dbo.voters WHERE id = @numId)`, { voterId: voterIdParam, numId: Number(voterIdParam) });
        await execute(`DELETE FROM dbo.voter_assessments WHERE voter_id = @voterId OR voter_epic IN (SELECT voter_id FROM dbo.voters WHERE id = @numId)`, { voterId: voterIdParam, numId: Number(voterIdParam) });
        await execute(`DELETE FROM dbo.voter_sentiments WHERE voter_id = @voterId OR voter_id IN (SELECT voter_id FROM dbo.voters WHERE id = @numId)`, { voterId: voterIdParam, numId: Number(voterIdParam) });
        await execute(`DELETE FROM dbo.benefits WHERE voter_doc_id = @voterId OR voter_id = @voterId`, { voterId: voterIdParam });
        await execute(`DELETE FROM dbo.volunteers WHERE voter_doc_id = @voterId OR voter_id = @voterId`, { voterId: voterIdParam });
        await execute(`DELETE FROM dbo.voters WHERE id = @numId`, { numId: Number(voterIdParam) });
      } else {
        await execute(`DELETE FROM dbo.voter_health_economy WHERE voter_doc_id = @voterId OR voter_epic = @voterId`, { voterId: voterIdParam });
        await execute(`DELETE FROM dbo.voter_assessments WHERE voter_id = @voterId OR voter_epic = @voterId`, { voterId: voterIdParam });
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
      const { voterId, voter_id, voterDocId, voter_doc_id, boothId, booth_id, mandalId, mandal_id, adminId } = req.query;
      const targetVoterId = String(voterId || voter_id || '').trim();
      const targetVoterDocId = String(voterDocId || voter_doc_id || '').trim();
      const targetBoothId = String(boothId || booth_id || '').trim();
      const targetMandalId = String(mandalId || mandal_id || '').trim();
      const targetAdminId = String(adminId || '').trim();

      let sqlQuery = `
        SELECT b.*,
               v.mobile as voter_mobile,
               v.is_karyakarta as is_karyakarta,
               COALESCE(v.booth_id, '') as booth_id,
               COALESCE(booth.booth_number, '') as booth_number,
               COALESCE(booth.name, '') as booth_name,
               COALESCE(v.mandal_id, booth.mandal_id, '') as mandal_id,
               COALESCE(m.name, '') as mandal_name
        FROM dbo.benefits b
        LEFT JOIN dbo.voters v ON (CAST(b.voter_doc_id AS NVARCHAR(100)) = CAST(v.id AS NVARCHAR(100)) OR b.voter_id = v.voter_id)
        LEFT JOIN dbo.booths booth ON (v.booth_id = CAST(booth.id AS NVARCHAR(100)) OR v.booth_id = booth.booth_number)
        LEFT JOIN dbo.mandals m ON (v.mandal_id = CAST(m.id AS NVARCHAR(100)) OR booth.mandal_id = CAST(m.id AS NVARCHAR(100)))
        WHERE 1=1
      `;
      const params: Record<string, any> = {};

      if (targetAdminId && targetAdminId !== 'All') {
        sqlQuery += ` AND b.admin_id = @adminId`;
        params.adminId = targetAdminId;
      }
      if (targetVoterId) {
        sqlQuery += ` AND (b.voter_id = @voterId OR v.voter_id = @voterId)`;
        params.voterId = targetVoterId;
      }
      if (targetVoterDocId) {
        sqlQuery += ` AND (CAST(b.voter_doc_id AS NVARCHAR(100)) = @voterDocId OR CAST(v.id AS NVARCHAR(100)) = @voterDocId)`;
        params.voterDocId = targetVoterDocId;
      }
      if (targetBoothId) {
        sqlQuery += ` AND (v.booth_id = @boothId OR CAST(booth.id AS NVARCHAR(100)) = @boothId OR booth.booth_number = @boothId)`;
        params.boothId = targetBoothId;
      }
      if (targetMandalId) {
        sqlQuery += ` AND (v.mandal_id = @mandalId OR CAST(booth.mandal_id AS NVARCHAR(100)) = @mandalId OR CAST(m.id AS NVARCHAR(100)) = @mandalId)`;
        params.mandalId = targetMandalId;
      }

      sqlQuery += ` ORDER BY b.distribution_date DESC, b.created_at DESC`;

      const benefits = await query(sqlQuery, params).catch(async () => {
        return await query(`SELECT * FROM dbo.benefits ORDER BY distribution_date DESC, created_at DESC`);
      });

      const formatted = benefits.map(b => {
        let witnesses = [];
        try { witnesses = b.witnesses ? (typeof b.witnesses === 'string' ? JSON.parse(b.witnesses) : b.witnesses) : []; } catch {}
        return {
          id: String(b.id),
          voterDocId: b.voter_doc_id ? String(b.voter_doc_id) : '',
          voterId: b.voter_id || '',
          voterName: b.voter_name || '',
          aadharNumber: b.aadhar_number || '',
          mobile: b.voter_mobile || '',
          isKaryakarta: Boolean(b.is_karyakarta === 1 || b.is_karyakarta === true),
          boothId: b.booth_id || '',
          boothNumber: b.booth_number || '',
          boothName: b.booth_name || '',
          mandalId: b.mandal_id || '',
          mandalName: b.mandal_name || '',
          amount: typeof b.amount === 'number' ? b.amount : parseFloat(b.amount || '0'),
          benefitName: b.benefit_name || '',
          benefitType: b.benefit_type || 'Government',
          date: b.distribution_date ? new Date(b.distribution_date).toISOString().split('T')[0] : '',
          distributionDate: b.distribution_date ? new Date(b.distribution_date).toISOString().split('T')[0] : '',
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
        symbol: p.symbol || '',
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
          v.voter_id AS voter_epic,
          v.mobile AS voter_mobile,
          v.email AS voter_email,
          v.village AS voter_village,
          v.guardian_name AS voter_guardian_name,
          v.house_no AS voter_house_no,
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

      const rawAdminId = s.adminId || s.admin_id || null;

      if (id && !isNaN(Number(id))) {
        await execute(
          `UPDATE dbo.voter_sentiments SET
             voter_name = @voter_name,
             favored_party_id = @favored_party_id,
             favored_party_name = @favored_party_name,
             sentiment_score = @sentiment_score,
             party_color = COALESCE(@party_color, party_color),
             party_symbol = COALESCE(@party_symbol, party_symbol),
             notes = COALESCE(@notes, notes),
             is_karyakarta = COALESCE(@is_karyakarta, is_karyakarta),
             admin_id = COALESCE(@admin_id, admin_id),
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
            party_color: s.partyColor || s.party_color || null,
            party_symbol: s.partySymbol || s.party_symbol || null,
            notes: s.notes || null,
            is_karyakarta: (s.isKaryakarta || s.is_karyakarta) ? 1 : 0,
            admin_id: rawAdminId,
            key_concerns: JSON.stringify(s.keyConcerns || []),
            custom_answers: JSON.stringify(customAns),
            survey_id: sId || null,
            survey_title: sTitle || null
          }
        );
        return res.json({ id: Number(id), ...s });
      }

      // Check for duplicate response: One voter can only submit once per survey campaign or once per admin general assessment
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
        if (rawAdminId) {
          dupSql += ` AND (admin_id = @adminId OR admin_id IS NULL)`;
          dupParams.adminId = String(rawAdminId);
        }
        dupParams.electionId = String(eId || '1');
      }

      const existingEntries = await query(dupSql, dupParams);
      if (existingEntries.length > 0) {
        if (sId) {
          return res.status(400).json({ 
            error: `This voter has already submitted a response for this survey campaign (${existingEntries[0].survey_title || sTitle || 'Current Campaign'}). Multiple entries for the same survey are not allowed.` 
          });
        } else {
          // Update existing general sentiment entry for this voter under this admin
          const existingId = existingEntries[0].id;
          await execute(
            `UPDATE dbo.voter_sentiments SET
               voter_name = @voter_name,
               favored_party_id = @favored_party_id,
               favored_party_name = @favored_party_name,
               sentiment_score = @sentiment_score,
               party_color = COALESCE(@party_color, party_color),
               party_symbol = COALESCE(@party_symbol, party_symbol),
               notes = COALESCE(@notes, notes),
               is_karyakarta = COALESCE(@is_karyakarta, is_karyakarta),
               admin_id = COALESCE(@admin_id, admin_id),
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
              party_color: s.partyColor || s.party_color || null,
              party_symbol: s.partySymbol || s.party_symbol || null,
              notes: s.notes || null,
              is_karyakarta: (s.isKaryakarta || s.is_karyakarta) ? 1 : 0,
              admin_id: rawAdminId,
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
          party_color, party_symbol, notes, is_karyakarta, admin_id,
          key_concerns, constituency_id, state_id, district_id, booth_id,
          mobile, email, aadhar_number, survey_id, survey_title, custom_answers,
          recorded_by, recorded_by_name
        ) 
        OUTPUT INSERTED.*
        VALUES (
          @voter_id, @voter_name, @election_id, @election_year,
          @favored_party_id, @favored_party_name, @sentiment_score,
          @party_color, @party_symbol, @notes, @is_karyakarta, @admin_id,
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
          party_color: s.partyColor || s.party_color || null,
          party_symbol: s.partySymbol || s.party_symbol || null,
          notes: s.notes || null,
          is_karyakarta: (s.isKaryakarta || s.is_karyakarta) ? 1 : 0,
          admin_id: rawAdminId,
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
      const id = req.params.id;
      await execute(`DELETE FROM dbo.voter_sentiments WHERE id = @id OR voter_id = @id`, { id }).catch(() => {});
      await execute(`DELETE FROM dbo.voter_assessments WHERE id = @id OR voter_id = @id`, { id }).catch(() => {});
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
    await ensureDemographicAndHealthSchema();
  } catch (migErr) {
    console.warn('[Migration] Note on startup migration check:', migErr);
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

async function ensureDemographicAndHealthSchema() {
  try {
    // 1. Ensure columns on dbo.voters
    await execute(`
      IF OBJECT_ID(N'dbo.voters', N'U') IS NOT NULL
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'aadhar_number')
          ALTER TABLE dbo.voters ADD aadhar_number NVARCHAR(64) NULL;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'dob')
          ALTER TABLE dbo.voters ADD dob NVARCHAR(32) NULL;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'education')
          ALTER TABLE dbo.voters ADD education NVARCHAR(100) NULL;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'additional_mobile')
          ALTER TABLE dbo.voters ADD additional_mobile NVARCHAR(64) NULL;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'new_address')
          ALTER TABLE dbo.voters ADD new_address NVARCHAR(500) NULL;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'vital_status')
          ALTER TABLE dbo.voters ADD vital_status NVARCHAR(50) DEFAULT 'Active';
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'death_date')
          ALTER TABLE dbo.voters ADD death_date NVARCHAR(32) NULL;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'death_notes')
          ALTER TABLE dbo.voters ADD death_notes NVARCHAR(MAX) NULL;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'physical_profile')
          ALTER TABLE dbo.voters ADD physical_profile NVARCHAR(100) DEFAULT 'General';
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'disability_category')
          ALTER TABLE dbo.voters ADD disability_category NVARCHAR(100) DEFAULT 'None';
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'disability_percent')
          ALTER TABLE dbo.voters ADD disability_percent INT DEFAULT 0;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'eci_assistance_needed')
          ALTER TABLE dbo.voters ADD eci_assistance_needed BIT DEFAULT 0;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'economic_category')
          ALTER TABLE dbo.voters ADD economic_category NVARCHAR(50) DEFAULT 'APL';
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'income_range')
          ALTER TABLE dbo.voters ADD income_range NVARCHAR(100) DEFAULT '₹15,000 - ₹30,000';
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'land_ownership')
          ALTER TABLE dbo.voters ADD land_ownership NVARCHAR(100) DEFAULT 'Small Farmer';
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'ration_card_type')
          ALTER TABLE dbo.voters ADD ration_card_type NVARCHAR(50) NULL;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'ration_card_no')
          ALTER TABLE dbo.voters ADD ration_card_no NVARCHAR(100) NULL;
        IF NOT EXISTS (SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'voters' AND COLUMN_NAME = 'housing_type')
          ALTER TABLE dbo.voters ADD housing_type NVARCHAR(100) NULL;
      END
    `);

    // 2. Ensure dbo.voter_health_economy table
    await execute(`
      IF OBJECT_ID(N'dbo.voter_health_economy', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.voter_health_economy (
          id INT IDENTITY(1,1) PRIMARY KEY,
          voter_doc_id VARCHAR(64) NOT NULL,
          voter_epic VARCHAR(64) NOT NULL,
          aadhar_number VARCHAR(64) NULL,
          vital_status VARCHAR(50) DEFAULT 'Active',
          death_date VARCHAR(32) NULL,
          death_notes NVARCHAR(MAX) NULL,
          physical_profile VARCHAR(100) DEFAULT 'General',
          disability_category VARCHAR(100) DEFAULT 'None',
          disability_percent INT DEFAULT 0,
          eci_assistance_needed BIT DEFAULT 0,
          health_notes NVARCHAR(MAX) NULL,
          economic_category VARCHAR(50) DEFAULT 'APL',
          income_range VARCHAR(100) DEFAULT '₹15,000 - ₹30,000',
          land_ownership VARCHAR(100) DEFAULT 'Small Farmer',
          ration_card_type VARCHAR(50) NULL,
          ration_card_no VARCHAR(100) NULL,
          housing_type VARCHAR(100) NULL,
          occupation_detail NVARCHAR(200) NULL,
          recorded_by VARCHAR(64) NULL,
          recorded_by_name NVARCHAR(100) NULL,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
          updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
        );
        CREATE INDEX idx_voter_health_econ_doc ON dbo.voter_health_economy(voter_doc_id);
        CREATE INDEX idx_voter_health_econ_epic ON dbo.voter_health_economy(voter_epic);
        CREATE INDEX idx_voter_health_econ_aadhar ON dbo.voter_health_economy(aadhar_number);
      END
    `);

    // 3. Ensure dbo.voter_assessments table
    await execute(`
      IF OBJECT_ID(N'dbo.voter_assessments', N'U') IS NULL
      BEGIN
        CREATE TABLE dbo.voter_assessments (
          id VARCHAR(128) PRIMARY KEY,
          admin_id VARCHAR(64) NOT NULL,
          voter_id VARCHAR(64) NOT NULL,
          voter_epic VARCHAR(64) NULL,
          aadhar_number VARCHAR(64) NULL,
          voter_name NVARCHAR(200) NULL,
          vital_status VARCHAR(50) DEFAULT 'Active',
          physical_profile VARCHAR(100) DEFAULT 'General',
          disability_category VARCHAR(100) DEFAULT 'None',
          eci_assistance_needed BIT DEFAULT 0,
          economic_category VARCHAR(50) DEFAULT 'APL',
          income_range VARCHAR(100) DEFAULT '₹15,000 - ₹30,000',
          land_ownership VARCHAR(100) DEFAULT 'Small Farmer',
          education NVARCHAR(100) DEFAULT 'Unspecified',
          sentiment_score FLOAT DEFAULT 3.0,
          sentiment VARCHAR(50) DEFAULT 'Neutral',
          favored_party_id VARCHAR(64) NULL,
          favored_party_name NVARCHAR(150) NULL,
          key_concerns NVARCHAR(MAX) NULL,
          notes NVARCHAR(MAX) NULL,
          is_karyakarta BIT DEFAULT 0,
          voted BIT DEFAULT 0,
          recorded_by VARCHAR(64) NULL,
          recorded_by_name NVARCHAR(100) NULL,
          created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
          updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
        );
        CREATE INDEX idx_voter_assessments_admin_voter ON dbo.voter_assessments(admin_id, voter_id);
      END
    `);

    // 4. Ensure auxiliary columns for voter_assessments & voter_sentiments
    await execute(`
      IF COL_LENGTH('dbo.voter_assessments', 'party_color') IS NULL
        ALTER TABLE dbo.voter_assessments ADD party_color VARCHAR(32) NULL;
      IF COL_LENGTH('dbo.voter_assessments', 'party_symbol') IS NULL
        ALTER TABLE dbo.voter_assessments ADD party_symbol NVARCHAR(50) NULL;

      IF COL_LENGTH('dbo.voter_sentiments', 'admin_id') IS NULL
        ALTER TABLE dbo.voter_sentiments ADD admin_id VARCHAR(64) NULL;
      IF COL_LENGTH('dbo.voter_sentiments', 'party_color') IS NULL
        ALTER TABLE dbo.voter_sentiments ADD party_color VARCHAR(32) NULL;
      IF COL_LENGTH('dbo.voter_sentiments', 'party_symbol') IS NULL
        ALTER TABLE dbo.voter_sentiments ADD party_symbol NVARCHAR(50) NULL;
      IF COL_LENGTH('dbo.voter_sentiments', 'notes') IS NULL
        ALTER TABLE dbo.voter_sentiments ADD notes NVARCHAR(MAX) NULL;
      IF COL_LENGTH('dbo.voter_sentiments', 'is_karyakarta') IS NULL
        ALTER TABLE dbo.voter_sentiments ADD is_karyakarta BIT DEFAULT 0;
    `).catch(() => {});
  } catch (err) {
    console.warn('[Migration] ensureDemographicAndHealthSchema note:', err);
  }
}

startServer();

