import { models } from '../src/config/database.js';

const VALID_SENIORITIES = [
  'intern', 'trainee', 'junior', 'mid', 'senior',
  'lead', 'manager', 'director', 'executive', 'founder', 'unknown'
];

const VALID_ROLES = [
  'engineering', 'frontend', 'backend', 'fullstack', 'mobile',
  'data', 'ml_ai', 'devops_cloud', 'security', 'product', 'design',
  'sales', 'marketing', 'finance', 'hr_recruiting', 'operations',
  'executive', 'education', 'other', 'unknown'
];

async function validateIntelligence() {
  console.log('Running Connection Intelligence Validation Checks...');

  try {
    const connections = await models.Connection.findAll();
    console.log(`Total connections checked: ${connections.length}`);

    let inconsistentCompany = 0;
    let inconsistentPosition = 0;
    let invalidSeniorities = 0;
    let invalidRoles = 0;
    let invalidScores = 0;
    let missingDerived = 0;

    const hasAlphanumeric = (str) => /[a-zA-Z0-9]/.test(str || '');

    for (const conn of connections) {
      // 1. Company consistency
      if (conn.company && hasAlphanumeric(conn.company) && !conn.normalizedCompany) {
        inconsistentCompany++;
        console.log(`Inconsistent Company: ID ${conn.id} | Raw: "${conn.company}" | Normalized: "${conn.normalizedCompany}"`);
      }

      // 2. Position consistency
      if (conn.title && hasAlphanumeric(conn.title) && !conn.normalizedPosition) {
        inconsistentPosition++;
        console.log(`Inconsistent Title: ID ${conn.id} | Raw: "${conn.title}" | Normalized: "${conn.normalizedPosition}"`);
      }

      // 3. Seniority validation
      if (!VALID_SENIORITIES.includes(conn.seniorityLevel)) {
        invalidSeniorities++;
      }

      // 4. Role validation
      if (!VALID_ROLES.includes(conn.roleCategory)) {
        invalidRoles++;
      }

      // 5. Score bounds
      const cScore = conn.connectionScore;
      const cComp = conn.profileCompleteness;
      if (cScore < 0 || cScore > 100 || cComp < 0 || cComp > 100) {
        invalidScores++;
      }

      // 6. Missing derived fields when source exists
      if ((conn.company && hasAlphanumeric(conn.company) && !conn.normalizedCompany) || 
          (conn.title && hasAlphanumeric(conn.title) && !conn.normalizedPosition) || 
          !conn.seniorityLevel || 
          !conn.roleCategory || 
          !conn.priority) {
        missingDerived++;
      }
    }

    console.log('\n==================================================');
    console.log('VALIDATION RESULT SUMMARY');
    console.log('==================================================');
    console.log(`Inconsistent Company Names:     ${inconsistentCompany}`);
    console.log(`Inconsistent Position Titles:   ${inconsistentPosition}`);
    console.log(`Invalid Seniority Levels:       ${invalidSeniorities}`);
    console.log(`Invalid Role Categories:        ${invalidRoles}`);
    console.log(`Out-of-Bounds Scores:           ${invalidScores}`);
    console.log(`Missing Derived Fields:         ${missingDerived}`);

    const hasErrors = inconsistentCompany > 0 ||
                      inconsistentPosition > 0 ||
                      invalidSeniorities > 0 ||
                      invalidRoles > 0 ||
                      invalidScores > 0 ||
                      missingDerived > 0;

    if (hasErrors) {
      console.error('\nValidation status: FAILED');
      process.exit(1);
    } else {
      console.log('\nValidation status: PASSED (All records consistent)');
      process.exit(0);
    }
  } catch (err) {
    console.error(`Validation failed with error: ${err.message}`);
    process.exit(1);
  }
}

validateIntelligence();
