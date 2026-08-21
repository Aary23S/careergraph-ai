import {
  normalizeCompany,
  normalizePosition,
  classifySeniority,
  classifyRoleCategory,
  calculateProfileCompleteness,
  calculateConnectionScore,
  determinePriority
} from '../src/services/connection-intelligence.service.js';

describe('CareerGraph Connection Intelligence Phase 2.5-B Tests', () => {
  describe('Company Normalization', () => {
    it('returns null for null, empty or undefined', () => {
      expect(normalizeCompany(null)).toBeNull();
      expect(normalizeCompany(undefined)).toBeNull();
      expect(normalizeCompany('')).toBeNull();
      expect(normalizeCompany('   ')).toBeNull();
    });

    it('trims and converts to lowercase comparison form', () => {
      expect(normalizeCompany('  Amazon Web Services ')).toBe('amazon web services');
      expect(normalizeCompany('Google LLC')).toBe('google');
      expect(normalizeCompany('Google, Inc.')).toBe('google');
    });

    it('collapses whitespaces and normalizes punctuation', () => {
      expect(normalizeCompany('Microsoft  Corp.')).toBe('microsoft');
      expect(normalizeCompany('Acme, Co.  ')).toBe('acme');
    });
  });

  describe('Position Normalization', () => {
    it('normalizes common abbreviations and converts to lowercase', () => {
      expect(normalizePosition('Sr. Software Engineer')).toBe('senior software engineer');
      expect(normalizePosition('Jr. SDE')).toBe('junior software engineer');
      expect(normalizePosition('VP of Product')).toBe('vice president of product');
      expect(normalizePosition('engineering mgr')).toBe('engineering manager');
    });

    it('removes seniority suffixes II, III, IV, V', () => {
      expect(normalizePosition('Software Engineer II')).toBe('software engineer');
      expect(normalizePosition('SDE III')).toBe('software engineer');
    });
  });

  describe('Seniority Classification', () => {
    it('classifies standard titles correctly', () => {
      expect(classifySeniority('Intern Engineer')).toBe('intern');
      expect(classifySeniority('Apprentice developer')).toBe('trainee');
      expect(classifySeniority('Junior Architect')).toBe('junior');
      expect(classifySeniority('Associate dev')).toBe('junior');
      expect(classifySeniority('Software Developer')).toBe('mid');
      expect(classifySeniority('Senior Developer')).toBe('senior');
      expect(classifySeniority('Lead Developer')).toBe('lead');
      expect(classifySeniority('Engineering Manager')).toBe('manager');
      expect(classifySeniority('Director of Security')).toBe('director');
      expect(classifySeniority('VP of Operations')).toBe('executive');
      expect(classifySeniority('Co-Founder')).toBe('founder');
    });
  });

  describe('Role Category', () => {
    it('maps specific categories with precedence over engineering', () => {
      expect(classifyRoleCategory('React Developer')).toBe('frontend');
      expect(classifyRoleCategory('Backend Engineer')).toBe('backend');
      expect(classifyRoleCategory('Full Stack Developer')).toBe('fullstack');
      expect(classifyRoleCategory('Flutter Developer')).toBe('mobile');
      expect(classifyRoleCategory('ML Engineer')).toBe('ml_ai');
      expect(classifyRoleCategory('DevOps Engineer')).toBe('devops_cloud');
      expect(classifyRoleCategory('Security Engineer')).toBe('security');
      expect(classifyRoleCategory('Recruiter')).toBe('hr_recruiting');
    });
  });

  describe('Profile Completeness & Connection Score', () => {
    it('keeps score within 0 to 100 boundaries', () => {
      const completeness = calculateProfileCompleteness({});
      expect(completeness).toBe(0);

      const score = calculateConnectionScore(completeness, 'weak', 'intern');
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(100);

      expect(determinePriority('executive', 'strong')).toBe('high');
      expect(determinePriority('intern', 'weak')).toBe('low');
    });
  });
});
