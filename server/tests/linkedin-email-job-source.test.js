import { LinkedInEmailJobSource } from '../src/services/linkedin-email-job-source.js';

describe('LinkedIn Job Alert Email Parser Test Suite', () => {
  const mockEmailHtml = `
    <html>
      <body>
        <div class="job-card">
          <a href="https://www.linkedin.com/jobs/view/284759381?alertId=xyz">Senior Backend Engineer</a>
          <div>Meta</div>
          <span>Bangalore, India</span>
        </div>
        <br/>
        <div class="job-card">
          <a href="https://www.linkedin.com/comm/jobs/view/983758291?ref=alert">Remote Frontend Developer</a>
          <div>Stripe</div>
          <span>Remote</span>
        </div>
      </body>
    </html>
  `;

  test('LinkedInEmailJobSource.parseLinkedInAlert extracts multiple jobs correctly', () => {
    const source = new LinkedInEmailJobSource();
    const jobs = source.parseLinkedInAlert(mockEmailHtml);

    expect(jobs).toHaveLength(2);

    // Job 1
    expect(jobs[0].title).toBe('Senior Backend Engineer');
    expect(jobs[0].companyName).toBe('Meta');
    expect(jobs[0].location).toBe('Bangalore, India');
    expect(jobs[0].externalJobId).toBe('284759381');
    expect(jobs[0].sourceUrl).toBe('https://www.linkedin.com/jobs/view/284759381?alertId=xyz');

    // Job 2
    expect(jobs[1].title).toBe('Remote Frontend Developer');
    expect(jobs[1].companyName).toBe('Stripe');
    expect(jobs[1].location).toBe('Remote');
    expect(jobs[1].externalJobId).toBe('983758291');
    expect(jobs[1].sourceUrl).toBe('https://www.linkedin.com/comm/jobs/view/983758291?ref=alert');
  });

  test('Gracefully ignores unsubscribe or view job boilerplate links', () => {
    const boilerHtml = `
      <a href="https://www.linkedin.com/jobs/view/123">Unsubscribe</a>
      <a href="https://www.linkedin.com/jobs/view/456">View all jobs</a>
    `;
    const source = new LinkedInEmailJobSource();
    const jobs = source.parseLinkedInAlert(boilerHtml);

    expect(jobs).toHaveLength(0);
  });
});
