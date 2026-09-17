import fs from 'fs';
import { query } from '../src/server/db.ts';

function esc(val: any): string {
  if (val === null || val === undefined) return 'NULL';
  if (typeof val === 'number') return isNaN(val) ? 'NULL' : String(val);
  if (typeof val === 'boolean') return val ? '1' : '0';
  if (val instanceof Date) return `'${val.toISOString()}'`;
  return `'${String(val).replace(/'/g, "''")}'`;
}

async function exportAll() {
  console.log('🔄 Exporting local SQL Server data for Cloudflare D1...');
  const lines: string[] = [];
  lines.push('-- Auto-generated production data export from local database');
  lines.push('PRAGMA foreign_keys = OFF;\n');

  // 1. States
  const states = await query('SELECT * FROM dbo.states').catch(() => []);
  for (const s of states) {
    lines.push(`INSERT OR REPLACE INTO states (id, name, code, created_at) VALUES (${esc(s.id)}, ${esc(s.name)}, ${esc(s.code)}, ${esc(s.created_at)});`);
  }

  // 2. Districts
  const districts = await query('SELECT * FROM dbo.districts').catch(() => []);
  for (const d of districts) {
    lines.push(`INSERT OR REPLACE INTO districts (id, name, state_id, created_at) VALUES (${esc(d.id)}, ${esc(d.name)}, ${esc(d.state_id)}, ${esc(d.created_at)});`);
  }

  // 3. Constituencies
  const constituencies = await query('SELECT * FROM dbo.constituencies').catch(() => []);
  for (const c of constituencies) {
    lines.push(`INSERT OR REPLACE INTO constituencies (id, name, district_id, state_id, category, created_at) VALUES (${esc(c.id)}, ${esc(c.name)}, ${esc(c.district_id)}, ${esc(c.state_id)}, ${esc(c.category)}, ${esc(c.created_at)});`);
  }

  // 4. Mandals
  const mandals = await query('SELECT * FROM dbo.mandals').catch(() => []);
  for (const m of mandals) {
    lines.push(`INSERT OR REPLACE INTO mandals (id, name, mandal_code, president_name, president_phone, voter_count, population, state_id, district_id, constituency_id, created_at) VALUES (${esc(m.id)}, ${esc(m.name)}, ${esc(m.mandal_code)}, ${esc(m.president_name)}, ${esc(m.president_phone)}, ${esc(m.voter_count)}, ${esc(m.population)}, ${esc(m.state_id)}, ${esc(m.district_id)}, ${esc(m.constituency_id)}, ${esc(m.created_at)});`);
  }

  // 5. Mandal Members
  const mandalMembers = await query('SELECT * FROM dbo.mandal_members').catch(() => []);
  for (const mm of mandalMembers) {
    lines.push(`INSERT OR REPLACE INTO mandal_members (id, mandal_id, name, phone, voter_id, designation, category_key, created_at) VALUES (${esc(mm.id)}, ${esc(mm.mandal_id)}, ${esc(mm.name)}, ${esc(mm.phone)}, ${esc(mm.voter_id)}, ${esc(mm.designation)}, ${esc(mm.category_key)}, ${esc(mm.created_at)});`);
  }

  // 6. Booths
  const booths = await query('SELECT * FROM dbo.booths').catch(() => []);
  for (const b of booths) {
    lines.push(`INSERT OR REPLACE INTO booths (id, booth_number, name, constituency_id, mandal_id, total_voters, address, created_at) VALUES (${esc(b.id)}, ${esc(b.booth_number)}, ${esc(b.name)}, ${esc(b.constituency_id)}, ${esc(b.mandal_id)}, ${esc(b.total_voters)}, ${esc(b.address)}, ${esc(b.created_at)});`);
  }

  // 7. Users
  const users = await query('SELECT * FROM dbo.users').catch(() => []);
  for (const u of users) {
    lines.push(`INSERT OR REPLACE INTO users (id, email, password_hash, name, role, assigned_booths, rights, state_id, district_id, constituency_id, booth_id, election_settings, disabled, created_at) VALUES (${esc(u.id)}, ${esc(u.email)}, ${esc(u.password_hash)}, ${esc(u.name)}, ${esc(u.role)}, ${esc(u.assigned_booths)}, ${esc(u.rights)}, ${esc(u.state_id)}, ${esc(u.district_id)}, ${esc(u.constituency_id)}, ${esc(u.booth_id)}, ${esc(u.election_settings)}, ${esc(u.disabled)}, ${esc(u.created_at)});`);
  }

  // 8. Elections
  const elections = await query('SELECT * FROM dbo.elections').catch(() => []);
  for (const e of elections) {
    lines.push(`INSERT OR REPLACE INTO elections (id, year, title, description, status, created_at) VALUES (${esc(e.id)}, ${esc(e.year)}, ${esc(e.title)}, ${esc(e.description)}, ${esc(e.status)}, ${esc(e.created_at)});`);
  }

  // 9. Political Parties
  const parties = await query('SELECT * FROM dbo.political_parties').catch(() => []);
  for (const p of parties) {
    lines.push(`INSERT OR REPLACE INTO political_parties (id, name, abbreviation, logo_url, color, symbol, created_at) VALUES (${esc(p.id)}, ${esc(p.name)}, ${esc(p.abbreviation)}, ${esc(p.logo_url)}, ${esc(p.color)}, ${esc(p.symbol)}, ${esc(p.created_at)});`);
  }

  // 10. Voters
  const voters = await query('SELECT * FROM dbo.voters').catch(() => []);
  for (const v of voters) {
    lines.push(`INSERT OR REPLACE INTO voters (id, voter_id, name, relation_name, relation_type, gender, age, part_no, sr_no, mobile, email, address, house_no, village, caste, occupation, is_karyakarta, voting_status, party_inclination, booth_id, mandal_id, constituency_id, state_id, district_id, created_at, updated_at) VALUES (${esc(v.id)}, ${esc(v.voter_id)}, ${esc(v.name)}, ${esc(v.relation_name)}, ${esc(v.relation_type)}, ${esc(v.gender)}, ${esc(v.age)}, ${esc(v.part_no)}, ${esc(v.sr_no)}, ${esc(v.mobile)}, ${esc(v.email)}, ${esc(v.address)}, ${esc(v.house_no)}, ${esc(v.village)}, ${esc(v.caste)}, ${esc(v.occupation)}, ${esc(v.is_karyakarta)}, ${esc(v.voting_status)}, ${esc(v.party_inclination)}, ${esc(v.booth_id)}, ${esc(v.mandal_id)}, ${esc(v.constituency_id)}, ${esc(v.state_id)}, ${esc(v.district_id)}, ${esc(v.created_at)}, ${esc(v.updated_at)});`);
  }

  // 11. Volunteers
  const volunteers = await query('SELECT * FROM dbo.volunteers').catch(() => []);
  for (const vol of volunteers) {
    lines.push(`INSERT OR REPLACE INTO volunteers (id, voter_doc_id, voter_id, name, aadhar_number, mobile, admin_id, status, tasks, performance_rating, assigned_booth_id, assigned_booth_name, created_at) VALUES (${esc(vol.id)}, ${esc(vol.voter_doc_id)}, ${esc(vol.voter_id)}, ${esc(vol.name)}, ${esc(vol.aadhar_number)}, ${esc(vol.mobile)}, ${esc(vol.admin_id)}, ${esc(vol.status)}, ${esc(vol.tasks)}, ${esc(vol.performance_rating)}, ${esc(vol.assigned_booth_id)}, ${esc(vol.assigned_booth_name)}, ${esc(vol.created_at)});`);
  }

  // 12. Booth Agents
  const boothAgents = await query('SELECT * FROM dbo.booth_agents').catch(() => []);
  for (const ba of boothAgents) {
    lines.push(`INSERT OR REPLACE INTO booth_agents (id, admin_id, booth_id, booth_number, booth_name, agent_volunteer_id, agent_name, agent_aadhar, agent_mobile, designation, created_at) VALUES (${esc(ba.id)}, ${esc(ba.admin_id)}, ${esc(ba.booth_id)}, ${esc(ba.booth_number)}, ${esc(ba.booth_name)}, ${esc(ba.agent_volunteer_id)}, ${esc(ba.agent_name)}, ${esc(ba.agent_aadhar)}, ${esc(ba.agent_mobile)}, ${esc(ba.designation)}, ${esc(ba.created_at)});`);
  }

  // 13. Benefits
  const benefits = await query('SELECT * FROM dbo.benefits').catch(() => []);
  for (const ben of benefits) {
    lines.push(`INSERT OR REPLACE INTO benefits (id, voter_doc_id, voter_id, voter_name, aadhar_number, amount, benefit_name, benefit_type, distribution_date, admin_id, notes, witness_name, witness_voter_id, witness_voter_doc_id, witnesses, created_at) VALUES (${esc(ben.id)}, ${esc(ben.voter_doc_id)}, ${esc(ben.voter_id)}, ${esc(ben.voter_name)}, ${esc(ben.aadhar_number)}, ${esc(ben.amount)}, ${esc(ben.benefit_name)}, ${esc(ben.benefit_type)}, ${esc(ben.distribution_date)}, ${esc(ben.admin_id)}, ${esc(ben.notes)}, ${esc(ben.witness_name)}, ${esc(ben.witness_voter_id)}, ${esc(ben.witness_voter_doc_id)}, ${esc(ben.witnesses)}, ${esc(ben.created_at)});`);
  }

  // 14. Campaign Budgets & Finance Transactions
  const budgets = await query('SELECT * FROM dbo.campaign_budgets').catch(() => []);
  for (const b of budgets) {
    lines.push(`INSERT OR REPLACE INTO campaign_budgets (id, admin_id, total_budget, election_year, allocations, updated_at) VALUES (${esc(b.id)}, ${esc(b.admin_id)}, ${esc(b.total_budget)}, ${esc(b.election_year)}, ${esc(b.allocations)}, ${esc(b.updated_at)});`);
  }

  const txs = await query('SELECT * FROM dbo.finance_transactions').catch(() => []);
  for (const t of txs) {
    lines.push(`INSERT OR REPLACE INTO finance_transactions (id, admin_id, type, title, amount, category, transaction_date, payment_method, donor_name, notes, created_at) VALUES (${esc(t.id)}, ${esc(t.admin_id)}, ${esc(t.type)}, ${esc(t.title)}, ${esc(t.amount)}, ${esc(t.category)}, ${esc(t.transaction_date)}, ${esc(t.payment_method)}, ${esc(t.donor_name)}, ${esc(t.notes)}, ${esc(t.created_at)});`);
  }

  // 15. Surveys & Sentiments
  const templates = await query('SELECT * FROM dbo.survey_templates').catch(() => []);
  for (const t of templates) {
    lines.push(`INSERT OR REPLACE INTO survey_templates (id, name, description, is_system, fields, created_at) VALUES (${esc(t.id)}, ${esc(t.name)}, ${esc(t.description)}, ${esc(t.is_system)}, ${esc(t.fields)}, ${esc(t.created_at)});`);
  }

  const surveys = await query('SELECT * FROM dbo.surveys').catch(() => []);
  for (const s of surveys) {
    lines.push(`INSERT OR REPLACE INTO surveys (id, title, description, election_id, election_year, assigned_to, status, template_id, linked_party_ids, created_at) VALUES (${esc(s.id)}, ${esc(s.title)}, ${esc(s.description)}, ${esc(s.election_id)}, ${esc(s.election_year)}, ${esc(s.assigned_to)}, ${esc(s.status)}, ${esc(s.template_id)}, ${esc(s.linked_party_ids)}, ${esc(s.created_at)});`);
  }

  const sentiments = await query('SELECT * FROM dbo.voter_sentiments').catch(() => []);
  for (const s of sentiments) {
    lines.push(`INSERT OR REPLACE INTO voter_sentiments (id, voter_id, voter_name, election_id, election_year, favored_party_id, favored_party_name, sentiment_score, key_concerns, constituency_id, state_id, district_id, booth_id, mobile, email, aadhar_number, survey_id, survey_title, custom_answers, recorded_by, recorded_by_name, created_at) VALUES (${esc(s.id)}, ${esc(s.voter_id)}, ${esc(s.voter_name)}, ${esc(s.election_id)}, ${esc(s.election_year)}, ${esc(s.favored_party_id)}, ${esc(s.favored_party_name)}, ${esc(s.sentiment_score)}, ${esc(s.key_concerns)}, ${esc(s.constituency_id)}, ${esc(s.state_id)}, ${esc(s.district_id)}, ${esc(s.booth_id)}, ${esc(s.mobile)}, ${esc(s.email)}, ${esc(s.aadhar_number)}, ${esc(s.survey_id)}, ${esc(s.survey_title)}, ${esc(s.custom_answers)}, ${esc(s.recorded_by)}, ${esc(s.recorded_by_name)}, ${esc(s.created_at)});`);
  }

  lines.push('\nPRAGMA foreign_keys = ON;');

  fs.writeFileSync('./seed_production_data.sql', lines.join('\n'), 'utf-8');
  console.log(`✅ Generated seed_production_data.sql with ${lines.length} SQL statements.`);
  process.exit(0);
}

exportAll().catch(err => {
  console.error('❌ Export failed:', err);
  process.exit(1);
});
