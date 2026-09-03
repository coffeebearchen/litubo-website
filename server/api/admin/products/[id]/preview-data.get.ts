import { getRouterParam, createError } from 'h3'
import { adminFetch, assertProductExists } from '~/server/utils/adminDirectusClient'
import type { AdminProduct, ProductSection, ProductSectionItem, ProductSpecGroup, ProductSpecItem, ProductMedia, ProductFaq } from '~/types/product-cms'

export default defineEventHandler(async (event) => {
  const id = getRouterParam(event, 'id')
  if (!id || isNaN(Number(id))) throw createError({ statusCode: 400, message: '无效的产品 ID' })
  await assertProductExists(event, Number(id))

  const PRODUCT_FIELDS = 'id,status,slug,name_en,model_or_series,summary_en,hero_image,review_notes,category_id,seo_noindex,date_updated'

  const [productR, sectionsR, sectionItemsR, specGroupsR, specItemsR, mediaR, faqsR] = await Promise.all([
    adminFetch<{ data: AdminProduct }>(event, `/items/products/${id}?fields=${PRODUCT_FIELDS}`),
    adminFetch<{ data: ProductSection[] }>(event,
      `/items/product_sections?filter[product_id][_eq]=${id}&filter[enabled][_eq]=true&sort[]=sort&sort[]=id&limit=50`),
    adminFetch<{ data: ProductSectionItem[] }>(event,
      `/items/product_section_items?filter[section_id][product_id][_eq]=${id}&filter[enabled][_eq]=true&sort[]=sort&sort[]=id&limit=200`),
    adminFetch<{ data: ProductSpecGroup[] }>(event,
      `/items/product_spec_groups?filter[product_id][_eq]=${id}&filter[enabled][_eq]=true&sort[]=sort&sort[]=id&limit=50`),
    adminFetch<{ data: ProductSpecItem[] }>(event,
      `/items/product_spec_items?filter[spec_group_id][product_id][_eq]=${id}&filter[enabled][_eq]=true&sort[]=sort&sort[]=id&limit=500`).catch(() => ({ data: [] as ProductSpecItem[] })),
    adminFetch<{ data: ProductMedia[] }>(event,
      `/items/products_files?filter[products_id][_eq]=${id}&filter[enabled][_eq]=true&fields=id,directus_files_id,file_role,caption_en,sort&sort[]=sort&sort[]=id&limit=100`),
    adminFetch<{ data: ProductFaq[] }>(event,
      `/items/product_faqs?filter[product_id][_eq]=${id}&filter[enabled][_eq]=true&sort[]=sort&sort[]=id&limit=50`),
  ])

  const product = (productR as { data: AdminProduct }).data
  const sections = (sectionsR as { data: ProductSection[] }).data ?? []
  const sectionItems = (sectionItemsR as { data: ProductSectionItem[] }).data ?? []
  const specGroups = (specGroupsR as { data: ProductSpecGroup[] }).data ?? []
  const specItems = (specItemsR as { data: ProductSpecItem[] }).data ?? []
  const media = (mediaR as { data: ProductMedia[] }).data ?? []
  const faqs = (faqsR as { data: ProductFaq[] }).data ?? []

  return {
    product,
    sections: sections.map(s => ({ ...s, items: sectionItems.filter(i => i.section_id === s.id) })),
    specGroups: specGroups.map(g => ({ ...g, items: specItems.filter(i => i.spec_group_id === g.id) })),
    media,
    faqs,
  }
})
