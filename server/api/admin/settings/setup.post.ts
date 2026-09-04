import { adminFetch } from '~/server/utils/adminDirectusClient'

const SETTINGS_FIELDS = [
  { field: 'id', type: 'integer', meta: { hidden: true, readonly: true, interface: 'input' }, schema: { is_primary_key: true, has_auto_increment: true, is_nullable: false } },
  { field: 'brand_name', type: 'string', meta: { interface: 'input', width: 'half' }, schema: { is_nullable: true, max_length: 100 } },
  { field: 'legal_company_name', type: 'string', meta: { interface: 'input', width: 'half' }, schema: { is_nullable: true, max_length: 200 } },
  { field: 'public_email', type: 'string', meta: { interface: 'input', width: 'half' }, schema: { is_nullable: true, max_length: 254 } },
  { field: 'public_phone', type: 'string', meta: { interface: 'input', width: 'half' }, schema: { is_nullable: true, max_length: 50 } },
  { field: 'public_whatsapp_url', type: 'string', meta: { interface: 'input', width: 'full' }, schema: { is_nullable: true, max_length: 500 } },
  { field: 'public_address', type: 'text', meta: { interface: 'textarea', width: 'full' }, schema: { is_nullable: true } },
  { field: 'copyright_text', type: 'string', meta: { interface: 'input', width: 'full' }, schema: { is_nullable: true, max_length: 200 } },
]

const SOCIAL_FIELDS = [
  { field: 'id', type: 'integer', meta: { hidden: true, readonly: true, interface: 'input' }, schema: { is_primary_key: true, has_auto_increment: true, is_nullable: false } },
  { field: 'settings_id', type: 'integer', meta: { interface: 'numeric', width: 'half', hidden: true }, schema: { is_nullable: true } },
  { field: 'platform', type: 'string', meta: { interface: 'select-dropdown', width: 'half', options: { choices: [{ text: 'LinkedIn', value: 'linkedin' }, { text: 'YouTube', value: 'youtube' }, { text: 'Instagram', value: 'instagram' }, { text: 'Facebook', value: 'facebook' }] } }, schema: { is_nullable: false, max_length: 50 } },
  { field: 'url', type: 'string', meta: { interface: 'input', width: 'full' }, schema: { is_nullable: false, max_length: 500 } },
  { field: 'sort', type: 'integer', meta: { interface: 'input', width: 'half' }, schema: { is_nullable: true } },
  { field: 'enabled', type: 'boolean', meta: { interface: 'boolean', width: 'half' }, schema: { is_nullable: false, default_value: true } },
]

const SEED_BODY = {
  brand_name: 'LITUBO',
  legal_company_name: 'Shanghai NingPin Industrial Dev. Co., Ltd.',
  public_email: 'sales@litubo.com',
  public_phone: '+86 21 5270 7913',
  public_whatsapp_url: 'https://wa.me/8619370713936',
  public_address: 'No. 23, Huangtu Rd., Huaqiao Town, Kunshan, Jiangsu Province, China',
  copyright_text: '© {year} LITUBO. All rights reserved.',
}

export default defineEventHandler(async (event) => {
  // Step 1: Create schema if it doesn't exist yet
  let schemaCreated = false
  try {
    await adminFetch(event, '/collections/site_settings')
    // Schema exists — skip to data seeding
  } catch {
    // Create site_settings singleton
    await adminFetch(event, '/collections', {
      method: 'POST',
      body: { collection: 'site_settings', meta: { singleton: true, icon: 'settings' }, schema: {}, fields: SETTINGS_FIELDS },
    })

    // Create site_social_links collection
    await adminFetch(event, '/collections', {
      method: 'POST',
      body: { collection: 'site_social_links', meta: { icon: 'link', sort_field: 'sort' }, schema: {}, fields: SOCIAL_FIELDS },
    })

    // Create M2O relation: site_social_links.settings_id → site_settings.id
    await adminFetch(event, '/relations', {
      method: 'POST',
      body: {
        collection: 'site_social_links',
        field: 'settings_id',
        related_collection: 'site_settings',
        schema: { on_delete: 'SET NULL' },
      },
    })

    // Grant nuxt-server READ permissions (best effort)
    try {
      const policyRes = await adminFetch<{ data: Array<{ id: string }> }>(
        event, '/policies?filter[name][_eq]=site-readonly-policy&limit=1',
      )
      const policyId = (policyRes as { data: Array<{ id: string }> }).data[0]?.id
      if (policyId) {
        await adminFetch(event, '/permissions', {
          method: 'POST',
          body: { policy: policyId, collection: 'site_settings', action: 'read', fields: '*' },
        })
        await adminFetch(event, '/permissions', {
          method: 'POST',
          body: { policy: policyId, collection: 'site_social_links', action: 'read', fields: '*' },
        })
      }
    } catch {
      // permissions step skipped
    }

    schemaCreated = true
  }

  // Step 2: Check if singleton record already has data
  let settingsId: number | null = null
  try {
    const getRes = await adminFetch<{ data: { id: number | null } }>(event, '/items/site_settings?fields=id')
    settingsId = (getRes as { data: { id: number | null } }).data?.id ?? null
  } catch {
    // ignore
  }

  // Step 3: Seed settings data if record has no id yet
  // Directus singletons are created/updated via PATCH (not POST)
  if (!settingsId) {
    const patchRes = await adminFetch<{ data: { id: number } }>(event, '/items/site_settings', {
      method: 'PATCH',
      body: SEED_BODY,
    })
    settingsId = (patchRes as { data: { id: number } }).data?.id ?? null

    // If PATCH didn't create the record (some Directus versions), try POST
    if (!settingsId) {
      try {
        const postRes = await adminFetch<{ data: { id: number } }>(event, '/items/site_settings', {
          method: 'POST',
          body: SEED_BODY,
        })
        settingsId = (postRes as { data: { id: number } }).data?.id ?? null
      } catch {
        // ignore POST failure
      }
    }

    // Re-fetch to get the actual id if still unknown
    if (!settingsId) {
      try {
        const refetchRes = await adminFetch<{ data: { id: number } }>(event, '/items/site_settings?fields=id')
        settingsId = (refetchRes as { data: { id: number } }).data?.id ?? null
      } catch {
        // ignore
      }
    }
  }

  // Step 4: Seed social links if none exist
  if (settingsId) {
    const existingLinks = await adminFetch<{ data: unknown[] }>(
      event, `/items/site_social_links?filter[settings_id][_eq]=${settingsId}&limit=1&fields=id`,
    )
    if ((existingLinks as { data: unknown[] }).data.length === 0) {
      await Promise.allSettled([
        adminFetch(event, '/items/site_social_links', {
          method: 'POST',
          body: { settings_id: settingsId, platform: 'linkedin', url: 'https://www.linkedin.com/company/litubo', sort: 1, enabled: true },
        }),
        adminFetch(event, '/items/site_social_links', {
          method: 'POST',
          body: { settings_id: settingsId, platform: 'youtube', url: 'https://www.youtube.com/@litubo', sort: 2, enabled: true },
        }),
      ])
    }
  }

  return { ok: true, schemaCreated, settingsId }
})
