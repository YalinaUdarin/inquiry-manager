// Reads settings from environment variables (loaded from backend/.env)
// and stops the app at startup if a required one is missing, rather than
// failing later with a confusing error.

const path = require('node:path');

require('dotenv').config({ path: path.join(__dirname, '..', '.env'), quiet: true });

const env = process.env.NODE_ENV || 'development';
const isTest = env === 'test';

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable ${name}. See backend/.env.example.`);
  }
  return value;
}

const config = {
  env,
  isTest,
  port: Number(process.env.PORT) || 4000,
  // Tests always use the separate test database, never the dev one.
  databaseUrl: isTest ? required('TEST_DATABASE_URL') : required('DATABASE_URL'),
  jwtSecret: required('JWT_SECRET'),
  // Cookies are only marked Secure (HTTPS-only) in production, because local
  // development runs over plain http://localhost.
  cookieSecure: env === 'production',
};

module.exports = config;
