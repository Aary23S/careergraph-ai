import { EmailAlertSource } from './job-source.service.js';

export class LinkedInEmailJobSource extends EmailAlertSource {
  /**
   * Parses the HTML body of a LinkedIn job alert email and extracts multiple job cards.
   * 
   * @param {string} htmlBody Raw HTML of the Gmail message
   * @returns {Array<Object>} List of normalized job inputs
   */
  parseLinkedInAlert(htmlBody) {
    const jobs = [];
    const linkRegex = /<a[^>]+href="([^"]*\/jobs\/view\/(\d+)[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    const seenIds = new Set();

    while ((match = linkRegex.exec(htmlBody)) !== null) {
      const url = match[1].trim();
      const jobId = match[2];
      let title = match[3].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

      // Skip logo/image anchors that don't contain any text
      if (!title) {
        continue;
      }

      // Skip invalid entries or tracking links
      if (!jobId || seenIds.has(jobId) || title.toLowerCase().includes('unsubscribe') || title.toLowerCase().includes('see more') || title.toLowerCase().includes('view')) {
        continue;
      }
      seenIds.add(jobId);

      // Snippet following the anchor tag
      let remainingHtml = htmlBody.substring(match.index + match[0].length, match.index + match[0].length + 1500);
      const lastLeft = remainingHtml.lastIndexOf('<');
      const lastRight = remainingHtml.lastIndexOf('>');
      if (lastLeft > lastRight) {
        remainingHtml = remainingHtml.substring(0, lastLeft);
      }
      
      // Clean tags but keep layout breaks to help splitting lines
      let cleanText = remainingHtml
        .replace(/<\/div>/gi, '\n')
        .replace(/<\/p>/gi, '\n')
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/<\/span>/gi, '\n')
        .replace(/<\/td>/gi, '\n')
        .replace(/<[^>]+>/g, '')
        .replace(/&nbsp;/gi, ' ');
      
      const lines = cleanText
        .split('\n')
        .map(l => l.trim())
        .filter(l => l.length > 1 && !l.includes('•') && !l.includes('Apply') && !l.includes('View job') && !l.toLowerCase().includes('actively hiring') && !l.toLowerCase().includes('hiring'));

      const companyName = (lines[0] || 'LinkedIn Connection').substring(0, 255);
      const location = (lines[1] || 'Remote').substring(0, 255);

      jobs.push({
        title: title.substring(0, 255),
        companyName,
        location,
        sourceUrl: url,
        externalJobId: jobId,
        provider: 'linkedin',
        source: 'linkedin_email',
        description: `Ingested from LinkedIn Job Alert email.\nTitle: ${title}\nCompany: ${companyName}\nLocation: ${location}`,
        fetchedAt: new Date()
      });
    }

    return jobs;
  }
}
