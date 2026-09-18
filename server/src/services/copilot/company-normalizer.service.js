/**
 * Dedicated Company & Entity Normalization Service
 * Handles canonical company alias mapping and prevents SQL substring false positives.
 */

const CANONICAL_ALIASES = new Map([
  ['microsoft', 'microsoft'],
  ['microsoft india', 'microsoft'],
  ['microsoft corporation', 'microsoft'],
  ['msft', 'microsoft'],
  ['apple', 'apple'],
  ['apple inc', 'apple'],
  ['aapl', 'apple'],
  ['google', 'google'],
  ['alphabet', 'google'],
  ['googl', 'google'],
  ['amazon', 'amazon'],
  ['aws', 'amazon'],
  ['amazon web services', 'amazon'],
  ['amzn', 'amazon'],
  ['meta', 'meta'],
  ['facebook', 'meta'],
  ['netflix', 'netflix'],
  ['mastercard', 'mastercard'],
  ['vamstar', 'vamstar'],
  ['rcm', 'rcm'],
  ['cuatro labs', 'cuatro labs'],
  ['physicswallah', 'physicswallah'],
  ['pw', 'physicswallah']
]);

// Common English words to reject from entity extraction
const STOP_WORDS = new Set([
  'from', 'the', 'and', 'for', 'with', 'about', 'who', 'what', 'where', 'when',
  'how', 'why', 'can', 'you', 'give', 'show', 'find', 'list', 'top', 'my',
  'at', 'in', 'on', 'to', 'of', 'is', 'are', 'me', 'refer', 'referral', 'connections',
  'connection', 'people', 'contacts', 'jobs', 'job', 'applications', 'draft', 'message',
  'network', 'recent', 'all', 'direct', 'any', 'my network', 'some'
]);

export class CompanyNormalizerService {
  /**
   * Returns normalized canonical company name.
   * @param {string} rawCompany 
   * @returns {string} Canonical name or cleaned input
   */
  static normalizeCompany(rawCompany) {
    if (!rawCompany || typeof rawCompany !== 'string') return '';
    const clean = rawCompany.trim().toLowerCase();
    
    // Exact match in alias dictionary
    if (CANONICAL_ALIASES.has(clean)) {
      return CANONICAL_ALIASES.get(clean);
    }

    // Strip common company suffixes
    const stripped = clean
      .replace(/\b(inc|corp|corporation|llc|ltd|limited|pvt|private|technologies|tech|labs|software|solutions|services|group|holdings|india|global)\b/gi, '')
      .trim();

    if (CANONICAL_ALIASES.has(stripped)) {
      return CANONICAL_ALIASES.get(stripped);
    }

    return stripped || clean;
  }

  /**
   * Validates if a text token is a plausible company/entity name rather than a stop word.
   * @param {string} token 
   * @returns {boolean}
   */
  static isPlausibleEntity(token) {
    if (!token || typeof token !== 'string') return false;
    const clean = token.trim().toLowerCase();
    if (clean.length < 2) return false;
    if (STOP_WORDS.has(clean)) return false;
    return true;
  }

  /**
   * Builds SQL match conditions for company queries preventing substring false positives.
   * @param {string} rawCompany 
   * @returns {Object} Search parameters
   */
  static getCompanyMatchQuery(rawCompany) {
    const canonical = this.normalizeCompany(rawCompany);
    return {
      canonical,
      raw: rawCompany.trim(),
      variants: Array.from(new Set([
        rawCompany.trim().toLowerCase(),
        canonical,
        `%${canonical}%`
      ]))
    };
  }
}
