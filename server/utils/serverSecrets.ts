/**
 * FINAL-RELEASE-PRODUCTION-READY-01D — the server secrets, read from the running process (D-039).
 *
 * Production build artifacts must not contain server secrets. Nuxt evaluates `runtimeConfig` whenever
 * it loads `nuxt.config.ts` — `nuxt build` included — and serializes the result into `.output`, so none
 * of these values is declared there. Each reader returns what its canonical environment variable holds
 * in the environment of the running server process at the moment it is called: the deployment's secret
 * manager supplies the value when the process starts, a build never needs it, and a rotation takes a
 * restart, not a rebuild.
 *
 * Every reader returns '' when its variable is absent or empty. What a feature does without its secret
 * is unchanged and stays with the feature: SMTP authentication gets no password and the best-effort
 * notification fails, HubSpot sync records `not_configured`, each AI provider reports "not configured",
 * and the rate-limit key keeps the behaviour it has always had (`publicInquiry.ts`). None of them falls
 * back to a value taken from a build.
 *
 * `DIRECTUS_TOKEN` follows the same contract in its own module, `directusServiceToken.ts`
 * (FINAL-RELEASE-PRODUCTION-READY-01C), and is deliberately not repeated here.
 */

/** SMTP_PASS — the SMTP account password for inquiry notification emails. */
export function readSmtpPassword(): string {
  return process.env.SMTP_PASS ?? ''
}

/** SUBMISSION_IP_SECRET — the HMAC-SHA256 key that hashes client addresses for the in-process rate limiter. */
export function readSubmissionIpSecret(): string {
  return process.env.SUBMISSION_IP_SECRET ?? ''
}

/** HUBSPOT_ACCESS_TOKEN — the HubSpot Private App token used for Contact sync. */
export function readHubspotAccessToken(): string {
  return process.env.HUBSPOT_ACCESS_TOKEN ?? ''
}

/** OPENAI_API_KEY — the OpenAI API key. */
export function readOpenaiApiKey(): string {
  return process.env.OPENAI_API_KEY ?? ''
}

/** DEEPSEEK_API_KEY — the DeepSeek API key. */
export function readDeepseekApiKey(): string {
  return process.env.DEEPSEEK_API_KEY ?? ''
}
