import { models } from '../config/database.js';
import { emailService } from './email.service.js';

export async function executeAsyncExport(userId, userEmail) {
  try {
    const jobs = await models.Job.findAll({ 
      where: { user_id: userId },
      attributes: ['id', 'title', 'companyName', 'location', 'status', 'matchScore', 'opportunityScore', 'isArchived', 'createdAt'],
      raw: true 
    });
    
    let emailBody = `Hello,\n\nYour requested data export is complete.\n\n`;
    emailBody += `Total Records Exported: ${jobs.length}\n\n`;
    
    if (jobs.length > 0) {
      const headers = Object.keys(jobs[0]).join(',');
      const rows = jobs.map(j => Object.values(j).map(v => `"${(v || '').toString().replace(/"/g, '""')}"`).join(','));
      const csv = [headers, ...rows].join('\n');
      
      // In a full production system, upload to S3 and email a presigned URL.
      // For now, we will simulate this by logging the generation and sending a notice.
      console.log(`[ExportService] Generated CSV for user ${userId} (${csv.length} bytes)`);
      emailBody += `Your CSV file has been securely generated. (Simulated attachment link would go here).\n`;
    } else {
      emailBody += `No jobs were found in your account.\n`;
    }

    emailBody += `\nBest regards,\nCareerGraph Team`;

    await emailService.provider.sendEmail(userEmail, "Your CareerGraph Data Export", emailBody);
  } catch (err) {
    console.error(`[ExportService] Failed to export data for user ${userId}:`, err);
  }
}
