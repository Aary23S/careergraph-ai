import dotenv from 'dotenv';
import Joi from 'joi';

const isTest = process.env.NODE_ENV === 'test' || process.argv.some(arg => arg.includes('jest'));

if (isTest) {
  process.env.NODE_ENV = 'test';
  dotenv.config({ path: '.env.test' });
} else {
  dotenv.config();
}

const schema = Joi.object({
  NODE_ENV: Joi.string().valid('development', 'test', 'production').default('development'),
  PORT: Joi.number().integer().min(1).max(65535).default(5000),
  DATABASE_DIALECT: Joi.string().valid('postgres', 'sqlite').default('postgres'),
  DATABASE_URL: Joi.alternatives().conditional('DATABASE_DIALECT', {
    is: 'postgres',
    then: Joi.string().uri({ scheme: ['postgres', 'postgresql'] }).required(),
    otherwise: Joi.string().allow('', null).optional(),
  }),
  DATABASE_STORAGE: Joi.alternatives().conditional('DATABASE_DIALECT', {
    is: 'sqlite',
    then: Joi.string().required(),
    otherwise: Joi.string().allow('', null).optional(),
  }),
  CORS_ORIGIN: Joi.string().uri().required(),
  JWT_ACCESS_SECRET: Joi.string().min(16).required(),
  JWT_REFRESH_SECRET: Joi.string().min(16).required(),
  ACCESS_TOKEN_TTL_MINUTES: Joi.number().integer().min(1).default(15),
  REFRESH_TOKEN_TTL_DAYS: Joi.number().integer().min(1).default(30),
  RESUME_STORAGE_PATH: Joi.string().default('./storage/resumes'),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: Joi.number().integer().min(1).default(15),
  AUTH_RATE_LIMIT_MAX_REQUESTS: Joi.number().integer().min(1).default(50),
  ADZUNA_APP_ID: Joi.string().allow('', null).default(''),
  ADZUNA_APP_KEY: Joi.string().allow('', null).default(''),
  ADZUNA_COUNTRY: Joi.string().default('in'),
  ADZUNA_ENABLED: Joi.boolean().default(false),
  GMAIL_ENABLED: Joi.boolean().default(false),
  GOOGLE_CLIENT_ID: Joi.string().allow('', null).optional(),
  GOOGLE_CLIENT_SECRET: Joi.string().allow('', null).optional(),
  GOOGLE_REDIRECT_URI: Joi.string().uri().allow('', null).optional(),
  GMAIL_OAUTH_SCOPES: Joi.string().default(
    'https://www.googleapis.com/auth/gmail.readonly'
  ),
  GMAIL_JOB_LABEL: Joi.string().default('CareerGraph/LinkedInJobs'),
  TELEGRAM_ENABLED: Joi.boolean().default(false),
  TELEGRAM_BOT_TOKEN: Joi.string().allow('', null).default(''),
  TELEGRAM_MODE: Joi.string().valid('polling', 'webhook').default('polling'),
  TELEGRAM_BOT_USERNAME: Joi.string().default('CareerGraphJobBot'),
  AI_ENABLED: Joi.boolean().default(false),
  AI_PROVIDER: Joi.string().valid('mock', 'ollama').default('mock'),
  OLLAMA_BASE_URL: Joi.string().uri().default('http://localhost:11434'),
  OLLAMA_MODEL: Joi.string().default('gemma2:2b'),
  AI_TIMEOUT_MS: Joi.number().integer().default(300000),
  AI_MAX_RETRIES: Joi.number().integer().default(2),
}).unknown(true);

const { error, value } = schema.validate(process.env, { abortEarly: false });

if (error) {
  throw new Error(`Invalid environment configuration: ${error.message}`);
}

export const env = {
  nodeEnv: value.NODE_ENV,
  port: value.PORT,
  databaseDialect: value.DATABASE_DIALECT,
  databaseUrl: value.DATABASE_URL,
  databaseStorage: value.DATABASE_STORAGE,
  corsOrigin: value.CORS_ORIGIN,
  jwtAccessSecret: value.JWT_ACCESS_SECRET,
  jwtRefreshSecret: value.JWT_REFRESH_SECRET,
  accessTokenTtlMinutes: value.ACCESS_TOKEN_TTL_MINUTES,
  refreshTokenTtlDays: value.REFRESH_TOKEN_TTL_DAYS,
  resumeStoragePath: value.RESUME_STORAGE_PATH,
  authRateLimitWindowMinutes: value.AUTH_RATE_LIMIT_WINDOW_MINUTES,
  authRateLimitMaxRequests: value.AUTH_RATE_LIMIT_MAX_REQUESTS,
  adzunaAppId: value.ADZUNA_APP_ID,
  adzunaAppKey: value.ADZUNA_APP_KEY,
  adzunaCountry: value.ADZUNA_COUNTRY,
  adzunaEnabled: value.ADZUNA_ENABLED,
  gmailEnabled: value.GMAIL_ENABLED,
  googleClientId: value.GOOGLE_CLIENT_ID,
  googleClientSecret: value.GOOGLE_CLIENT_SECRET,
  googleRedirectUri: value.GOOGLE_REDIRECT_URI,
  gmailOauthScopes: value.GMAIL_OAUTH_SCOPES,
  gmailJobLabel: value.GMAIL_JOB_LABEL,
  telegramEnabled: value.TELEGRAM_ENABLED,
  telegramBotToken: value.TELEGRAM_BOT_TOKEN,
  telegramMode: value.TELEGRAM_MODE,
  telegramBotUsername: value.TELEGRAM_BOT_USERNAME,
  aiEnabled: value.AI_ENABLED,
  aiProvider: value.AI_PROVIDER,
  ollamaBaseUrl: value.OLLAMA_BASE_URL,
  ollamaModel: value.OLLAMA_MODEL,
  aiTimeoutMs: value.AI_TIMEOUT_MS,
  aiMaxRetries: value.AI_MAX_RETRIES,
};
