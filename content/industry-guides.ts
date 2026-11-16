/**
 * Editorial guidance for the confirmed industries.
 *
 * This file is the shared content source for the eight application pages. Every entry follows the
 * same shape so the page stays one template; only the words and the scene change.
 *
 * Editorial rules that must survive any edit:
 *   - No performance figure, sensitivity, throughput or certification is stated.
 *   - No customer, factory or "recommended model" is implied. The device entry is a family link.
 *   - `sceneKind` decides how the scene is captioned. A generated scene says so; a photograph does
 *     not. Never mark a generated scene as a customer site or as device evidence.
 */
export type SceneKind = 'photo' | 'generated' | 'illustration'

export interface IndustryGuide {
  slug: string
  title: string
  /** One sentence describing what this application is about. */
  intro: string
  /** The inspection questions this product type usually raises. */
  considerations: string[]
  /** Scene image under /public, and how it may be captioned. */
  scene: string
  sceneKind: SceneKind
  sceneAlt: string
  /** Two interleaved blocks: what the product is, then what the line needs. */
  productNote: string
  lineNote: string
  /** What the visitor should bring to the technical discussion. */
  preparation: string[]
  /** Representative family page for this application, never a "recommended model". */
  family: { label: string, to: string }
}

export const INDUSTRY_GUIDES: readonly IndustryGuide[] = [
  {
    slug: 'packaged-food',
    title: 'Packaged Food',
    intro: 'Plan inspection around your finished pack, the product inside it and the way it moves through your line.',
    considerations: ['Pack material and format, including any metallic film or foil', 'Pack dimensions, orientation and spacing on the conveyor', 'The foreign material concerns and weight checks you want to discuss', 'Available space for inspection, rejection and collection'],
    scene: '/images/applications/packaged-food.webp',
    sceneKind: 'illustration',
    sceneAlt: 'Packaged food illustration showing a tray, a pouch and a carton',
    productNote: 'Finished packs are the starting point: the pack material, the fill pattern and how a sealed pack behaves on a conveyor all decide which inspection principle is even viable.',
    lineNote: 'The inspection point is usually after sealing and before case packing, where every pack passes the aperture once and a reject can still be diverted without disturbing the rest of the line.',
    preparation: ['A representative finished pack', 'The pack material and its thickness', 'Line speed and the space available for the machine'],
    family: { label: 'X-Ray Inspection', to: '/products/x-ray-inspection' },
  },
  {
    slug: 'bottled-canned-products',
    title: 'Bottled & Canned Products',
    intro: 'Upright containers change the geometry of inspection, so the container and its closure are discussed before the technology.',
    considerations: ['Container material, wall thickness and closure type', 'Headspace and fill level', 'How containers are spaced and guided on the line', 'Available space for inspection and rejection'],
    scene: '/images/applications/bottled-canned-products.webp',
    sceneKind: 'illustration',
    sceneAlt: 'Bottled and canned product illustration showing a bottle, a can and a jar',
    productNote: 'Glass, metal and rigid plastic containers each interact differently with an inspection beam, and a side-looking geometry is often needed where the container is tall.',
    lineNote: 'Containers usually arrive upright and close together, so the discussion covers container spacing, guide rails and how a rejected container is removed without stopping the line.',
    preparation: ['An empty container and a filled one', 'The closure type', 'Line speed and container spacing'],
    family: { label: 'X-Ray Inspection', to: '/products/x-ray-inspection' },
  },
  {
    slug: 'meat-seafood',
    title: 'Meat & Seafood',
    intro: 'Bone, cartilage and dense tissue behave differently from the surrounding product, so the discussion starts with the cut and the pack.',
    considerations: ['Bone, cartilage and shell risk by cut', 'Whether the product is fresh, chilled or frozen', 'Pack format, tray and film', 'Available space for inspection and rejection'],
    scene: '/images/applications/meat-seafood.webp',
    sceneKind: 'illustration',
    sceneAlt: 'Meat and seafood illustration showing a whole fish, a fillet and shellfish',
    productNote: 'Meat and seafood are dense and irregular, and the material that has to be found — bone, cartilage, shell or a dense foreign body — sits close in density to the product itself.',
    lineNote: 'Temperature state matters: a frozen block and a chilled fillet present differently, and the pack film, the tray and any glaze are part of what the inspection has to work through.',
    preparation: ['A representative cut in its real pack', 'Whether the product is fresh, chilled or frozen', 'The specific bone or foreign-body risk you are addressing'],
    family: { label: 'X-Ray Inspection', to: '/products/x-ray-inspection' },
  },
  {
    slug: 'frozen-food',
    title: 'Frozen Food',
    intro: 'Frozen product brings ice, frost and hard packs into the inspection question, together with the temperature at which the line runs.',
    considerations: ['Frozen state and ice glaze', 'Pack rigidity and closure', 'Condensation and washdown conditions', 'Available space for inspection and rejection'],
    scene: '/images/applications/frozen-food.webp',
    sceneKind: 'illustration',
    sceneAlt: 'Frozen food illustration showing a bag of peas, broccoli and a snowflake',
    productNote: 'Ice and frost add density variation that has nothing to do with contamination, so the discussion separates natural product variation from the signal the inspection is looking for.',
    lineNote: 'A frozen line runs cold and often wet, so machine placement, condensation and the cleaning routine belong in the same conversation as the inspection itself.',
    preparation: ['A representative frozen pack', 'The temperature at the inspection point', 'Line speed and the cleaning routine'],
    family: { label: 'X-Ray Inspection', to: '/products/x-ray-inspection' },
  },
  {
    slug: 'bakery-snacks',
    title: 'Bakery & Snacks',
    intro: 'Baked and snack products vary in density and shape from piece to piece, which shapes what inspection can reliably tell you.',
    considerations: ['Piece-to-piece density and shape variation', 'Bulk flow versus individual packs', 'Pack film and tray material', 'Available space for inspection and rejection'],
    scene: '/images/applications/bakery-snacks.webp',
    sceneKind: 'illustration',
    sceneAlt: 'Bakery and snack illustration showing bread, a croissant and crackers',
    productNote: 'Bread, pastry and extruded snacks are airy and inconsistent, so a uniform-product assumption does not hold and the discussion covers how much natural variation the line already carries.',
    lineNote: 'Bulk flow and individual packs are different problems: one passes a continuous stream, the other presents one item at a time, and the reject method follows from that.',
    preparation: ['Samples across the normal spread of the product', 'Whether it runs in bulk or in packs', 'Line speed and reject handling'],
    family: { label: 'X-Ray Inspection', to: '/products/x-ray-inspection' },
  },
  {
    slug: 'nuts-seeds-dried-food',
    title: 'Nuts, Seeds & Dried Food',
    intro: 'Small, hard products bring stones, shell fragments and similar-density contamination into the discussion.',
    considerations: ['Stone and shell risk', 'Product size and flow rate', 'Bulk handling or pack format', 'Available space for inspection and rejection'],
    scene: '/images/applications/nuts-seeds-dried-food.webp',
    sceneKind: 'illustration',
    sceneAlt: 'Nuts and seeds illustration showing walnuts, almonds, seeds and raisins',
    productNote: 'Stones and shell fragments are close in density to the product itself, which is the central technical difficulty in this application rather than an afterthought.',
    lineNote: 'These products often run at high flow in bulk, so throughput and the way the stream is presented to the inspection point decide as much as the detection question.',
    preparation: ['A sample including the contamination you are worried about', 'Flow rate and whether product runs in bulk', 'Pack format if it is packed'],
    family: { label: 'X-Ray Inspection', to: '/products/x-ray-inspection' },
  },
  {
    slug: 'powder-granules',
    title: 'Powder & Granules',
    intro: 'Start with your material, flow and pipe or belt, because bulk product is inspected in motion rather than as a discrete pack.',
    considerations: ['Bulk density and flow behaviour', 'Pipeline or belt presentation', 'Reject method for a continuous stream', 'Available space for inspection and rejection'],
    scene: '/images/applications/powder-granules.webp',
    sceneKind: 'illustration',
    sceneAlt: 'Powder and granules illustration showing a sack, powder and a scoop',
    productNote: 'Powder and granules are inspected as a moving stream rather than as discrete packs, so the material itself — density, flow and aeration — is the first thing to establish.',
    lineNote: 'The inspection point is usually in a pipeline or on a belt between process stages, and the reject method has to remove a portion of a continuous stream rather than a single pack.',
    preparation: ['A material sample', 'Pipe diameter or belt width and flow rate', 'Where in the process inspection would sit'],
    family: { label: 'Metal Detection', to: '/products/metal-detection' },
  },
  {
    slug: 'pharmaceutical-daily-chemical',
    title: 'Pharmaceutical & Daily Chemical',
    intro: 'Regulated and consumer-facing products bring documentation and traceability into the inspection discussion alongside the technical question.',
    considerations: ['Product form and primary packaging', 'Documentation and traceability expectations', 'Cleaning and changeover routine', 'Available space for inspection and rejection'],
    scene: '/images/applications/pharmaceutical-daily-chemical.webp',
    sceneKind: 'illustration',
    sceneAlt: 'Pharmaceutical and daily chemical illustration showing a pill bottle, capsules and a pump bottle',
    productNote: 'Pharmaceutical and daily-chemical products range from tablets to liquids and gels, so the product form and its container shape the inspection geometry.',
    lineNote: 'These lines usually carry documentation and changeover requirements, so records, cleaning routine and format changes belong in the same discussion.',
    preparation: ['A representative product and container', 'The documentation you need to keep', 'Changeover and cleaning routine'],
    family: { label: 'X-Ray Inspection', to: '/products/x-ray-inspection' },
  },
]

export function industryGuide(slug: string): IndustryGuide | undefined {
  return INDUSTRY_GUIDES.find(guide => guide.slug === slug)
}
