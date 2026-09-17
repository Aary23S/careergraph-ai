import assert from 'node:assert';
import { calculateReferralScore } from '../src/services/intelligence.service.js';
import { rankAndLimitConnections } from '../src/services/copilot/context/context-ranker.service.js';

describe('Copilot Relevance & Candidate Ranking Suite', () => {
  it('should return >50 referral score for matching company string', () => {
    const conn = { company: 'Google', title: 'Senior Software Engineer', relationshipStrength: 'high' };
    const job = { company: 'google', title: 'Software Engineering Intern' };

    const score = calculateReferralScore(conn, job);
    assert.ok(score >= 50, `Expected score >= 50 for Google connection, got ${score}`);
  });

  it('should return 0 referral score for non-matching company', () => {
    const conn = { company: 'Microsoft', title: 'Sr Architect', relationshipStrength: 'high' };
    const job = { company: 'google', title: 'Software Engineering Intern' };

    const score = calculateReferralScore(conn, job);
    assert.strictEqual(score, 0, `Expected score 0 for Microsoft connection for a Google job, got ${score}`);
  });

  it('should rank target company insiders first in rankAndLimitConnections', () => {
    const connections = [
      { id: '1', name: 'Chirag Jain', company: 'RCM', title: 'Head of Strategy' },
      { id: '2', name: 'Google Insider', company: 'Google', title: 'Staff Engineer' },
      { id: '3', name: 'Nadya', company: 'Microsoft', title: 'Architect' }
    ];

    const job = { company: 'google', title: 'Software Engineering Intern' };
    const ranked = rankAndLimitConnections(connections, job, { connections: 10 });

    assert.strictEqual(ranked[0].name, 'Google Insider');
    assert.strictEqual(ranked[0].isTargetCompanyInsider, true);
  });
});
