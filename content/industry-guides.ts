/** Editorial guidance for the confirmed industries. No performance, certification or case-study claims. */
export interface IndustryGuide {
  slug: string
  title: string
  intro: string
  considerations: string[]
}

export const INDUSTRY_GUIDES: readonly IndustryGuide[] = [
  { slug: 'packaged-food', title: 'Packaged Food', intro: 'Plan inspection around your finished pack, the product inside it and the way it moves through your line.', considerations: ['Pack material and format, including any metallic film or foil', 'Pack dimensions, orientation and spacing on the conveyor', 'The foreign material concerns and weight checks you want to discuss', 'Available space for inspection, rejection and collection'] },
  { slug: 'bottled-canned-products', title: 'Bottled & Canned Products', intro: 'A useful inspection brief starts with the container, filling process and the position of the inspection point.', considerations: ['Glass, plastic or metal container and closure details', 'Container diameter, height and fill level', 'Line speed, stability and any change of container format', 'The inspection objective and how rejected containers should be handled'] },
  { slug: 'meat-seafood', title: 'Meat & Seafood', intro: 'Discuss inspection using representative products, packaging and the actual handling conditions on your processing line.', considerations: ['Fresh, chilled or frozen product and its presentation', 'Product variation, pack dimensions and maximum product height', 'Washdown, temperature and cleaning requirements', 'Your foreign material concerns and a suitable sample-testing brief'] },
  { slug: 'frozen-food', title: 'Frozen Food', intro: 'Inspection planning should account for the product condition and the way frozen packs travel through the production process.', considerations: ['Product temperature, moisture and surface condition', 'Pouches, trays, cartons or bulk product presentation', 'Pack dimensions, line speed and product spacing', 'Cleaning, condensation and space available for reject handling'] },
  { slug: 'bakery-snacks', title: 'Bakery & Snacks', intro: 'Bring your product and packaging requirements together before selecting an inspection arrangement for bakery or snack lines.', considerations: ['Loose or packed product and the proposed inspection point', 'Fragile products, orientation and handling requirements', 'Package format, product height and production rate', 'Weight targets, foreign material concerns and reject collection'] },
  { slug: 'nuts-seeds-dried-food', title: 'Nuts, Seeds & Dried Food', intro: 'The inspection discussion can cover bulk handling, finished packs and the points where product changes format.', considerations: ['Bulk, free-flowing or packed product presentation', 'Product mix, size variation and packaging material', 'Throughput and the space available at the proposed inspection point', 'Foreign material concerns and representative samples for evaluation'] },
  { slug: 'powder-granules', title: 'Powder & Granules', intro: 'Start with your material, flow arrangement and packaging process to prepare a practical inspection enquiry.', considerations: ['Material characteristics and whether it is loose or packaged', 'Feed arrangement, flow rate and any height restrictions', 'Dust control, cleaning and product-contact requirements', 'The inspection objective, downstream equipment and reject handling'] },
  { slug: 'pharmaceutical-daily-chemical', title: 'Pharmaceutical & Daily Chemical', intro: 'Share the product format and process requirements with our team before discussing a suitable inspection configuration.', considerations: ['Bottles, cartons, sachets or other product presentation', 'Package materials, dimensions and production rate', 'Documentation, cleaning and process requirements for your project', 'The inspection checks and any site-specific qualification requirements'] },
]

export function industryGuide(slug: string): IndustryGuide | undefined {
  return INDUSTRY_GUIDES.find(guide => guide.slug === slug)
}
