-- ============================================================================
-- NextGen CMS: Complete Auto-Increment (IDENTITY) Database Schema for MSSQL
-- Automatically creates database 'nextgencms' if not exists, ensures users table,
-- and recreates all other 20 tables with 'id INT IDENTITY(1,1)' & proper INT FKs.
-- ============================================================================

USE [master];
GO

-- 1. Create nextgencms Database if it doesn't exist
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'nextgencms')
BEGIN
    CREATE DATABASE [nextgencms];
    PRINT 'Created database [nextgencms].';
END
ELSE
BEGIN
    PRINT 'Database [nextgencms] already exists.';
END
GO

-- 2. Create / Configure Server Login
IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = N'election_user')
BEGIN
    CREATE LOGIN [election_user] WITH PASSWORD = N'Election@2026#Secure', CHECK_POLICY = OFF;
END
ELSE
BEGIN
    ALTER LOGIN [election_user] WITH PASSWORD = N'Election@2026#Secure', CHECK_POLICY = OFF;
    ALTER LOGIN [election_user] ENABLE;
END
GO

ALTER SERVER ROLE [sysadmin] ADD MEMBER [election_user];
GO

USE [nextgencms];
GO

-- 3. Create Database User in nextgencms
IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = N'election_user')
BEGIN
    CREATE USER [election_user] FOR LOGIN [election_user];
    ALTER ROLE [db_owner] ADD MEMBER [election_user];
END
GO

-- 4. Ensure dbo.users table exists (preserved)
IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id VARCHAR(128) NOT NULL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'volunteer',
        assigned_booths NVARCHAR(MAX) NULL,
        state_id NVARCHAR(MAX) NULL,
        district_id NVARCHAR(MAX) NULL,
        constituency_id NVARCHAR(MAX) NULL,
        booth_id NVARCHAR(MAX) NULL,
        election_settings NVARCHAR(MAX) NULL,
        disabled BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX idx_users_email ON dbo.users(email);
    PRINT 'Created dbo.users table.';
END
GO

-- 5. Ensure dbo.user_invites table exists (preserved)
IF OBJECT_ID(N'dbo.user_invites', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.user_invites (
        id VARCHAR(128) NOT NULL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'volunteer',
        assigned_booths NVARCHAR(MAX) NULL,
        rights NVARCHAR(MAX) DEFAULT '{}',
        state_id INT NULL,
        district_id INT NULL,
        constituency_id INT NULL,
        booth_id INT NULL,
        token VARCHAR(255) NOT NULL,
        status VARCHAR(50) DEFAULT 'pending',
        created_by VARCHAR(128) NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX idx_user_invites_email ON dbo.user_invites(email);
    CREATE INDEX idx_user_invites_token ON dbo.user_invites(token);
    PRINT 'Created dbo.user_invites table.';
END
GO

-- 6. Disable Constraints & Drop Old 20 Tables safely
EXEC sp_MSforeachtable "ALTER TABLE ? NOCHECK CONSTRAINT ALL";
GO

IF OBJECT_ID(N'dbo.voter_sentiments', N'U') IS NOT NULL DROP TABLE dbo.voter_sentiments;
IF OBJECT_ID(N'dbo.benefits', N'U') IS NOT NULL DROP TABLE dbo.benefits;
IF OBJECT_ID(N'dbo.volunteers', N'U') IS NOT NULL DROP TABLE dbo.volunteers;
IF OBJECT_ID(N'dbo.booth_agents', N'U') IS NOT NULL DROP TABLE dbo.booth_agents;
IF OBJECT_ID(N'dbo.voters', N'U') IS NOT NULL DROP TABLE dbo.voters;
IF OBJECT_ID(N'dbo.mandal_members', N'U') IS NOT NULL DROP TABLE dbo.mandal_members;
IF OBJECT_ID(N'dbo.booths', N'U') IS NOT NULL DROP TABLE dbo.booths;
IF OBJECT_ID(N'dbo.mandals', N'U') IS NOT NULL DROP TABLE dbo.mandals;
IF OBJECT_ID(N'dbo.constituencies', N'U') IS NOT NULL DROP TABLE dbo.constituencies;
IF OBJECT_ID(N'dbo.districts', N'U') IS NOT NULL DROP TABLE dbo.districts;
IF OBJECT_ID(N'dbo.states', N'U') IS NOT NULL DROP TABLE dbo.states;
IF OBJECT_ID(N'dbo.surveys', N'U') IS NOT NULL DROP TABLE dbo.surveys;
IF OBJECT_ID(N'dbo.survey_templates', N'U') IS NOT NULL DROP TABLE dbo.survey_templates;
IF OBJECT_ID(N'dbo.political_parties', N'U') IS NOT NULL DROP TABLE dbo.political_parties;
IF OBJECT_ID(N'dbo.elections', N'U') IS NOT NULL DROP TABLE dbo.elections;
IF OBJECT_ID(N'dbo.campaign_budgets', N'U') IS NOT NULL DROP TABLE dbo.campaign_budgets;
IF OBJECT_ID(N'dbo.finance_transactions', N'U') IS NOT NULL DROP TABLE dbo.finance_transactions;
IF OBJECT_ID(N'dbo.whatsapp_broadcasts', N'U') IS NOT NULL DROP TABLE dbo.whatsapp_broadcasts;
IF OBJECT_ID(N'dbo.whatsapp_templates', N'U') IS NOT NULL DROP TABLE dbo.whatsapp_templates;
IF OBJECT_ID(N'dbo.whatsapp_configs', N'U') IS NOT NULL DROP TABLE dbo.whatsapp_configs;
GO

-- ============================================================================
-- 7. Core Demographic Hierarchy (IDENTITY INT)
-- ============================================================================

-- States Table
CREATE TABLE dbo.states (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    created_by VARCHAR(128) NULL
);
GO

-- Districts Table
CREATE TABLE dbo.districts (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    state_id INT NOT NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    created_by VARCHAR(128) NULL,
    CONSTRAINT fk_districts_state FOREIGN KEY (state_id) REFERENCES dbo.states(id) ON DELETE CASCADE
);
GO

-- Constituencies Table
CREATE TABLE dbo.constituencies (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    district_id INT NOT NULL,
    state_id INT NULL,
    category VARCHAR(50) DEFAULT 'General',
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    created_by VARCHAR(128) NULL,
    CONSTRAINT fk_constituencies_district FOREIGN KEY (district_id) REFERENCES dbo.districts(id) ON DELETE CASCADE,
    CONSTRAINT fk_constituencies_state FOREIGN KEY (state_id) REFERENCES dbo.states(id) ON DELETE NO ACTION
);
GO

-- Mandals Table
CREATE TABLE dbo.mandals (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    mandal_code VARCHAR(50) NOT NULL,
    president_name VARCHAR(255) NULL,
    president_phone VARCHAR(50) NULL,
    voter_count INT DEFAULT 0,
    population INT DEFAULT 0,
    state_id INT NULL,
    district_id INT NULL,
    constituency_id INT NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    created_by VARCHAR(128) NULL,
    CONSTRAINT fk_mandals_state FOREIGN KEY (state_id) REFERENCES dbo.states(id) ON DELETE NO ACTION,
    CONSTRAINT fk_mandals_district FOREIGN KEY (district_id) REFERENCES dbo.districts(id) ON DELETE NO ACTION,
    CONSTRAINT fk_mandals_constituency FOREIGN KEY (constituency_id) REFERENCES dbo.constituencies(id) ON DELETE NO ACTION
);
GO

-- Mandal Members Table
CREATE TABLE dbo.mandal_members (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    mandal_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NULL,
    voter_id VARCHAR(100) NULL,
    designation VARCHAR(255) NULL,
    category_key VARCHAR(100) NOT NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_mandal_members_mandal FOREIGN KEY (mandal_id) REFERENCES dbo.mandals(id) ON DELETE CASCADE
);
CREATE INDEX idx_mandal_members_mandal_cat ON dbo.mandal_members(mandal_id, category_key);
GO

-- Booths Table
CREATE TABLE dbo.booths (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    booth_number VARCHAR(50) NOT NULL,
    name VARCHAR(255) NOT NULL,
    constituency_id INT NOT NULL,
    mandal_id INT NULL,
    total_voters INT DEFAULT 0,
    address NVARCHAR(500) NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    created_by VARCHAR(128) NULL,
    CONSTRAINT fk_booths_constituency FOREIGN KEY (constituency_id) REFERENCES dbo.constituencies(id) ON DELETE NO ACTION,
    CONSTRAINT fk_booths_mandal FOREIGN KEY (mandal_id) REFERENCES dbo.mandals(id) ON DELETE NO ACTION
);
CREATE INDEX idx_booths_constituency ON dbo.booths(constituency_id);
CREATE INDEX idx_booths_mandal ON dbo.booths(mandal_id);
GO

-- ============================================================================
-- 8. Voters Table (IDENTITY INT)
-- ============================================================================

CREATE TABLE dbo.voters (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    voter_id VARCHAR(100) NOT NULL, -- EPIC Number
    name VARCHAR(255) NOT NULL,
    relation_name VARCHAR(255) NULL,
    relation_type VARCHAR(50) NULL,
    gender VARCHAR(20) NULL,
    age INT NULL,
    part_no VARCHAR(50) NULL,
    sr_no VARCHAR(50) NULL,
    mobile VARCHAR(50) NULL,
    email VARCHAR(255) NULL,
    address NVARCHAR(500) NULL,
    house_no VARCHAR(100) NULL,
    village VARCHAR(100) NULL,
    caste VARCHAR(100) NULL,
    occupation VARCHAR(100) NULL,
    is_karyakarta BIT NOT NULL DEFAULT 0,
    voting_status VARCHAR(50) DEFAULT 'unvoted',
    party_inclination VARCHAR(50) NULL,
    booth_id INT NOT NULL,
    mandal_id INT NULL,
    constituency_id INT NOT NULL,
    state_id INT NULL,
    district_id INT NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    updated_at DATETIME2 NULL,
    CONSTRAINT fk_voters_booth FOREIGN KEY (booth_id) REFERENCES dbo.booths(id) ON DELETE NO ACTION,
    CONSTRAINT fk_voters_mandal FOREIGN KEY (mandal_id) REFERENCES dbo.mandals(id) ON DELETE NO ACTION,
    CONSTRAINT fk_voters_constituency FOREIGN KEY (constituency_id) REFERENCES dbo.constituencies(id) ON DELETE NO ACTION
);
CREATE UNIQUE INDEX idx_voters_epic ON dbo.voters(voter_id);
CREATE INDEX idx_voters_constituency ON dbo.voters(constituency_id);
CREATE INDEX idx_voters_booth ON dbo.voters(booth_id);
CREATE INDEX idx_voters_mandal ON dbo.voters(mandal_id);
CREATE INDEX idx_voters_mobile ON dbo.voters(mobile);
CREATE INDEX idx_voters_status ON dbo.voters(voting_status);
GO

-- ============================================================================
-- 9. Volunteers & Booth Agents (IDENTITY INT)
-- ============================================================================

CREATE TABLE dbo.volunteers (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    voter_doc_id INT NOT NULL,
    voter_id VARCHAR(100) NOT NULL,
    name VARCHAR(255) NOT NULL,
    aadhar_number VARCHAR(50) NULL,
    mobile VARCHAR(50) NULL,
    admin_id VARCHAR(128) NOT NULL,
    status VARCHAR(50) DEFAULT 'Active',
    tasks NVARCHAR(MAX) NULL,
    performance_rating FLOAT DEFAULT 5.0,
    assigned_booth_id INT NULL,
    assigned_booth_name VARCHAR(255) NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_volunteers_voter FOREIGN KEY (voter_doc_id) REFERENCES dbo.voters(id) ON DELETE NO ACTION
);
CREATE INDEX idx_volunteers_admin ON dbo.volunteers(admin_id);
GO

CREATE TABLE dbo.booth_agents (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    admin_id VARCHAR(128) NOT NULL,
    booth_id INT NOT NULL,
    booth_number VARCHAR(50) NOT NULL,
    booth_name VARCHAR(255) NOT NULL,
    agent_volunteer_id INT NOT NULL,
    agent_name VARCHAR(255) NOT NULL,
    agent_aadhar VARCHAR(50) NULL,
    agent_mobile VARCHAR(50) NULL,
    designation VARCHAR(255) NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_booth_agents_booth FOREIGN KEY (booth_id) REFERENCES dbo.booths(id) ON DELETE NO ACTION
);
CREATE INDEX idx_booth_agents_admin ON dbo.booth_agents(admin_id);
GO

-- ============================================================================
-- 10. Benefits (IDENTITY INT)
-- ============================================================================

CREATE TABLE dbo.benefits (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    voter_doc_id INT NOT NULL,
    voter_id VARCHAR(100) NOT NULL,
    voter_name VARCHAR(255) NOT NULL,
    aadhar_number VARCHAR(50) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    benefit_name VARCHAR(255) NOT NULL,
    benefit_type VARCHAR(50) NOT NULL,
    distribution_date DATE NOT NULL,
    admin_id VARCHAR(128) NOT NULL,
    notes NVARCHAR(1000) NULL,
    witness_name VARCHAR(255) NULL,
    witness_voter_id VARCHAR(100) NULL,
    witness_voter_doc_id INT NULL,
    witnesses NVARCHAR(MAX) NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_benefits_voter FOREIGN KEY (voter_doc_id) REFERENCES dbo.voters(id) ON DELETE NO ACTION
);
CREATE INDEX idx_benefits_voter ON dbo.benefits(voter_doc_id);
CREATE INDEX idx_benefits_admin ON dbo.benefits(admin_id);
GO

-- ============================================================================
-- 11. Elections, Parties & Surveys (IDENTITY INT)
-- ============================================================================

CREATE TABLE dbo.elections (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    year INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    status VARCHAR(50) DEFAULT 'Upcoming',
    created_at DATETIME2 DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.political_parties (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    abbreviation VARCHAR(50) NOT NULL,
    logo_url NVARCHAR(1000) NULL,
    color VARCHAR(50) NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.survey_templates (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description NVARCHAR(500) NULL,
    is_system BIT NOT NULL DEFAULT 0,
    fields NVARCHAR(MAX) NOT NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.surveys (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    description NVARCHAR(1000) NULL,
    election_id INT NOT NULL,
    election_year INT NOT NULL,
    assigned_to NVARCHAR(MAX) NULL,
    status VARCHAR(50) DEFAULT 'Draft',
    template_id INT NULL,
    linked_party_ids NVARCHAR(MAX) NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_surveys_election FOREIGN KEY (election_id) REFERENCES dbo.elections(id) ON DELETE NO ACTION
);
GO

CREATE TABLE dbo.voter_sentiments (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    voter_id INT NOT NULL,
    voter_name VARCHAR(255) NOT NULL,
    election_id INT NOT NULL,
    election_year INT NOT NULL,
    favored_party_id INT NOT NULL,
    favored_party_name VARCHAR(255) NOT NULL,
    sentiment_score FLOAT NOT NULL DEFAULT 0,
    key_concerns NVARCHAR(MAX) NULL,
    constituency_id INT NULL,
    recorded_by VARCHAR(128) NOT NULL,
    recorded_by_name VARCHAR(255) NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
    CONSTRAINT fk_voter_sentiments_voter FOREIGN KEY (voter_id) REFERENCES dbo.voters(id) ON DELETE CASCADE,
    CONSTRAINT fk_voter_sentiments_election FOREIGN KEY (election_id) REFERENCES dbo.elections(id) ON DELETE NO ACTION
);
CREATE INDEX idx_voter_sentiments_voter ON dbo.voter_sentiments(voter_id);
GO

-- ============================================================================
-- 12. Campaign Budgets & Finance (IDENTITY INT)
-- ============================================================================

CREATE TABLE dbo.campaign_budgets (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    admin_id VARCHAR(128) NOT NULL,
    total_budget DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    election_year VARCHAR(20) NOT NULL,
    allocations NVARCHAR(MAX) NOT NULL,
    updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
);
CREATE INDEX idx_budgets_admin ON dbo.campaign_budgets(admin_id);
GO

CREATE TABLE dbo.finance_transactions (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    admin_id VARCHAR(128) NOT NULL,
    type VARCHAR(20) NOT NULL,
    title VARCHAR(255) NOT NULL,
    amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
    category VARCHAR(100) NOT NULL,
    transaction_date DATE NOT NULL,
    payment_method VARCHAR(50) NOT NULL,
    donor_name VARCHAR(255) NULL,
    notes NVARCHAR(1000) NULL,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME()
);
CREATE INDEX idx_finance_admin ON dbo.finance_transactions(admin_id);
CREATE INDEX idx_finance_date ON dbo.finance_transactions(transaction_date);
GO

-- ============================================================================
-- 13. WhatsApp Outreach (IDENTITY INT)
-- ============================================================================

CREATE TABLE dbo.whatsapp_configs (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    admin_id VARCHAR(128) NOT NULL,
    tenant_type VARCHAR(50) NOT NULL,
    vendor_name VARCHAR(100) NOT NULL,
    phone_number_id VARCHAR(100) NULL,
    waba_id VARCHAR(100) NULL,
    access_token NVARCHAR(MAX) NULL,
    phone_number VARCHAR(50) NOT NULL,
    status VARCHAR(50) DEFAULT 'disconnected',
    created_at DATETIME2 DEFAULT SYSUTCDATETIME()
);
CREATE INDEX idx_wa_config_admin ON dbo.whatsapp_configs(admin_id);
GO

CREATE TABLE dbo.whatsapp_templates (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    admin_id VARCHAR(128) NOT NULL,
    name VARCHAR(100) NOT NULL,
    category VARCHAR(50) NOT NULL,
    language VARCHAR(50) DEFAULT 'en',
    body_text NVARCHAR(MAX) NOT NULL,
    status VARCHAR(50) DEFAULT 'APPROVED',
    created_at DATETIME2 DEFAULT SYSUTCDATETIME()
);
GO

CREATE TABLE dbo.whatsapp_broadcasts (
    id INT IDENTITY(1,1) NOT NULL PRIMARY KEY,
    admin_id VARCHAR(128) NOT NULL,
    campaign_name VARCHAR(255) NOT NULL,
    sender_config_id INT NOT NULL,
    sender_phone VARCHAR(50) NOT NULL,
    template_id INT NULL,
    template_name VARCHAR(100) NOT NULL,
    media_url NVARCHAR(1000) NULL,
    media_type VARCHAR(50) DEFAULT 'none',
    status VARCHAR(50) DEFAULT 'Draft',
    total_count INT DEFAULT 0,
    success_count INT DEFAULT 0,
    failed_count INT DEFAULT 0,
    created_at DATETIME2 DEFAULT SYSUTCDATETIME()
);
CREATE INDEX idx_wa_broadcasts_admin ON dbo.whatsapp_broadcasts(admin_id);
GO

-- Re-enable constraints
EXEC sp_MSforeachtable "ALTER TABLE ? WITH CHECK CHECK CONSTRAINT ALL";
GO

PRINT '============================================================================';
PRINT ' Database [nextgencms] and all 20 tables successfully created with IDENTITY INT!';
PRINT '============================================================================';
GO
