-- ============================================================================
-- Database: nextgencms
-- Target: Microsoft SQL Server / SQL Server Management Studio (SSMS)
-- ============================================================================

-- 1. Create Database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = N'nextgencms')
BEGIN
    CREATE DATABASE nextgencms;
END
GO

USE nextgencms;
GO

-- 2. Create Login and Database User (Optional local credentials)
-- Note: Replace 'StrongPassword!123' with your secure password if desired
IF NOT EXISTS (SELECT name FROM sys.server_principals WHERE name = N'election_user')
BEGIN
    CREATE LOGIN election_user WITH PASSWORD = N'Election@2026#Secure', CHECK_POLICY = OFF;
END
GO

IF NOT EXISTS (SELECT name FROM sys.database_principals WHERE name = N'election_user')
BEGIN
    CREATE USER election_user FOR LOGIN election_user;
    ALTER ROLE db_owner ADD MEMBER election_user;
END
GO

-- ============================================================================
-- 3. Core Demographic Hierarchy (States, Districts, Constituencies)
-- ============================================================================

-- States Table
IF OBJECT_ID(N'dbo.states', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.states (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        code VARCHAR(50) NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- Districts Table
IF OBJECT_ID(N'dbo.districts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.districts (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        state_id VARCHAR(64) NOT NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_districts_state FOREIGN KEY (state_id) REFERENCES dbo.states(id) ON DELETE CASCADE
    );
END
GO

-- Constituencies Table
IF OBJECT_ID(N'dbo.constituencies', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.constituencies (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        district_id VARCHAR(64) NOT NULL,
        state_id VARCHAR(64) NOT NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_constituencies_district FOREIGN KEY (district_id) REFERENCES dbo.districts(id) ON DELETE CASCADE,
        CONSTRAINT fk_constituencies_state FOREIGN KEY (state_id) REFERENCES dbo.states(id) ON DELETE NO ACTION
    );
END
GO

-- ============================================================================
-- 4. Mandals & Mandal Members
-- ============================================================================

-- Mandals Table
IF OBJECT_ID(N'dbo.mandals', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.mandals (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        mandal_code VARCHAR(50) NOT NULL,
        president_name VARCHAR(255) NULL,
        president_phone VARCHAR(50) NULL,
        voter_count INT DEFAULT 0,
        population INT DEFAULT 0,
        state_id VARCHAR(64) NULL,
        district_id VARCHAR(64) NULL,
        constituency_id VARCHAR(64) NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_mandals_state FOREIGN KEY (state_id) REFERENCES dbo.states(id) ON DELETE NO ACTION,
        CONSTRAINT fk_mandals_district FOREIGN KEY (district_id) REFERENCES dbo.districts(id) ON DELETE NO ACTION,
        CONSTRAINT fk_mandals_constituency FOREIGN KEY (constituency_id) REFERENCES dbo.constituencies(id) ON DELETE NO ACTION
    );
END
GO

-- Mandal Members Table (The 8 category lists)
IF OBJECT_ID(N'dbo.mandal_members', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.mandal_members (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        mandal_id VARCHAR(64) NOT NULL,
        name VARCHAR(255) NOT NULL,
        phone VARCHAR(50) NULL,
        voter_id VARCHAR(100) NULL,
        designation VARCHAR(255) NULL,
        category_key VARCHAR(100) NOT NULL, -- e.g. 'office_bearers', 'morcha_leaders', 'youth_wing'
        created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_mandal_members_mandal FOREIGN KEY (mandal_id) REFERENCES dbo.mandals(id) ON DELETE CASCADE
    );
    CREATE INDEX idx_mandal_members_mandal_cat ON dbo.mandal_members(mandal_id, category_key);
END
GO

-- ============================================================================
-- 5. Booths Table
-- ============================================================================

IF OBJECT_ID(N'dbo.booths', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.booths (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        booth_number VARCHAR(50) NOT NULL,
        name VARCHAR(255) NOT NULL,
        constituency_id VARCHAR(64) NOT NULL,
        mandal_id VARCHAR(64) NULL,
        total_voters INT DEFAULT 0,
        address NVARCHAR(500) NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_booths_constituency FOREIGN KEY (constituency_id) REFERENCES dbo.constituencies(id) ON DELETE NO ACTION,
        CONSTRAINT fk_booths_mandal FOREIGN KEY (mandal_id) REFERENCES dbo.mandals(id) ON DELETE NO ACTION
    );
    CREATE INDEX idx_booths_constituency ON dbo.booths(constituency_id);
    CREATE INDEX idx_booths_mandal ON dbo.booths(mandal_id);
END
GO

-- ============================================================================
-- 6. Users / Admins / Volunteers (RBAC)
-- ============================================================================

IF OBJECT_ID(N'dbo.users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.users (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        email VARCHAR(255) NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        name VARCHAR(255) NOT NULL,
        role VARCHAR(50) DEFAULT 'volunteer', -- 'admin', 'super_admin', 'volunteer', 'manager', 'guest'
        assigned_booths NVARCHAR(MAX) NULL,   -- JSON array of booth IDs e.g. ["booth_1", "booth_2"]
        rights NVARCHAR(MAX) DEFAULT '{}',    -- JSON module permissions e.g. {"voters": "vcud"}
        state_id VARCHAR(64) NULL,
        district_id VARCHAR(64) NULL,
        constituency_id VARCHAR(64) NULL,
        disabled BIT NOT NULL DEFAULT 0,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    CREATE UNIQUE INDEX idx_users_email ON dbo.users(email);
END
GO

-- ============================================================================
-- 7. Voters Table
-- ============================================================================

IF OBJECT_ID(N'dbo.voters', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.voters (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        voter_id VARCHAR(100) NOT NULL, -- EPIC Number (Election Card ID)
        name VARCHAR(255) NOT NULL,
        relation_name VARCHAR(255) NULL,
        relation_type VARCHAR(50) NULL,  -- 'Father', 'Husband', 'Mother', 'Other'
        gender VARCHAR(20) NULL,         -- 'Male', 'Female', 'Other'
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
        voting_status VARCHAR(50) DEFAULT 'unvoted', -- 'voted', 'unvoted'
        party_inclination VARCHAR(50) NULL,         -- 'Support', 'Neutral', 'Oppose', 'Other Party'
        booth_id VARCHAR(64) NOT NULL,
        mandal_id VARCHAR(64) NULL,
        constituency_id VARCHAR(64) NOT NULL,
        state_id VARCHAR(64) NULL,
        district_id VARCHAR(64) NULL,
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
END
GO

-- ============================================================================
-- 8. Election Cycles & Political Parties
-- ============================================================================

IF OBJECT_ID(N'dbo.elections', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.elections (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        year INT NOT NULL,
        title VARCHAR(255) NOT NULL,
        description NVARCHAR(1000) NULL,
        status VARCHAR(50) DEFAULT 'Upcoming', -- 'Upcoming', 'Active', 'Completed'
        created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.political_parties', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.political_parties (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        abbreviation VARCHAR(50) NOT NULL,
        logo_url NVARCHAR(1000) NULL,
        color VARCHAR(50) NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

-- ============================================================================
-- 9. Surveys, Templates & Voter Sentiments
-- ============================================================================

IF OBJECT_ID(N'dbo.survey_templates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.survey_templates (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        description NVARCHAR(500) NULL,
        is_system BIT NOT NULL DEFAULT 0,
        fields NVARCHAR(MAX) NOT NULL, -- JSON array of questions
        created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.surveys', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.surveys (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        title VARCHAR(255) NOT NULL,
        description NVARCHAR(1000) NULL,
        election_id VARCHAR(64) NOT NULL,
        election_year INT NOT NULL,
        assigned_to NVARCHAR(MAX) NULL, -- JSON array of user IDs
        status VARCHAR(50) DEFAULT 'Draft', -- 'Draft', 'Active', 'Completed'
        template_id VARCHAR(64) NULL,
        linked_party_ids NVARCHAR(MAX) NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_surveys_election FOREIGN KEY (election_id) REFERENCES dbo.elections(id) ON DELETE NO ACTION
    );
END
GO

IF OBJECT_ID(N'dbo.voter_sentiments', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.voter_sentiments (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        voter_id VARCHAR(64) NOT NULL,
        voter_name VARCHAR(255) NOT NULL,
        election_id VARCHAR(64) NOT NULL,
        election_year INT NOT NULL,
        favored_party_id VARCHAR(64) NOT NULL,
        favored_party_name VARCHAR(255) NOT NULL,
        sentiment_score FLOAT NOT NULL DEFAULT 0,
        key_concerns NVARCHAR(MAX) NULL, -- JSON array
        constituency_id VARCHAR(64) NULL,
        recorded_by VARCHAR(64) NOT NULL,
        recorded_by_name VARCHAR(255) NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_voter_sentiments_voter FOREIGN KEY (voter_id) REFERENCES dbo.voters(id) ON DELETE CASCADE,
        CONSTRAINT fk_voter_sentiments_election FOREIGN KEY (election_id) REFERENCES dbo.elections(id) ON DELETE NO ACTION
    );
    CREATE INDEX idx_voter_sentiments_voter ON dbo.voter_sentiments(voter_id);
END
GO

-- ============================================================================
-- 10. Karyakartas (Volunteers) & Booth Agents
-- ============================================================================

IF OBJECT_ID(N'dbo.volunteers', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.volunteers (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        voter_doc_id VARCHAR(64) NOT NULL,
        voter_id VARCHAR(100) NOT NULL,
        name VARCHAR(255) NOT NULL,
        aadhar_number VARCHAR(50) NULL,
        mobile VARCHAR(50) NULL,
        admin_id VARCHAR(64) NOT NULL,
        status VARCHAR(50) DEFAULT 'Active', -- 'Active', 'Inactive'
        tasks NVARCHAR(MAX) NULL,            -- JSON array
        performance_rating FLOAT DEFAULT 5.0,
        assigned_booth_id VARCHAR(64) NULL,
        assigned_booth_name VARCHAR(255) NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_volunteers_voter FOREIGN KEY (voter_doc_id) REFERENCES dbo.voters(id) ON DELETE NO ACTION
    );
    CREATE INDEX idx_volunteers_admin ON dbo.volunteers(admin_id);
END
GO

IF OBJECT_ID(N'dbo.booth_agents', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.booth_agents (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        admin_id VARCHAR(64) NOT NULL,
        booth_id VARCHAR(64) NOT NULL,
        booth_number VARCHAR(50) NOT NULL,
        booth_name VARCHAR(255) NOT NULL,
        agent_volunteer_id VARCHAR(64) NOT NULL,
        agent_name VARCHAR(255) NOT NULL,
        agent_aadhar VARCHAR(50) NULL,
        agent_mobile VARCHAR(50) NULL,
        designation VARCHAR(255) NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_booth_agents_booth FOREIGN KEY (booth_id) REFERENCES dbo.booths(id) ON DELETE NO ACTION
    );
    CREATE INDEX idx_booth_agents_admin ON dbo.booth_agents(admin_id);
END
GO

-- ============================================================================
-- 11. Benefits / Welfare Schemes
-- ============================================================================

IF OBJECT_ID(N'dbo.benefits', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.benefits (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        voter_doc_id VARCHAR(64) NOT NULL,
        voter_id VARCHAR(100) NOT NULL,
        voter_name VARCHAR(255) NOT NULL,
        aadhar_number VARCHAR(50) NOT NULL,
        amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
        benefit_name VARCHAR(255) NOT NULL,
        benefit_type VARCHAR(50) NOT NULL, -- 'Government', 'Party'
        distribution_date DATE NOT NULL,
        admin_id VARCHAR(64) NOT NULL,
        notes NVARCHAR(1000) NULL,
        witness_name VARCHAR(255) NULL,
        witness_voter_id VARCHAR(100) NULL,
        witness_voter_doc_id VARCHAR(64) NULL,
        witnesses NVARCHAR(MAX) NULL, -- JSON array
        created_at DATETIME2 DEFAULT SYSUTCDATETIME(),
        CONSTRAINT fk_benefits_voter FOREIGN KEY (voter_doc_id) REFERENCES dbo.voters(id) ON DELETE NO ACTION
    );
    CREATE INDEX idx_benefits_voter ON dbo.benefits(voter_doc_id);
    CREATE INDEX idx_benefits_admin ON dbo.benefits(admin_id);
END
GO

-- ============================================================================
-- 12. Campaign Budgets & Financial Transactions
-- ============================================================================

IF OBJECT_ID(N'dbo.campaign_budgets', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.campaign_budgets (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        admin_id VARCHAR(64) NOT NULL,
        total_budget DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
        election_year VARCHAR(20) NOT NULL,
        allocations NVARCHAR(MAX) NOT NULL, -- JSON category allocations
        updated_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX idx_budgets_admin ON dbo.campaign_budgets(admin_id);
END
GO

IF OBJECT_ID(N'dbo.finance_transactions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.finance_transactions (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        admin_id VARCHAR(64) NOT NULL,
        type VARCHAR(20) NOT NULL, -- 'expense', 'income'
        title VARCHAR(255) NOT NULL,
        amount DECIMAL(18, 2) NOT NULL DEFAULT 0.00,
        category VARCHAR(100) NOT NULL,
        transaction_date DATE NOT NULL,
        payment_method VARCHAR(50) NOT NULL, -- 'Cash', 'Bank Transfer', 'Cheque', 'Online'
        donor_name VARCHAR(255) NULL,
        notes NVARCHAR(1000) NULL,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX idx_finance_admin ON dbo.finance_transactions(admin_id);
    CREATE INDEX idx_finance_date ON dbo.finance_transactions(transaction_date);
END
GO

-- ============================================================================
-- 13. WhatsApp Campaigns & Meta Configs
-- ============================================================================

IF OBJECT_ID(N'dbo.whatsapp_configs', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.whatsapp_configs (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        admin_id VARCHAR(64) NOT NULL,
        tenant_type VARCHAR(50) NOT NULL, -- 'shared', 'vendor'
        vendor_name VARCHAR(100) NOT NULL,
        phone_number_id VARCHAR(100) NULL,
        waba_id VARCHAR(100) NULL,
        access_token NVARCHAR(MAX) NULL,
        phone_number VARCHAR(50) NOT NULL,
        status VARCHAR(50) DEFAULT 'disconnected', -- 'connected', 'disconnected'
        created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX idx_wa_config_admin ON dbo.whatsapp_configs(admin_id);
END
GO

IF OBJECT_ID(N'dbo.whatsapp_templates', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.whatsapp_templates (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        admin_id VARCHAR(64) NOT NULL,
        name VARCHAR(100) NOT NULL,
        category VARCHAR(50) NOT NULL, -- 'UTILITY', 'MARKETING', 'AUTHENTICATION'
        language VARCHAR(50) DEFAULT 'en',
        body_text NVARCHAR(MAX) NOT NULL,
        status VARCHAR(50) DEFAULT 'APPROVED', -- 'APPROVED', 'PENDING', 'REJECTED'
        created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
END
GO

IF OBJECT_ID(N'dbo.whatsapp_broadcasts', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.whatsapp_broadcasts (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        admin_id VARCHAR(64) NOT NULL,
        campaign_name VARCHAR(255) NOT NULL,
        sender_config_id VARCHAR(64) NOT NULL,
        sender_phone VARCHAR(50) NOT NULL,
        template_id VARCHAR(64) NULL,
        template_name VARCHAR(100) NOT NULL,
        media_url NVARCHAR(1000) NULL,
        media_type VARCHAR(50) DEFAULT 'none', -- 'none', 'image', 'document', 'video'
        status VARCHAR(50) DEFAULT 'Draft',   -- 'Draft', 'Sending', 'Completed', 'Failed', 'Paused'
        total_count INT DEFAULT 0,
        success_count INT DEFAULT 0,
        failed_count INT DEFAULT 0,
        created_at DATETIME2 DEFAULT SYSUTCDATETIME()
    );
    CREATE INDEX idx_wa_broadcasts_admin ON dbo.whatsapp_broadcasts(admin_id);
END
GO

-- ============================================================================
-- 14. Seed Initial Data
-- ============================================================================

-- State
IF NOT EXISTS (SELECT 1 FROM dbo.states WHERE id = 'state_up')
BEGIN
    INSERT INTO dbo.states (id, name, code)
    VALUES ('state_up', 'Uttar Pradesh', 'UP');
END
GO

-- District
IF NOT EXISTS (SELECT 1 FROM dbo.districts WHERE id = 'dist_lko')
BEGIN
    INSERT INTO dbo.districts (id, name, state_id)
    VALUES ('dist_lko', 'Lucknow', 'state_up');
END
GO

-- Constituency
IF NOT EXISTS (SELECT 1 FROM dbo.constituencies WHERE id = 'const_lko_cantt')
BEGIN
    INSERT INTO dbo.constituencies (id, name, district_id, state_id)
    VALUES ('const_lko_cantt', 'Lucknow Cantt', 'dist_lko', 'state_up');
END
GO

-- Mandal
IF NOT EXISTS (SELECT 1 FROM dbo.mandals WHERE id = 'mandal_sadar')
BEGIN
    INSERT INTO dbo.mandals (id, name, mandal_code, president_name, president_phone, voter_count, population, state_id, district_id, constituency_id)
    VALUES ('mandal_sadar', 'Sadar Mandal', 'MAN-001', 'Ram Prakash Sharma', '+91 9876543210', 35000, 75000, 'state_up', 'dist_lko', 'const_lko_cantt');
END
GO

-- Booth
IF NOT EXISTS (SELECT 1 FROM dbo.booths WHERE id = 'booth_101')
BEGIN
    INSERT INTO dbo.booths (id, booth_number, name, constituency_id, mandal_id, total_voters, address)
    VALUES ('booth_101', '101', 'Primary School Room No. 1, Sadar', 'const_lko_cantt', 'mandal_sadar', 1250, 'Near Sadar Bazaar, Lucknow');
END
GO

-- Super Admin User
IF NOT EXISTS (SELECT 1 FROM dbo.users WHERE email = 'vijaychauhanofficial01@gmail.com')
BEGIN
    INSERT INTO dbo.users (id, email, password_hash, name, role, assigned_booths, rights)
    VALUES (
        'usr_super_admin',
        'vijaychauhanofficial01@gmail.com',
        'hashed_pass_placeholder',
        'Vijay Chauhan',
        'super_admin',
        '["booth_101"]',
        '{"voters":"vcud","users":"vcud","demographics":"vcud","elections":"vcud","surveys":"vcud","volunteers":"vcud","booths":"vcud","benefits":"vcud","finance":"vcud","whatsapp":"vcud","mandals":"vcud","predictions":"vcud"}'
    );
END
GO

-- Sample Voter
IF NOT EXISTS (SELECT 1 FROM dbo.voters WHERE voter_id = 'UP/101/0001')
BEGIN
    INSERT INTO dbo.voters (id, voter_id, name, relation_name, relation_type, gender, age, part_no, sr_no, mobile, house_no, village, caste, is_karyakarta, voting_status, party_inclination, booth_id, mandal_id, constituency_id, state_id, district_id)
    VALUES (
        'voter_001',
        'UP/101/0001',
        'Rajesh Kumar',
        'Ram Lal',
        'Father',
        'Male',
        38,
        '101',
        '1',
        '+91 9876500001',
        '12A/4',
        'Sadar',
        'General',
        0,
        'unvoted',
        'Support',
        'booth_101',
        'mandal_sadar',
        'const_lko_cantt',
        'state_up',
        'dist_lko'
    );
END
GO

-- Sample Election Cycle
IF NOT EXISTS (SELECT 1 FROM dbo.elections WHERE id = 'elec_2026')
BEGIN
    INSERT INTO dbo.elections (id, year, title, description, status)
    VALUES ('elec_2026', 2026, 'Assembly & General Election 2026', 'Target state general elections', 'Active');
END
GO

-- Sample Political Parties
IF NOT EXISTS (SELECT 1 FROM dbo.political_parties WHERE id = 'party_bjp')
BEGIN
    INSERT INTO dbo.political_parties (id, name, abbreviation, color)
    VALUES ('party_bjp', 'Bharatiya Janata Party', 'BJP', '#FF9933');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.political_parties WHERE id = 'party_inc')
BEGIN
    INSERT INTO dbo.political_parties (id, name, abbreviation, color)
    VALUES ('party_inc', 'Indian National Congress', 'INC', '#19AAED');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.political_parties WHERE id = 'party_aap')
BEGIN
    INSERT INTO dbo.political_parties (id, name, abbreviation, color)
    VALUES ('party_aap', 'Aam Aadmi Party', 'AAP', '#0072B0');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.political_parties WHERE id = 'party_sp')
BEGIN
    INSERT INTO dbo.political_parties (id, name, abbreviation, color)
    VALUES ('party_sp', 'Samajwadi Party', 'SP', '#D62728');
END
GO

IF NOT EXISTS (SELECT 1 FROM dbo.political_parties WHERE id = 'party_bsp')
BEGIN
    INSERT INTO dbo.political_parties (id, name, abbreviation, color)
    VALUES ('party_bsp', 'Bahujan Samaj Party', 'BSP', '#203A96');
END
GO

-- Default System Survey Template
IF NOT EXISTS (SELECT 1 FROM dbo.survey_templates WHERE id = 'political_sentiment')
BEGIN
    INSERT INTO dbo.survey_templates (id, name, description, is_system, fields)
    VALUES (
        'political_sentiment',
        'Political Sentiment Template',
        'Standard built-in template for tracking favored party and sentiment scoring.',
        1,
        '[{"id":"favored_party","label":"Favored Party","type":"select","options":[],"required":true},{"id":"sentiment_score","label":"Support Score (1-5 Scale)","type":"scale","required":true},{"id":"key_concerns","label":"Key Voter Concerns","type":"multiselect","options":["Development","Water Supply","Road Quality","Unemployment","Inflation","Electricity","Healthcare","Education"],"required":false}]'
    );
END
GO

PRINT '============================================================================';
PRINT ' Database [nextgencms] and all updated schema tables created successfully!';
PRINT '============================================================================';
GO

