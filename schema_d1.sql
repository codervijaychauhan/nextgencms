-- ============================================================================
-- NextGen CMS - Cloudflare D1 Relational SQLite Schema
-- ============================================================================

-- 1. Core Demographic Hierarchy
CREATE TABLE IF NOT EXISTS states (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_states_name ON states(name);

CREATE TABLE IF NOT EXISTS districts (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    state_id TEXT NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (state_id) REFERENCES states(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_districts_state ON districts(state_id);
CREATE INDEX IF NOT EXISTS idx_districts_name ON districts(name);

CREATE TABLE IF NOT EXISTS constituencies (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    district_id TEXT NOT NULL,
    state_id TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (district_id) REFERENCES districts(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_constituencies_district ON constituencies(district_id);
CREATE INDEX IF NOT EXISTS idx_constituencies_state ON constituencies(state_id);
CREATE INDEX IF NOT EXISTS idx_constituencies_name ON constituencies(name);

CREATE TABLE IF NOT EXISTS mandals (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    mandal_code TEXT NOT NULL,
    president_name TEXT,
    president_phone TEXT,
    voter_count INTEGER DEFAULT 0,
    population INTEGER DEFAULT 0,
    state_id TEXT,
    district_id TEXT,
    constituency_id TEXT,
    admin_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_mandals_admin ON mandals(admin_id);
CREATE INDEX IF NOT EXISTS idx_mandals_constituency ON mandals(constituency_id);
CREATE INDEX IF NOT EXISTS idx_mandals_district ON mandals(district_id);
CREATE INDEX IF NOT EXISTS idx_mandals_state ON mandals(state_id);

CREATE TABLE IF NOT EXISTS mandal_members (
    id TEXT NOT NULL PRIMARY KEY,
    mandal_id TEXT NOT NULL,
    name TEXT NOT NULL,
    phone TEXT,
    voter_id TEXT,
    designation TEXT,
    category_key TEXT NOT NULL,
    admin_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (mandal_id) REFERENCES mandals(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_mandal_members_mandal_cat ON mandal_members(mandal_id, category_key);
CREATE INDEX IF NOT EXISTS idx_mandal_members_admin ON mandal_members(admin_id);
CREATE INDEX IF NOT EXISTS idx_mandal_members_mandal ON mandal_members(mandal_id);

CREATE TABLE IF NOT EXISTS booths (
    id TEXT NOT NULL PRIMARY KEY,
    booth_number TEXT NOT NULL,
    name TEXT NOT NULL,
    constituency_id TEXT NOT NULL,
    mandal_id TEXT,
    total_voters INTEGER DEFAULT 0,
    address TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_booths_constituency ON booths(constituency_id);
CREATE INDEX IF NOT EXISTS idx_booths_mandal ON booths(mandal_id);
CREATE INDEX IF NOT EXISTS idx_booths_number ON booths(booth_number);
CREATE INDEX IF NOT EXISTS idx_booths_const_num ON booths(constituency_id, booth_number);

-- 2. Users / Admins / Role-Based Access Control (RBAC)
CREATE TABLE IF NOT EXISTS users (
    id TEXT NOT NULL PRIMARY KEY,
    email TEXT NOT NULL UNIQUE,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL,
    role TEXT DEFAULT 'volunteer',
    assigned_booths TEXT,
    rights TEXT DEFAULT '{}',
    state_id TEXT,
    district_id TEXT,
    constituency_id TEXT,
    booth_id TEXT,
    parent_admin_id TEXT,
    parent_manager_id TEXT,
    voter_id TEXT,
    voter_doc_id TEXT,
    election_settings TEXT,
    disabled INTEGER NOT NULL DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_parent_admin ON users(parent_admin_id);
CREATE INDEX IF NOT EXISTS idx_users_parent_manager ON users(parent_manager_id);
CREATE INDEX IF NOT EXISTS idx_users_voter ON users(voter_id);

-- 3. Voters Directory
CREATE TABLE IF NOT EXISTS voters (
    id TEXT NOT NULL PRIMARY KEY,
    voter_id TEXT NOT NULL UNIQUE,
    name TEXT NOT NULL,
    relation_name TEXT,
    relation_type TEXT,
    gender TEXT,
    age INTEGER,
    part_no TEXT,
    sr_no TEXT,
    mobile TEXT,
    email TEXT,
    address TEXT,
    house_no TEXT,
    village TEXT,
    caste TEXT,
    occupation TEXT,
    is_karyakarta INTEGER NOT NULL DEFAULT 0,
    voting_status TEXT DEFAULT 'unvoted',
    party_inclination TEXT,
    booth_id TEXT NOT NULL,
    mandal_id TEXT,
    constituency_id TEXT NOT NULL,
    state_id TEXT,
    district_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME
);
CREATE INDEX IF NOT EXISTS idx_voters_epic ON voters(voter_id);
CREATE INDEX IF NOT EXISTS idx_voters_constituency ON voters(constituency_id);
CREATE INDEX IF NOT EXISTS idx_voters_booth ON voters(booth_id);
CREATE INDEX IF NOT EXISTS idx_voters_district ON voters(district_id);
CREATE INDEX IF NOT EXISTS idx_voters_state ON voters(state_id);
CREATE INDEX IF NOT EXISTS idx_voters_mandal ON voters(mandal_id);
CREATE INDEX IF NOT EXISTS idx_voters_mobile ON voters(mobile);
CREATE INDEX IF NOT EXISTS idx_voters_gender ON voters(gender);
CREATE INDEX IF NOT EXISTS idx_voters_caste ON voters(caste);
CREATE INDEX IF NOT EXISTS idx_voters_status ON voters(voting_status);
CREATE INDEX IF NOT EXISTS idx_voters_karyakarta ON voters(is_karyakarta);
CREATE INDEX IF NOT EXISTS idx_voters_created ON voters(created_at);
CREATE INDEX IF NOT EXISTS idx_voters_const_booth ON voters(constituency_id, booth_id);

-- 4. Election Cycles & Political Parties
CREATE TABLE IF NOT EXISTS elections (
    id TEXT NOT NULL PRIMARY KEY,
    year INTEGER NOT NULL,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT DEFAULT 'Upcoming',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_elections_year ON elections(year);

CREATE TABLE IF NOT EXISTS political_parties (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    abbreviation TEXT NOT NULL,
    logo_url TEXT,
    color TEXT,
    symbol TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 5. Surveys, Questionnaires & Voter Assessments
CREATE TABLE IF NOT EXISTS survey_templates (
    id TEXT NOT NULL PRIMARY KEY,
    name TEXT NOT NULL,
    description TEXT,
    is_system INTEGER NOT NULL DEFAULT 0,
    fields TEXT NOT NULL,
    admin_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_survey_templates_admin ON survey_templates(admin_id);

CREATE TABLE IF NOT EXISTS surveys (
    id TEXT NOT NULL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    election_id TEXT NOT NULL,
    election_year INTEGER NOT NULL,
    assigned_to TEXT,
    status TEXT DEFAULT 'Draft',
    template_id TEXT,
    linked_party_ids TEXT,
    admin_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_surveys_admin ON surveys(admin_id);
CREATE INDEX IF NOT EXISTS idx_surveys_election ON surveys(election_id);

CREATE TABLE IF NOT EXISTS voter_assessments (
    id TEXT NOT NULL PRIMARY KEY,
    admin_id TEXT NOT NULL,
    voter_id TEXT NOT NULL,
    voter_name TEXT,
    vital_status TEXT DEFAULT 'Active',
    physical_profile TEXT DEFAULT 'General',
    disability_category TEXT DEFAULT 'None',
    eci_assistance_needed INTEGER DEFAULT 0,
    economic_category TEXT DEFAULT 'APL',
    income_range TEXT DEFAULT '₹15,000 - ₹30,000',
    land_ownership TEXT DEFAULT 'Small Farmer',
    education TEXT DEFAULT 'Unspecified',
    sentiment_score REAL DEFAULT 3.0,
    sentiment TEXT DEFAULT 'Neutral',
    favored_party_id TEXT,
    favored_party_name TEXT,
    key_concerns TEXT,
    notes TEXT,
    is_karyakarta INTEGER DEFAULT 0,
    voted INTEGER DEFAULT 0,
    recorded_by TEXT,
    recorded_by_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_voter_assessments_admin_voter ON voter_assessments(admin_id, voter_id);
CREATE INDEX IF NOT EXISTS idx_voter_assessments_admin ON voter_assessments(admin_id);
CREATE INDEX IF NOT EXISTS idx_voter_assessments_voter ON voter_assessments(voter_id);

CREATE TABLE IF NOT EXISTS voter_sentiments (
    id TEXT NOT NULL PRIMARY KEY,
    admin_id TEXT,
    voter_id TEXT NOT NULL,
    voter_name TEXT NOT NULL,
    election_id TEXT,
    election_year INTEGER,
    favored_party_id TEXT,
    favored_party_name TEXT,
    sentiment_score REAL NOT NULL DEFAULT 3.0,
    key_concerns TEXT,
    constituency_id TEXT,
    state_id TEXT,
    district_id TEXT,
    booth_id TEXT,
    mobile TEXT,
    email TEXT,
    aadhar_number TEXT,
    survey_id TEXT,
    survey_title TEXT,
    custom_answers TEXT,
    recorded_by TEXT NOT NULL,
    recorded_by_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_voter_sentiments_voter ON voter_sentiments(voter_id);
CREATE INDEX IF NOT EXISTS idx_voter_sentiments_admin ON voter_sentiments(admin_id);
CREATE INDEX IF NOT EXISTS idx_voter_sentiments_survey ON voter_sentiments(survey_id);

-- 6. Karyakartas (Volunteers) & Booth Agents
CREATE TABLE IF NOT EXISTS volunteers (
    id TEXT NOT NULL PRIMARY KEY,
    voter_doc_id TEXT NOT NULL,
    voter_id TEXT NOT NULL,
    name TEXT NOT NULL,
    aadhar_number TEXT,
    mobile TEXT,
    admin_id TEXT NOT NULL,
    manager_id TEXT,
    user_id TEXT,
    status TEXT DEFAULT 'Active',
    tasks TEXT,
    performance_rating REAL DEFAULT 5.0,
    assigned_booth_id TEXT,
    assigned_booth_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_volunteers_admin ON volunteers(admin_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_manager ON volunteers(manager_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_user ON volunteers(user_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_voter ON volunteers(voter_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_voter_doc ON volunteers(voter_doc_id);
CREATE INDEX IF NOT EXISTS idx_volunteers_assigned_booth ON volunteers(assigned_booth_id);

CREATE TABLE IF NOT EXISTS booth_agents (
    id TEXT NOT NULL PRIMARY KEY,
    admin_id TEXT NOT NULL,
    booth_id TEXT NOT NULL,
    booth_number TEXT NOT NULL,
    booth_name TEXT NOT NULL,
    agent_volunteer_id TEXT NOT NULL,
    agent_name TEXT NOT NULL,
    agent_aadhar TEXT,
    agent_mobile TEXT,
    designation TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_booth_agents_admin ON booth_agents(admin_id);
CREATE INDEX IF NOT EXISTS idx_booth_agents_booth ON booth_agents(booth_id);

-- 7. Benefits / Welfare Schemes
CREATE TABLE IF NOT EXISTS benefits (
    id TEXT NOT NULL PRIMARY KEY,
    voter_doc_id TEXT NOT NULL,
    voter_id TEXT NOT NULL,
    voter_name TEXT NOT NULL,
    aadhar_number TEXT,
    amount REAL NOT NULL DEFAULT 0.00,
    benefit_name TEXT NOT NULL,
    benefit_type TEXT NOT NULL,
    distribution_date TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    notes TEXT,
    witness_name TEXT,
    witness_voter_id TEXT,
    witness_voter_doc_id TEXT,
    witnesses TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_benefits_voter ON benefits(voter_doc_id);
CREATE INDEX IF NOT EXISTS idx_benefits_voter_id ON benefits(voter_id);
CREATE INDEX IF NOT EXISTS idx_benefits_admin ON benefits(admin_id);

-- 8. Campaign Budgets & Financial Transactions
CREATE TABLE IF NOT EXISTS campaign_budgets (
    id TEXT NOT NULL PRIMARY KEY,
    admin_id TEXT NOT NULL,
    total_budget REAL NOT NULL DEFAULT 0.00,
    election_year TEXT NOT NULL,
    allocations TEXT NOT NULL,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_budgets_admin ON campaign_budgets(admin_id);

CREATE TABLE IF NOT EXISTS finance_transactions (
    id TEXT NOT NULL PRIMARY KEY,
    admin_id TEXT NOT NULL,
    type TEXT NOT NULL,
    title TEXT NOT NULL,
    amount REAL NOT NULL DEFAULT 0.00,
    category TEXT NOT NULL,
    transaction_date TEXT NOT NULL,
    payment_method TEXT NOT NULL,
    donor_name TEXT,
    notes TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_finance_admin ON finance_transactions(admin_id);
CREATE INDEX IF NOT EXISTS idx_finance_date ON finance_transactions(transaction_date);
CREATE INDEX IF NOT EXISTS idx_finance_type ON finance_transactions(type);

-- 9. WhatsApp Campaigns & Meta Configs
CREATE TABLE IF NOT EXISTS whatsapp_configs (
    id TEXT NOT NULL PRIMARY KEY,
    admin_id TEXT NOT NULL,
    tenant_type TEXT NOT NULL,
    vendor_name TEXT NOT NULL,
    phone_number_id TEXT,
    waba_id TEXT,
    access_token TEXT,
    phone_number TEXT NOT NULL,
    status TEXT DEFAULT 'disconnected',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wa_config_admin ON whatsapp_configs(admin_id);

CREATE TABLE IF NOT EXISTS whatsapp_templates (
    id TEXT NOT NULL PRIMARY KEY,
    admin_id TEXT NOT NULL,
    name TEXT NOT NULL,
    language TEXT DEFAULT 'en_US',
    category TEXT NOT NULL,
    header_type TEXT DEFAULT 'NONE',
    body_text TEXT NOT NULL,
    footer_text TEXT,
    buttons TEXT,
    status TEXT DEFAULT 'PENDING',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wa_templates_admin ON whatsapp_templates(admin_id);

CREATE TABLE IF NOT EXISTS whatsapp_broadcast_logs (
    id TEXT NOT NULL PRIMARY KEY,
    campaign_name TEXT NOT NULL,
    template_id TEXT NOT NULL,
    admin_id TEXT NOT NULL,
    recipient_phone TEXT NOT NULL,
    recipient_name TEXT,
    status TEXT NOT NULL,
    error_message TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_wa_broadcast_admin ON whatsapp_broadcast_logs(admin_id);

-- ============================================================================
-- 10. Seed Initial Data (Owner Super Admin & Defaults)
-- ============================================================================

INSERT OR IGNORE INTO users (
    id, email, password_hash, name, role, rights, disabled
) VALUES (
    'admin_root_1',
    'vijaychauhanofficial01@gmail.com',
    '507fa7a0305f6ceeeeb4ebf32b851bc0ba7599cb51c05d762e15d86241c09eb6',
    'Vijay Chauhan',
    'super_admin',
    '{"voters":"vcud","volunteers":"vcud","mandals":"vcud","booths":"vcud","benefits":"vcud","finance":"vcud","whatsapp":"vcud","surveys":"vcud","predictions":"vcud","users":"vcud","survey_campaigns":"vcud","demographics":"vcud","elections":"vcud","sentiment_comparison":"vcud"}',
    0
);

INSERT OR IGNORE INTO elections (id, year, title, description, status) 
VALUES ('elec_2026', 2026, '2026 Assembly General Elections', 'State Assembly General Elections 2026', 'Active');

INSERT OR IGNORE INTO political_parties (id, name, abbreviation, color, symbol) 
VALUES 
('party_1', 'Bharatiya Janata Party', 'BJP', '#f97316', '🪷'),
('party_2', 'Indian National Congress', 'INC', '#0284c7', '✋'),
('party_3', 'Aam Aadmi Party', 'AAP', '#eab308', '🧹'),
('party_4', 'Independent', 'IND', '#64748b', '🗳️');

