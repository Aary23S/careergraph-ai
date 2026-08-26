import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

export class EmailProvider {
  async sendEmail(to, subject, body) {
    throw new Error(`Method not implemented: sendEmail(${to}, ${subject}, ${body})`);
  }
}

export class ConsoleEmailProvider extends EmailProvider {
  async sendEmail(to, subject, body) {
    console.log(`[EMAIL SEND SIMULATOR]`);
    console.log(`To: ${to}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body:\n${body}`);
    console.log(`[END EMAIL SIMULATOR]`);
    return { success: true, messageId: `simulated-${Date.now()}` };
  }
}

export class SmtpEmailProvider extends EmailProvider {
  constructor() {
    super();
    this.transporter = nodemailer.createTransport({
      host: env.smtpHost,
      port: env.smtpPort,
      secure: env.smtpPort === 465,
      auth: env.smtpUser && env.smtpPass ? {
        user: env.smtpUser,
        pass: env.smtpPass
      } : undefined
    });
  }

  async sendEmail(to, subject, body) {
    const info = await this.transporter.sendMail({
      from: env.smtpFrom,
      to,
      subject,
      text: body
    });
    return { success: true, messageId: info.messageId };
  }
}

export class EmailService {
  constructor(provider = null) {
    if (provider) {
      this.provider = provider;
    } else if (env.smtpHost) {
      this.provider = new SmtpEmailProvider();
    } else {
      this.provider = new ConsoleEmailProvider();
    }
  }

  async sendDigest(to, username, digestData) {
    const { topJobs, topReferrals, pendingFollowUps } = digestData;

    let body = `Hello ${username},\n\n`;
    body += `Here is your CareerGraph Intelligence Daily Digest for today.\n\n`;

    body += `==================================================\n`;
    body += `🔥 TOP JOB OPPORTUNITIES\n`;
    body += `==================================================\n`;
    if (!topJobs || topJobs.length === 0) {
      body += `No high-scoring jobs found. Go track some job cards!\n`;
    } else {
      topJobs.forEach(job => {
        body += `- ${job.title} at ${job.companyName} (${job.location || 'Remote'})\n`;
        body += `  Match Score: ${job.matchScore}/100 | Opp Score: ${job.opportunityScore}/100\n`;
        body += `  Rec Action: ${job.recommendedAction}\n\n`;
      });
    }

    body += `==================================================\n`;
    body += `🤝 TOP REFERRAL LEADS\n`;
    body += `==================================================\n`;
    if (!topReferrals || topReferrals.length === 0) {
      body += `No potential referral connections at your target companies yet.\n`;
    } else {
      topReferrals.forEach(ref => {
        body += `- ${ref.name} (${ref.title || 'Contact'}) at ${ref.company}\n`;
        body += `  Referral Score: ${ref.referralScore}/100 | Relationship: ${ref.relationshipStrength || 'Weak'}\n\n`;
      });
    }

    body += `==================================================\n`;
    body += `⏰ PENDING CRM FOLLOW-UPS\n`;
    body += `==================================================\n`;
    if (!pendingFollowUps || pendingFollowUps.length === 0) {
      body += `All caught up! No follow-ups scheduled for today.\n`;
    } else {
      pendingFollowUps.forEach(conn => {
        body += `- ${conn.name} (Due: ${conn.nextFollowUpDate})\n`;
        body += `  ${conn.title || ''} at ${conn.company || ''}\n\n`;
      });
    }

    body += `Have a productive day!\n`;
    body += `The CareerGraph AI Team`;

    const subject = `CareerGraph Digest: ${topJobs?.length || 0} New Jobs & Referral Opportunities`;
    const mailResult = await this.provider.sendEmail(to, subject, body);
    return { ...mailResult, body };
  }
}

export const emailService = new EmailService();
