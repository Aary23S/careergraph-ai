import request from 'supertest';
import { createApp } from '../src/app.js';
import { sequelize, resetDatabase, models } from '../src/config/database.js';
import { syncProfileFromResumeEnrichment } from '../src/services/profile-resume-sync.service.js';

function makeEnrichment(overrides = {}) {
  return {
    status: 'completed',
    resumeId: '00000000-0000-0000-0000-000000000001',
    professionalTitle: 'Backend Developer',
    careerLevel: 'mid',
    skills: ['Node.js', 'React'],
    canonicalSkills: ['Node.js', 'React'],
    technicalDomains: ['backend'],
    experience: [
      { company: 'Acme', title: 'Engineer', startDate: '2020-01', endDate: '2023-01', isCurrent: false, responsibilities: [] },
    ],
    projects: [],
    education: [{ institution: 'MIT', degree: 'BSc', field: 'CS', startYear: '2016', endYear: '2020' }],
    certifications: [{ name: 'AWS SA', issuer: 'Amazon', issueDate: '2022' }],
    achievements: [],
    summary: 'Experienced backend developer.',
    confidence: 0.9,
    contactInfo: { email: null, phone: '555-1234', linkedin: 'linkedin.com/in/x', github: null, portfolio: null, otherLinks: [] },
    totalExperienceYears: 3,
    userCorrectedSkills: null,
    userCorrectedProfessionalTitle: null,
    userCorrectedCareerLevel: null,
    userCorrectedSummary: null,
    ...overrides,
  };
}

let app;

beforeAll(async () => {
  app = createApp();
  await resetDatabase();
});

afterAll(async () => {
  await sequelize.close();
});

describe('Profile auto-sync from resume enrichment', () => {
  let userId;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'sync@example.com', password: 'Password123!', name: 'Sync User' });
    userId = res.body.data.user.id;
  });

  it('is a no-op for a user with no Profile row at all', async () => {
    const result = await syncProfileFromResumeEnrichment('00000000-0000-0000-0000-000000000000', makeEnrichment());
    expect(result).toBeNull();
  });

  it('is a no-op when the enrichment is not completed', async () => {
    // Registration already auto-creates an (empty) Profile for userId; the
    // not-completed check must short-circuit before ever reading it.
    const result = await syncProfileFromResumeEnrichment(userId, makeEnrichment({ status: 'processing' }));
    expect(result).toBeNull();
  });

  it('first sync populates empty scalar and array fields', async () => {
    const profile = await syncProfileFromResumeEnrichment(userId, makeEnrichment());
    expect(profile.professionalTitle).toBe('Backend Developer');
    expect(profile.careerLevel).toBe('mid');
    expect(profile.experience).toBe('3');
    expect(profile.bio).toBe('Experienced backend developer.');
    expect(profile.skills).toEqual(expect.arrayContaining(['Node.js', 'React']));
    expect(profile.education.length).toBe(1);
    expect(profile.certifications.length).toBe(1);
    expect(profile.links.linkedin).toBe('linkedin.com/in/x');
    expect(profile.phone).toBe('555-1234');
    expect(profile.resumeConfidence).toBe(0.9);
    expect(profile.lastResumeSyncedAt).toBeTruthy();
  });

  it('does not clobber a manually-edited scalar field on a later sync', async () => {
    let profile = await models.Profile.findOne({ where: { user_id: userId } });
    await profile.update({ professionalTitle: 'Staff Engineer (my own edit)' });

    await syncProfileFromResumeEnrichment(userId, makeEnrichment({ professionalTitle: 'Senior Backend Developer' }));

    profile = await models.Profile.findOne({ where: { user_id: userId } });
    expect(profile.professionalTitle).toBe('Staff Engineer (my own edit)');
  });

  it('does refresh a scalar field the user never touched since the last sync', async () => {
    let profile = await models.Profile.findOne({ where: { user_id: userId } });
    expect(profile.careerLevel).toBe('mid');

    await syncProfileFromResumeEnrichment(userId, makeEnrichment({ careerLevel: 'senior' }));

    profile = await models.Profile.findOne({ where: { user_id: userId } });
    expect(profile.careerLevel).toBe('senior');
  });

  it('never overwrites bio once it is non-empty', async () => {
    await syncProfileFromResumeEnrichment(userId, makeEnrichment({ summary: 'A totally different bio.' }));
    const profile = await models.Profile.findOne({ where: { user_id: userId } });
    expect(profile.bio).toBe('Experienced backend developer.');
  });

  it('merges education and certifications instead of overwriting', async () => {
    await syncProfileFromResumeEnrichment(userId, makeEnrichment({
      education: [{ institution: 'Stanford', degree: 'MSc', field: 'CS', startYear: '2020', endYear: '2022' }],
      certifications: [{ name: 'Kubernetes Administrator', issuer: 'CNCF', issueDate: '2023' }],
    }));
    const profile = await models.Profile.findOne({ where: { user_id: userId } });
    expect(profile.education.length).toBe(2);
    expect(profile.certifications.length).toBe(2);
  });
});

describe('Profile auto-sync trigger points (HTTP integration)', () => {
  let userId2;
  let token2;
  let resumeY;

  beforeAll(async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'sync2@example.com', password: 'Password123!', name: 'Sync Two' });
    token2 = res.body.data.tokens.accessToken;
    userId2 = res.body.data.user.id;

    await models.Resume.create({
      user_id: userId2,
      fileName: 'x.pdf',
      storageKey: 'k1',
      contentType: 'application/pdf',
      sizeBytes: 10,
      isActive: true,
      version: 1,
    });
    resumeY = await models.Resume.create({
      user_id: userId2,
      fileName: 'y.pdf',
      storageKey: 'k2',
      contentType: 'application/pdf',
      sizeBytes: 10,
      isActive: false,
      version: 1,
    });

    await models.ResumeAiEnrichment.create({
      resumeId: resumeY.id,
      provider: 'mock',
      model: 'mock',
      status: 'completed',
      inputHash: 'hashY',
      professionalTitle: 'Data Scientist',
      careerLevel: 'lead',
      skills: ['Python'],
      canonicalSkills: ['Python'],
      technicalDomains: [],
      experience: [],
      projects: [],
      education: [],
      certifications: [],
      achievements: [],
      summary: '',
      confidence: 0.8,
      contactInfo: {},
      totalExperienceYears: 5,
    });
  });

  it('syncs Profile when a resume with a completed enrichment is switched to active', async () => {
    const res = await request(app)
      .patch(`/api/resumes/${resumeY.id}/active`)
      .set('Authorization', `Bearer ${token2}`)
      .send({ isActive: true });
    expect(res.status).toBe(200);

    const profile = await models.Profile.findOne({ where: { user_id: userId2 } });
    expect(profile.professionalTitle).toBe('Data Scientist');
    expect(profile.careerLevel).toBe('lead');
  });
});
