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

export class AdzunaJobSource extends JobSource {
  async fetch(searchProfile, page = 1) {
    if (searchProfile && searchProfile.title) {
      return searchProfile;
    }

    const { env } = await import('../config/env.js');
    if (!env.adzunaEnabled) {
      throw new Error('Adzuna job source is disabled');
    }
    const appId = env.adzunaAppId;
    const appKey = env.adzunaAppKey;
    const country = env.adzunaCountry || 'in';

    const url = new URL(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`);
    url.searchParams.append('app_id', appId);
    url.searchParams.append('app_key', appKey);
    url.searchParams.append('content-type', 'application/json');
    url.searchParams.append('results_per_page', '50');

    let what = searchProfile.keywords || '';
    if (searchProfile.remotePreference === 'remote' && !what.toLowerCase().includes('remote')) {
      what += ' remote';
    }
    if (what) {
      url.searchParams.append('what', what);
    }
    if (searchProfile.location) {
      url.searchParams.append('where', searchProfile.location);
    }
    if (searchProfile.excludedKeywords) {
      url.searchParams.append('what_exclude', searchProfile.excludedKeywords);
    }
    if (searchProfile.employmentType) {
      if (searchProfile.employmentType === 'full-time') {
        url.searchParams.append('full_time', '1');
      } else if (searchProfile.employmentType === 'part-time') {
        url.searchParams.append('part_time', '1');
      }
    }

    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' }
    });

    if (response.status === 429) {
      throw new Error('Adzuna API rate limit exceeded');
    }

    if (!response.ok) {
      throw new Error(`Adzuna API failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.results || [];
  }

  parse(rawJob) {
    if (rawJob && rawJob.provider === 'adzuna') {
      return rawJob;
    }

    return {
      title: rawJob.title ? rawJob.title.replace(/<\/?[^>]+(>|$)/g, "").trim() : 'Untitled Job',
      companyName: rawJob.company?.display_name ? rawJob.company.display_name.trim() : 'Unknown Company',
      description: rawJob.description ? rawJob.description.replace(/<\/?[^>]+(>|$)/g, "").trim() : '',
      location: rawJob.location?.display_name ? rawJob.location.display_name.trim() : 'Remote',
      sourceUrl: rawJob.redirect_url || '',
      externalJobId: String(rawJob.id || ''),
      sourceMetadata: {
        adzunaCategory: rawJob.category?.label || null,
        salaryMin: rawJob.salary_min || null,
        salaryMax: rawJob.salary_max || null,
        latitude: rawJob.latitude || null,
        longitude: rawJob.longitude || null
      },
      fetchedAt: new Date(),
      provider: 'adzuna',
      source: 'adzuna',
      employmentType: rawJob.contract_time === 'full_time' ? 'full-time' : (rawJob.contract_time === 'part_time' ? 'part-time' : null),
      remoteType: (rawJob.location?.display_name?.toLowerCase().includes('remote') || rawJob.title?.toLowerCase().includes('remote')) ? 'remote' : 'onsite',
      experienceLevel: null
    };
  }
}

export class HimalayasJobSource extends JobSource {
  async fetch(limit = 100, offset = 0) {
    const url = new URL('https://himalayas.app/jobs/api');
    url.searchParams.append('limit', limit);
    url.searchParams.append('offset', offset);

    const response = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' }
    });

    if (!response.ok) {
      if (response.status === 429) {
        throw new Error('Himalayas API rate limit exceeded');
      }
      throw new Error(`Himalayas API failed with status ${response.status}`);
    }

    const data = await response.json();
    return data.jobs || [];
  }

  parse(rawJob) {
    if (rawJob && rawJob.provider === 'himalayas') {
      return rawJob;
    }

    let employmentType = null;
    if (rawJob.employmentType) {
      const typeLower = rawJob.employmentType.toLowerCase();
      if (typeLower.includes('full')) employmentType = 'full-time';
      else if (typeLower.includes('part')) employmentType = 'part-time';
      else if (typeLower.includes('contract')) employmentType = 'contract';
    }

    let experienceLevel = null;
    if (rawJob.seniority && rawJob.seniority.length > 0) {
      const senLower = rawJob.seniority[0].toLowerCase();
      if (senLower.includes('senior') || senLower.includes('lead')) experienceLevel = 'senior';
      else if (senLower.includes('mid')) experienceLevel = 'mid';
      else if (senLower.includes('junior') || senLower.includes('entry')) experienceLevel = 'junior';
    }

    return {
      title: rawJob.title ? rawJob.title.trim() : 'Untitled Job',
      companyName: rawJob.companyName ? rawJob.companyName.trim() : 'Unknown Company',
      description: rawJob.description ? rawJob.description.trim() : '',
      location: rawJob.locationRestrictions?.length ? rawJob.locationRestrictions.join(', ') : 'Remote',
      sourceUrl: rawJob.applicationLink || rawJob.guid || '',
      externalJobId: String(rawJob.guid || ''),
      sourceMetadata: {
        categories: rawJob.categories || [],
        salaryMin: rawJob.minSalary || null,
        salaryMax: rawJob.maxSalary || null,
        currency: rawJob.currency || null,
        salaryPeriod: rawJob.salaryPeriod || null
      },
      postedDate: rawJob.pubDate ? new Date(rawJob.pubDate * 1000).toISOString().slice(0, 10) : null,
      fetchedAt: new Date(),
      provider: 'himalayas',
      source: 'himalayas',
      employmentType: employmentType,
      remoteType: 'remote',
      experienceLevel: experienceLevel
    };
  }
}
