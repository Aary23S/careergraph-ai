import { jest } from '@jest/globals';
import { AdzunaJobSource } from '../src/services/job-source.service.js';
import { syncAdzunaJobs } from '../src/services/adzuna-sync.service.js';
import { models } from '../src/config/database.js';
import { resetDatabase, sequelize } from '../src/config/database.js';
import { env } from '../src/config/env.js';

import bcrypt from 'bcryptjs';

describe('Adzuna Ingestion & Sync Test Suite', () => {
  let testUser;

  beforeAll(async () => {
    await resetDatabase();
    env.adzunaEnabled = true;

    const passwordHash = await bcrypt.hash('Password123!', 10);
    testUser = await models.User.create({
      email: 'adzuna@example.com',
      passwordHash,
      name: 'Adzuna Tester',
      isEmailVerified: true
    });

    await models.Profile.create({
      user_id: testUser.id,
      name: 'Adzuna Tester',
      skills: ['react', 'node', 'javascript'],
      targetRoles: ['Frontend Engineer']
    });
  });

  afterAll(async () => {
    if (sequelize) {
      await sequelize.close();
    }
  });

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  test('AdzunaJobSource.fetch processes mock API results successfully', async () => {
    const mockResults = [
      {
        id: 'adzuna-1',
        title: 'Remote React Developer',
        description: 'Build user interfaces with React',
        redirect_url: 'https://adzuna.com/job/1',
        company: { display_name: 'Test Tech' },
        location: { display_name: 'Bangalore, IN' },
        contract_time: 'full_time'
      }
    ];

    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ results: mockResults })
    };

    // Mock global fetch
    const fetchSpy = jest.spyOn(global, 'fetch').mockImplementation(async () => mockResponse);

    const source = new AdzunaJobSource();
    const searchProfile = {
      keywords: 'React',
      location: 'Bangalore',
      remotePreference: 'remote',
      isActive: true
    };

    const results = await source.fetch(searchProfile, 1);
    expect(results).toHaveLength(1);
    expect(results[0].title).toBe('Remote React Developer');

    const parsed = source.parse(results[0]);
    expect(parsed.title).toBe('Remote React Developer');
    expect(parsed.companyName).toBe('Test Tech');
    expect(parsed.sourceUrl).toBe('https://adzuna.com/job/1');
    expect(parsed.externalJobId).toBe('adzuna-1');
    expect(parsed.remoteType).toBe('remote'); // inferred from search query context/location/title
  });

  test('Adzuna Ingestion correctly deduplicates and calculates relevance score', async () => {
    const mockResults = [
      {
        id: 'adzuna-dup-1',
        title: 'Frontend Engineer',
        description: 'React, Node skills needed',
        redirect_url: 'https://adzuna.com/job/dup-1',
        company: { display_name: 'BigTech' },
        location: { display_name: 'Remote' },
        contract_time: 'full_time'
      }
    ];

    const mockResponse = {
      ok: true,
      status: 200,
      json: async () => ({ results: mockResults })
    };

    jest.spyOn(global, 'fetch').mockImplementation(async () => mockResponse);

    // Create search profile
    const profile = await models.JobSearchProfile.create({
      user_id: testUser.id,
      name: 'Frontend Search',
      keywords: 'Frontend Engineer',
      isActive: true
    });

    const summary = await syncAdzunaJobs(testUser.id);
    expect(summary.created).toBe(1);

    // Check if matchScore is populated
    const jobs = await models.Job.findAll({ where: { user_id: testUser.id } });
    expect(jobs).toHaveLength(1);
    expect(jobs[0].matchScore).toBeGreaterThan(0); // matching profile skills 'react'/'node'

    // Sync again to verify deduplication
    const summaryDup = await syncAdzunaJobs(testUser.id);
    expect(summaryDup.created).toBe(0);
    expect(summaryDup.duplicate + summaryDup.updated).toBe(1);
  });

  test('Gracefully handles Adzuna API HTTP 429 Rate Limits', async () => {
    const mockResponse = {
      ok: false,
      status: 429
    };

    jest.spyOn(global, 'fetch').mockImplementation(async () => mockResponse);

    const source = new AdzunaJobSource();
    await expect(source.fetch({ keywords: 'Node' })).rejects.toThrow('Adzuna API rate limit exceeded');
  });

  test('Automatic job purger deletes low-relevance jobs but preserves active applications', async () => {
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

    const lowMatchJob = await models.Job.create({
      user_id: testUser.id,
      title: 'Sales Associate',
      companyName: 'Retail Corp',
      matchScore: 10,
      status: 'new',
      fetchedAt: tenDaysAgo
    });

    const activeLowMatchJob = await models.Job.create({
      user_id: testUser.id,
      title: 'Cashier',
      companyName: 'Retail Corp 2',
      matchScore: 5,
      status: 'saved'
    });
    await models.Application.create({
      user_id: testUser.id,
      job_id: activeLowMatchJob.id,
      status: 'saved'
    });

    const { cleanupExpiredAndLowMatchJobs } = await import('../src/services/job-cleanup.service.js');
    const purgedCount = await cleanupExpiredAndLowMatchJobs(testUser.id);
    
    expect(purgedCount).toBe(1);

    const foundLowMatch = await models.Job.findByPk(lowMatchJob.id);
    expect(foundLowMatch).not.toBeNull();
    expect(foundLowMatch.isArchived).toBe(true);

    const foundActiveLowMatch = await models.Job.findByPk(activeLowMatchJob.id);
    expect(foundActiveLowMatch).not.toBeNull();
  });
});
