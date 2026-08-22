export class JobSource {
  async fetch(inputData) {
    throw new Error('fetch method not implemented');
  }

  validate(rawJob) {
    if (!rawJob.title) throw new Error('Job title is required');
    if (!rawJob.companyName) throw new Error('Company name is required');
    return true;
  }

  parse(rawJob) {
    return {
      title: rawJob.title.trim(),
      companyName: rawJob.companyName.trim(),
      description: rawJob.description ? rawJob.description.trim() : '',
      location: rawJob.location ? rawJob.location.trim() : 'Remote',
      sourceUrl: rawJob.sourceUrl || '',
      externalJobId: rawJob.externalJobId || '',
      sourceMetadata: rawJob.sourceMetadata || {},
      fetchedAt: rawJob.fetchedAt ? new Date(rawJob.fetchedAt) : new Date(),
      provider: rawJob.provider || 'unknown',
      employmentType: rawJob.employmentType || null,
      remoteType: rawJob.remoteType || null,
      experienceLevel: rawJob.experienceLevel || null
    };
  }
}

export class ManualSource extends JobSource {
  async fetch(inputData) {
    return {
      ...inputData,
      source: 'manual',
      provider: inputData.provider || 'manual',
      fetchedAt: new Date()
    };
  }
}

export class APIJobSource extends JobSource {
  async fetch(inputData) {
    return {
      ...inputData,
      source: 'api',
      provider: inputData.provider || 'api_integration',
      fetchedAt: new Date()
    };
  }
}

export class EmailAlertSource extends JobSource {
  async fetch(inputData) {
    return {
      ...inputData,
      source: 'email',
      provider: inputData.provider || 'email_alert',
      fetchedAt: new Date()
    };
  }
}

export class CompanyCareerSource extends JobSource {
  async fetch(inputData) {
    return {
      ...inputData,
      source: 'career_page',
      provider: inputData.provider || 'company_ats',
      fetchedAt: new Date()
    };
  }
}
