/**
 * FINAL-RELEASE-PRODUCTION-READY-01C — the one place the server reads the Directus service token.
 *
 * `DIRECTUS_TOKEN` is the project's single Directus secret (D-038): provisioning installs it as the
 * `nuxt-server` service user's static token, and the running server presents it — as the Bearer
 * token of every `directusFetch` call, and as the input the AI source-ref key is derived from.
 *
 * It is read here, from the environment of the running server process, each time it is needed. It is
 * deliberately NOT a `runtimeConfig` value: Nuxt evaluates `runtimeConfig` whenever it loads
 * `nuxt.config.ts` — `nuxt build` included — and serializes the result into `.output`, so a token
 * declared there is baked into the build artifact, and a prebuilt server keeps using that copy
 * (measured in FINAL-RELEASE-PRODUCTION-READY-01B). Production build artifacts must be secret-free,
 * so the value reaches the server only through the environment it is started with.
 *
 * Returns '' when the variable is absent or empty. Callers treat '' as "not configured" and fail
 * closed: no anonymous request, no placeholder, and no build-time copy to fall back on.
 */
export function readDirectusToken(): string {
  return process.env.DIRECTUS_TOKEN ?? ''
}
