# -*- coding: utf-8 -*-
import json, io, re, urllib.request

def env_get(k):
    for line in io.open(r"D:\LITUBO-website\.env", encoding="utf-8-sig"):
        m = re.match(rf"^{k}=(.*)$", line.strip())
        if m: return m.group(1).strip().strip('"').strip("'")
    return None

base = "http://127.0.0.1:8055"
def call(method, path, payload=None, token=None):
    data = json.dumps(payload).encode() if payload is not None else None
    h = {"Content-Type": "application/json"}
    if token: h["Authorization"] = "Bearer " + token
    r = urllib.request.Request(base + path, data=data, method=method, headers=h)
    with urllib.request.urlopen(r, timeout=45) as resp:
        return json.loads(resp.read().decode())

tok = call("POST", "/auth/login", {"email": env_get("DIRECTUS_ADMIN_EMAIL"), "password": env_get("DIRECTUS_ADMIN_PASSWORD")})["data"]["access_token"]

S = {
"lt-150-compact-online-checkweigher": "Utilice la LITUBO LT-150 cuando productos envasados pequeños necesiten un control de peso en línea rápido y repetible en un espacio reducido.",
"lt-150l-compact-l-series-online-checkweigher": "Elija la LITUBO LT-150L cuando se prefiera una disposición L-series más ligera para productos pequeños de 3 a 500 g.",
"lt-150lr-compact-left-right-sorting-checkweigher": "Elija la LITUBO LT-150LR cuando productos pequeños de 3 a 500 g necesiten pesaje dinámico y separación inmediata izquierda-derecha.",
"lt-150lrh-high-speed-left-right-sorting-checkweigher": "Elija la LITUBO LT-150LRH cuando productos pequeños de 3 a 500 g requieran una clasificación izquierda-derecha de mayor velocidad.",
"lt-220-standard-online-checkweigher": "Utilice la LITUBO LT-220 como punto práctico de control de peso en línea para productos envasados de 5 a 1500 g.",
"lt-220l-standard-l-series-online-checkweigher": "Elija la LITUBO LT-220L para productos de 5 a 1000 g que necesiten una banda de 220 mm en una disposición L-series más ligera.",
"lt-220lr-standard-left-right-sorting-checkweigher": "Utilice la LITUBO LT-220LR para productos de 5 a 1500 g que necesiten una banda más ancha de 220 mm y clasificación en dos sentidos.",
"lt-300-medium-range-online-checkweigher": "Utilice la LITUBO LT-300 cuando productos de 5 g a 3 kg necesiten un control de peso en línea fiable sobre un transportador de 300 mm.",
"lt-300l-wide-belt-l-series-online-checkweigher": "Elija la LITUBO LT-300L para envases anchos pero ligeros que requieran una banda de 300 mm manteniéndose en un rango de 5 a 1000 g.",
"lt-400-heavy-duty-online-checkweigher": "Utilice la LITUBO LT-400 para productos envasados de 100 g a 10 kg que superen el rango práctico de las pesadoras más pequeñas.",
"lt-450-large-range-online-checkweigher": "Elija la LITUBO LT-450 para bolsas, cajas, estuches y otros productos envasados de hasta 30 kg.",
"lt-50-mining-belt-conveyor-metal-detector": "Utilice la serie LITUBO LT-50 para detectar contaminación de hierro, acero al manganeso, cobre, aluminio y acero inoxidable en mineral, carbón y otros materiales a granel…",
"lt-600-extra-large-online-checkweigher": "Utilice la LITUBO LT-600 para sacos grandes, cartones y envases pesados de hasta 50 kg que requieran una banda de 600 mm.",
"lt-am-digital-aluminum-foil-metal-detector-series": "Elija la serie LITUBO LT-AM cuando el envasado en lámina de aluminio dificulte la detección convencional de metales.",
"lt-hs100-pipeline-metal-detector-100mm": "Elija la LITUBO LT-HS100 para polvos, partículas, líquidos y pastas de flujo medio que requieran una conexión de tubería de 100 mm.",
"lt-hs150-pipeline-metal-detector-150mm": "Utilice la LITUBO LT-HS150 para aplicaciones de polvo, granulado, líquido y pasta de mayor flujo con una conexión de tubería de 150 mm.",
"lt-hs200-pipeline-metal-detector-200mm": "Elija la LITUBO LT-HS200 para corrientes de proceso de gran volumen que requieran una conexión de tubería de 200 mm y un flujo de referencia de hasta aproximadamente 10 t/h.",
"lt-hs80-pipeline-metal-detector-80mm": "Utilice la LITUBO LT-HS80 para la detección de metales antes del envasado en aplicaciones de polvo, granulado, líquido y pasta de menor flujo con conexión de 80 mm.",
"lt-js220-metal-detector-checkweigher-combo": "Utilice la LITUBO LT-JS220 cuando una misma línea de producción necesite control de contaminación metálica y verificación dinámica de peso.",
"lt-m-digital-all-metal-detector-series": "Utilice la serie LITUBO LT-M para detectar contaminación férrica, no férrica y de acero inoxidable en productos envasados o sueltos sobre un transportador.",
"lt-t300-checkweigher-labeling-machine-combo": "Elija la LITUBO LT-T300 cuando la verificación de peso y la impresión de etiquetas variables deban realizarse en una sola estación controlada.",
"xr-1000d-handheld-backscatter-x-ray-inspection-system": "El LITUBO XR-1000D es un sistema de inspección por rayos X de retrodispersión de mano para aplicaciones especiales de seguridad e inspección in situ.",
"xr-100c-1-rechargeable-portable-x-ray-fluoroscopy-instrument": "El LITUBO XR-100C-1 es un instrumento de fluoroscopía portátil recargable para clientes que necesiten imagen interna móvil en tiempo real con un campo de visión de Φ100 mm…",
"xr-100c-2-portable-x-ray-fluoroscopy-system-for-special-imaging-applications": "El LITUBO XR-100C-2 es un sistema de fluoroscopía portátil diseñado para aplicaciones de imagen especiales que requieren un campo de visión de Φ100 mm en tiempo real…",
"xr-100c-portable-x-ray-fluoroscopy-instrument": "El LITUBO XR-100C es un instrumento de fluoroscopía portátil con un campo de visión de Φ100 mm, mayor que el de los modelos compactos de Φ50 mm.",
"xr-200d-compact-food-x-ray-inspection-system": "El LITUBO XR-200D es un sistema compacto de inspección de alimentos por rayos X diseñado para productos envasados pequeños y líneas con espacio de instalación limitado…",
"xr-300d-small-to-medium-food-x-ray-inspection-system": "El LITUBO XR-300D es un sistema de inspección de alimentos por rayos X para producción pequeña y mediana, pensado para productos envasados que requieren un rango de inspección más amplio…",
"xr-3500d-bulk-material-x-ray-inspection-system": "El LITUBO XR-3500D es un sistema de inspección por rayos X para material a granel, diseñado para productos alimenticios sueltos, sin envasar y de alimentación continua.",
"xr-4000d-fish-bone-dual-energy-x-ray-inspection-system": "El LITUBO XR-4000D es un sistema de inspección por rayos X especializado en la detección de espinas de pescado y cuerpos extraños en el procesado de pescado y marisco.",
"xr-5000d-side-beam-x-ray-inspection-system-for-bottles-cans-and-jars": "El LITUBO XR-5000D es un sistema de inspección por rayos X de haz lateral diseñado para botellas, latas, tarros y envases verticales.",
"xr-500d-standard-food-x-ray-foreign-object-detector": "El LITUBO XR-500D es un detector estándar de cuerpos extraños por rayos X para productos alimenticios envasados que circulan por un transportador en línea.",
"xr-50c-compact-portable-x-ray-fluoroscopy-instrument": "El LITUBO XR-50C es un instrumento de fluoroscopía portátil compacto diseñado para la inspección de objetos pequeños y aplicaciones especiales de imagen.",
"xr-600d-large-channel-food-x-ray-inspection-system": "El LITUBO XR-600D es un sistema de inspección de alimentos por rayos X de canal grande, diseñado para productos envasados más anchos y líneas que requieren más…",
"xr-6550g-heavy-duty-large-channel-x-ray-inspection-system": "El LITUBO XR-6550G es un sistema de inspección por rayos X de canal grande para servicio pesado, destinado a envases grandes, cartones y productos más pesados.",
"xr-700-industrial-x-ray-inspection-system-for-shoes-bags-toys-and-components": "El LITUBO XR-700 es un sistema industrial de inspección por rayos X diseñado para clientes que necesitan inspeccionar productos no alimentarios como calzado, bolsos…",
"xr-800-industrial-x-ray-screening-system-for-quality-and-safety-inspection": "El LITUBO XR-800 es un sistema industrial de cribado por rayos X adecuado para clientes que necesitan inspección de imagen por rayos X de productos, envases o piezas industriales…",
"xr-900-large-industrial-x-ray-inspection-system-for-foreign-object-screening": "El LITUBO XR-900 es un sistema industrial de inspección por rayos X de mayor tamaño, diseñado para clientes que necesitan un canal de inspección más ancho y mayor…",
}

items = call("GET", "/items/products?limit=200&fields=id,slug", token=tok)["data"]
by_slug = {i["slug"]: i["id"] for i in items}
ok = fail = 0
for slug, es in S.items():
    pid = by_slug.get(slug)
    if not pid:
        print("  miss", slug); fail += 1; continue
    try:
        call("PATCH", f"/items/products/{pid}", {"summary_es": es}, token=tok); ok += 1
    except Exception as e:
        print("  err", slug, e); fail += 1
print(f"  摘要写入: 成功 {ok} / 失败 {fail}")
