import { execSync } from 'child_process';
import { query, execute } from '../src/server/db.ts';

async function pullFromD1() {
  console.log('🔄 Fetching production voter_sentiments from Cloudflare D1...');
  try {
    const rawOutput = execSync(
      'npx wrangler d1 execute nextgencms --remote --command="SELECT * FROM voter_sentiments;" --json',
      { encoding: 'utf8' }
    );

    const parsed = JSON.parse(rawOutput);
    const rows = parsed[0]?.results || [];
    console.log(`📊 Found ${rows.length} sentiment records in Cloudflare D1.`);

    if (rows.length === 0) {
      console.log('No records found in remote D1.');
      return;
    }

    let syncedCount = 0;
    for (const r of rows) {
      const exists = await query(
        'SELECT id FROM dbo.voter_sentiments WHERE id = @id OR (voter_id = @voterId AND COALESCE(survey_id, \'\') = @surveyId)',
        { id: r.id, voterId: String(r.voter_id || ''), surveyId: String(r.survey_id || '') }
      );

      if (exists.length === 0) {
        await execute(
          `INSERT INTO dbo.voter_sentiments (
            id, voter_id, voter_name, election_id, election_year,
            favored_party_id, favored_party_name, sentiment_score,
            key_concerns, constituency_id, state_id, district_id, booth_id,
            mobile, email, aadhar_number, survey_id, survey_title,
            custom_answers, recorded_by, recorded_by_name, created_at
          ) VALUES (
            @id, @voter_id, @voter_name, @election_id, @election_year,
            @favored_party_id, @favored_party_name, @sentiment_score,
            @key_concerns, @constituency_id, @state_id, @district_id, @booth_id,
            @mobile, @email, @aadhar_number, @survey_id, @survey_title,
            @custom_answers, @recorded_by, @recorded_by_name, @created_at
          )`,
          {
            id: r.id,
            voter_id: String(r.voter_id || '0'),
            voter_name: r.voter_name || 'Voter',
            election_id: r.election_id || '1',
            election_year: parseInt(r.election_year, 10) || 2026,
            favored_party_id: r.favored_party_id || 'none',
            favored_party_name: r.favored_party_name || '',
            sentiment_score: parseFloat(r.sentiment_score) || 3.0,
            key_concerns: r.key_concerns || '[]',
            constituency_id: r.constituency_id || null,
            state_id: r.state_id || null,
            district_id: r.district_id || null,
            booth_id: r.booth_id || null,
            mobile: r.mobile || null,
            email: r.email || null,
            aadhar_number: r.aadhar_number || null,
            survey_id: r.survey_id || null,
            survey_title: r.survey_title || null,
            custom_answers: r.custom_answers || '{}',
            recorded_by: r.recorded_by || 'admin',
            recorded_by_name: r.recorded_by_name || 'Administrator',
            created_at: r.created_at || new Date().toISOString()
          }
        );
        syncedCount++;
      }
    }

    console.log(`✅ Successfully synced ${syncedCount} new survey sentiment records into local SQL Server!`);
  } catch (err: any) {
    console.error('❌ Error pulling data from D1:', err?.message || err);
  }
}

pullFromD1().then(() => process.exit(0));
