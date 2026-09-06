import { parse } from 'csv-parse/sync';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
import { models } from '../config/database.js';
import { AppError } from '../lib/http.js';
import { AIService } from './ai/ai.service.js';
import Joi from 'joi';

const cleanCompanyName = (name) => {
  if (!name) return '';
  return name.toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
};

export async function importFollowedCompaniesCsv(userId, csvContent) {
  if (!csvContent) {
    throw new AppError(400, 'CSV_REQUIRED', 'CSV content is required.');
  }

  // LinkedIn sometimes has intro notes in CSV
  const headerMatch = csvContent.match(/(?:^|\n)(["']?Organization["']?|["']?Company["']?|["']?Name["']?)/i);
  if (headerMatch) {
    csvContent = csvContent.substring(headerMatch.index).trim();
  }

  const records = parse(csvContent, {
    columns: true,
    skip_empty_lines: true,
    trim: true,
  });
  console.log('CSV Records:', records);

  const companies = [];
  for (const record of records) {
    const name = record.Organization || record.Company || record.Name || record.name || record.organization;
    const url = record.URL || record.Url || record.url;
    
    if (name) {
      companies.push({
        user_id: userId,
        name: name,
        normalizedCompany: cleanCompanyName(name),
        url: url || null,
        source: 'csv'
      });
    }
  }

  const imported = await bulkUpsertFollowedCompanies(userId, companies);
  return imported;
}

export async function importFollowedCompaniesPdf(userId, pdfBuffer) {
  if (!pdfBuffer) {
    throw new AppError(400, 'PDF_REQUIRED', 'PDF buffer is required.');
  }

  const parsed = await pdfParse(pdfBuffer);
  const text = parsed.text;

  const ai = new AIService();
  const schema = Joi.object({
    companies: Joi.array().items(Joi.object({
      name: Joi.string().required(),
      url: Joi.string().uri().allow('', null).optional()
    })).required()
  });

  const prompt = `Extract a list of followed companies from the following text (which was exported as a PDF from LinkedIn or a similar site).
Return a JSON object with a 'companies' array. Each item should have a 'name' and an optional 'url'.

Text:
${text.substring(0, 10000)} // Limiting to 10k chars to avoid token limits
`;

  const result = await ai.generateStructured(prompt, schema, {
    operation: 'company_extraction'
  });

  const companies = (result.companies || []).map(c => ({
    user_id: userId,
    name: c.name,
    normalizedCompany: cleanCompanyName(c.name),
    url: c.url || null,
    source: 'pdf'
  }));

  return await bulkUpsertFollowedCompanies(userId, companies);
}

async function bulkUpsertFollowedCompanies(userId, companies) {
  if (companies.length === 0) return { imported: 0 };

  const uniqueMap = new Map();
  for (const c of companies) {
    if (c.normalizedCompany) {
      uniqueMap.set(c.normalizedCompany, c);
    }
  }

  const uniqueCompanies = Array.from(uniqueMap.values());

  await models.FollowedCompany.bulkCreate(uniqueCompanies, {
    updateOnDuplicate: ['name', 'url', 'source', 'updated_at']
  });

  return { imported: uniqueCompanies.length };
}
