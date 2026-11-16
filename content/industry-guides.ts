/**
 * Application content for the eight confirmed industries.
 *
 * Copy comes from the V3 page-content handoff; the scenes are the eight industry pairs delivered
 * with it. Rules that must survive any edit:
 *   - No performance figure, sensitivity, throughput or certification is stated.
 *   - No customer, factory or "recommended model" is implied; the device entry is a family link.
 *   - Every generated scene is captioned as generated. It is never a LITUBO site or a customer site.
 */
export interface IndustryGuide {
  slug: string
  title: string
  /** Two-line first-screen statement. */
  headline: string
  intro: string
  productTitle: string
  productNote: string
  questions: string[]
  lineTitle: string
  lineNote: string
  lineItems: string[]
  prep: string[]
  presentation: string[]
  productImage: string
  productAlt: string
  productionImage: string
  productionAlt: string
  /** Representative family page, never a recommended model. */
  family: { label: string, to: string }
}

export const INDUSTRY_GUIDES: readonly IndustryGuide[] = [
  {
    slug: "packaged-food",
    title: "Packaged Food",
    headline: "Start with the pack.\nSee the complete line.",
    intro: "Plan the discussion around the finished pack, the food inside it and the way it moves through your line.",
    productTitle: "The package is part of the question.",
    productNote: "Share the pack material, dimensions and product presentation. Include any metallic film or foil so the technical discussion starts with the complete package.",
    questions: ["Pack material and closure", "Product shape and fill variation", "Foreign material or weight-checking objective", "Pack orientation and spacing"],
    lineTitle: "Follow the finished pack.",
    lineNote: "Show where sealing, inspection, case packing and collection sit in your process. Discuss the space available and how a rejected pack would be handled.",
    lineItems: ["The proposed inspection point", "Conveyor speed and product spacing", "Space, access and rejected-pack handling"],
    prep: ["Photos of a representative finished pack", "Pack material and dimensions", "A simple line layout and available space", "Your inspection objective and any sample questions"],
    presentation: ["Finished trays", "Pouches or bags", "Other finished packs"],
    productImage: "/images/applications/packaged-food-product.webp",
    productAlt: "Unbranded sealed trays and pouches of packaged food on a stainless packing surface",
    productionImage: "/images/applications/packaged-food-production.webp",
    productionAlt: "Sealed food trays moving on a stainless conveyor in a generic packing room",
    family: { label: "X-Ray Inspection", to: "/products/x-ray-inspection" },
  },
  {
    slug: "bottled-canned-products",
    title: "Bottled & Canned Products",
    headline: "Begin with the container.\nBring the line into view.",
    intro: "Discuss the product, container and closure together, then look at how each container travels through the line.",
    productTitle: "Look at the container and its contents.",
    productNote: "Share whether the container is glass, metal or plastic, together with its shape, closure and filled product. These details help frame the technology discussion.",
    questions: ["Container material and shape", "Closure and filled product", "Inspection objective", "Container stability and spacing"],
    lineTitle: "Keep container handling in the picture.",
    lineNote: "Describe upright or other presentation, guide rails and spacing. Include the available inspection position and how containers could be collected after rejection.",
    lineItems: ["Container orientation and guidance", "Spacing and line speed", "Available space and reject collection"],
    prep: ["Photos of the filled container and closure", "Container dimensions and material", "Line speed, spacing and handling arrangement", "The inspection question you need to resolve"],
    presentation: ["Bottles", "Cans", "Jars or other containers"],
    productImage: "/images/applications/bottled-canned-products-product.webp",
    productAlt: "Unlabelled capped bottles, sealed cans and a closed glass jar on a stainless surface",
    productionImage: "/images/applications/bottled-canned-products-production.webp",
    productionAlt: "Plain capped clear bottles moving along a stainless packaging conveyor",
    family: { label: "X-Ray Inspection", to: "/products/x-ray-inspection" },
  },
  {
    slug: "meat-seafood",
    title: "Meat & Seafood",
    headline: "Start with the product.\nUnderstand its handling.",
    intro: "Discuss inspection using representative products, packaging and the actual handling conditions on your processing line.",
    productTitle: "Show the cut, condition and pack.",
    productNote: "A chilled fillet, a meat portion and a frozen pack can present different questions. Share the actual product condition, packaging and the specific material concern you want to discuss.",
    questions: ["Fresh, chilled or frozen condition", "Product shape and variation", "Tray, film or other pack format", "The specific inspection concern"],
    lineTitle: "Consider the cold environment.",
    lineNote: "Describe the temperature, cleaning routine and how the packaged product reaches the inspection point. Include available space and how rejected product would be handled.",
    lineItems: ["Temperature and cleaning conditions", "Product orientation and spacing", "Space and rejected-product handling"],
    prep: ["Photos of a representative product in its pack", "Fresh, chilled or frozen condition", "Pack dimensions and product height", "Cleaning conditions and your inspection objective"],
    presentation: ["Fresh or chilled packs", "Frozen packs", "Other product presentation"],
    productImage: "/images/applications/meat-seafood-product.webp",
    productAlt: "Fresh meat and fish fillets kept in separate sealed retail trays on stainless steel",
    productionImage: "/images/applications/meat-seafood-production.webp",
    productionAlt: "Sealed fish-fillet trays travelling on a stainless conveyor in a generic chilled packing room",
    family: { label: "X-Ray Inspection", to: "/products/x-ray-inspection" },
  },
  {
    slug: "frozen-food",
    title: "Frozen Food",
    headline: "Know the frozen product.\nPlan around the line.",
    intro: "Start with the frozen product and packaging, then discuss the temperature and handling conditions at the proposed inspection point.",
    productTitle: "Bring the frozen pack into focus.",
    productNote: "Share the product format, pack material and normal variation in its frozen condition. Describe any frost or glaze relevant to the sample discussion.",
    questions: ["Product format and frozen condition", "Pack material and closure", "Normal variation, frost or glaze", "Inspection objective"],
    lineTitle: "Make the environment part of the brief.",
    lineNote: "Discuss the temperature at the inspection point, condensation and cleaning. Show how packs travel and the space available for inspection and rejection.",
    lineItems: ["Temperature and condensation", "Pack handling and spacing", "Cleaning access and reject collection"],
    prep: ["Photos of a representative frozen pack", "Temperature at the proposed inspection point", "Pack dimensions and line arrangement", "Cleaning routine and inspection objective"],
    presentation: ["Bagged frozen food", "Frozen trays", "Other frozen packs"],
    productImage: "/images/applications/frozen-food-product.webp",
    productAlt: "Plain sealed packs of frozen peas, mixed vegetables and frozen food on stainless steel",
    productionImage: "/images/applications/frozen-food-production.webp",
    productionAlt: "Sealed frozen-vegetable packs moving on a stainless food-packaging conveyor",
    family: { label: "X-Ray Inspection", to: "/products/x-ray-inspection" },
  },
  {
    slug: "bakery-snacks",
    title: "Bakery & Snacks",
    headline: "Understand the product.\nFollow its journey.",
    intro: "Start with the shape, variation and packaging of your bakery or snack product, then discuss its route through the line.",
    productTitle: "Show normal product variation.",
    productNote: "Share representative products across the range you make. Include whether the product travels loose or in packs and the materials used for trays and film.",
    questions: ["Shape and normal product variation", "Loose product or finished packs", "Tray, film and other packaging", "Inspection objective"],
    lineTitle: "Plan handling as well as inspection.",
    lineNote: "Describe spacing and how the product is supported during transfer. Discuss the available inspection position and a practical approach to rejected-product handling.",
    lineItems: ["Loose flow or individual packs", "Transfer, spacing and support", "Space and rejected-product handling"],
    prep: ["Representative product and packaging photos", "Loose or packed presentation", "Product dimensions and normal variation", "Line layout and inspection objective"],
    presentation: ["Packed bakery products", "Snack packs", "Loose products"],
    productImage: "/images/applications/bakery-snacks-product.webp",
    productAlt: "Unbranded sealed packs of bread rolls, crackers and baked snacks",
    productionImage: "/images/applications/bakery-snacks-production.webp",
    productionAlt: "Wrapped bread-roll packs travelling on a stainless conveyor in a bakery packing room",
    family: { label: "X-Ray Inspection", to: "/products/x-ray-inspection" },
  },
  {
    slug: "nuts-seeds-dried-food",
    title: "Nuts, Seeds & Dried Food",
    headline: "Begin with the material.\nClarify the process.",
    intro: "Discuss your material, how it is presented and the foreign-material concerns you want to investigate.",
    productTitle: "Describe the material and the concern.",
    productNote: "Share the product mix, size range and normal variation. Identify the specific foreign material you are concerned about without assuming that every material can be detected.",
    questions: ["Product type and normal variation", "Material size and presentation", "The foreign-material concern", "Bulk handling or finished pack"],
    lineTitle: "Show how the product flows.",
    lineNote: "Describe whether inspection is being considered during bulk handling or after packing. Share the flow or pack arrangement and the space available around the inspection point.",
    lineItems: ["Bulk flow or finished packs", "Feed arrangement and spacing", "Space and rejected-material handling"],
    prep: ["Photos of representative nuts, seeds or dried food", "Bulk flow or pack format", "Feed arrangement and line layout", "The specific inspection concern"],
    presentation: ["Bulk material", "Finished pouches", "Other presentation"],
    productImage: "/images/applications/nuts-seeds-dried-food-product.webp",
    productAlt: "Almonds, seeds and raisins in separate stainless trays beside a plain sealed pouch",
    productionImage: "/images/applications/nuts-seeds-dried-food-production.webp",
    productionAlt: "Plain sealed packs of nuts and dried fruit moving on a stainless packaging conveyor",
    family: { label: "X-Ray Inspection", to: "/products/x-ray-inspection" },
  },
  {
    slug: "powder-granules",
    title: "Powder & Granules",
    headline: "Start with your material.\nBring the process into focus.",
    intro: "Loose material or finished packs? Explore the questions to resolve before choosing an inspection system.",
    productTitle: "Describe the material before the machine.",
    productNote: "Share the material characteristics and whether it is loose or packaged. For loose material, describe the feed arrangement; for finished packs, include the packaging and product presentation.",
    questions: ["Material characteristics and flow", "Loose material or finished pack", "Dust control and cleaning", "The inspection objective"],
    lineTitle: "Identify the point in the process.",
    lineNote: "Show the proposed inspection position, available height and downstream equipment. The scene shows a generic finished-pack conveyor; it does not illustrate every possible bulk-material arrangement.",
    lineItems: ["Feed arrangement or conveyor presentation", "Available height, space and access", "Downstream equipment and reject handling"],
    prep: ["Material photos and whether it is loose or packaged", "Feed arrangement, flow and any height restrictions", "Dust control, cleaning and product-contact requirements", "Inspection objective and downstream handling"],
    presentation: ["Loose material", "Finished packs", "Not sure yet"],
    productImage: "/images/applications/powder-granules-product.webp",
    productAlt: "Pale food powder and granules in separate stainless trays beside a scoop and plain pouch",
    productionImage: "/images/applications/powder-granules-production.webp",
    productionAlt: "Plain sealed powder or granule pouches travelling on a stainless packaging conveyor",
    family: { label: "Metal Detection", to: "/products/metal-detection" },
  },
  {
    slug: "pharmaceutical-daily-chemical",
    title: "Pharmaceutical & Daily Chemical",
    headline: "Start with the product.\nDefine the requirements.",
    intro: "Discuss product form, packaging and handling alongside the documentation and cleaning requirements for your project.",
    productTitle: "Look at the product and primary pack.",
    productNote: "Share whether the product is solid, liquid or another form, and show the actual container. Documentation requirements should be discussed specifically rather than assumed from the industry name.",
    questions: ["Product form and primary packaging", "Container and closure", "Cleaning and changeover needs", "Documentation and inspection objective"],
    lineTitle: "Include changeover and handling.",
    lineNote: "Show how containers travel, what changes between formats and where inspection could fit. The generic packing scene does not demonstrate a certified facility or regulatory compliance.",
    lineItems: ["Container handling and format changes", "Cleaning and access requirements", "Records, space and reject collection"],
    prep: ["Representative product and container photos", "Product form and container dimensions", "Cleaning and changeover routine", "Documentation expectations and inspection objective"],
    presentation: ["Bottles or containers", "Cartons or other packs", "Other product form"],
    productImage: "/images/applications/pharmaceutical-daily-chemical-product.webp",
    productAlt: "Plain capped containers, a closed carton, a tube and pump bottle on a stainless surface",
    productionImage: "/images/applications/pharmaceutical-daily-chemical-production.webp",
    productionAlt: "Unmarked capped white bottles and cartons on a generic stainless packaging conveyor",
    family: { label: "X-Ray Inspection", to: "/products/x-ray-inspection" },
  },
]

export function industryGuide(slug: string): IndustryGuide | undefined {
  return INDUSTRY_GUIDES.find(guide => guide.slug === slug)
}
