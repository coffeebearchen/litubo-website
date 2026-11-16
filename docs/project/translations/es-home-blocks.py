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

BLOCKS = {
"home.hero": dict(
  eyebrow_es="INSPECCIÓN DE ALIMENTOS Y ENVASES",
  title_es="Diseñado para una producción más segura.",
  body_es="Sistemas de inspección fiables y un soporte experto ayudan a los fabricantes de alimentos y envases a ofrecer productos seguros y de alta calidad."),
"home.families": dict(
  eyebrow_es="Las familias de productos",
  title_es="Encuentre su punto de partida.",
  body_es="Cinco familias de inspección. La selección final del modelo se define según su aplicación."),
"home.production": dict(
  eyebrow_es="En la línea",
  title_es="Toda decisión de inspección parte del producto y del envase.",
  body_es="El caudal, el formato del envase y el espacio disponible deciden tanto como la tecnología. Revisamos esas condiciones con usted antes de recomendar una configuración."),
"home.applications": dict(
  eyebrow_es="Inspección por aplicación",
  title_es="Su producto. Sus preguntas de inspección.",
  body_es="Comience por una aplicación. La idoneidad final depende del producto, el envase y las condiciones de la línea."),
"home.process": dict(
  eyebrow_es="Cómo trabajamos",
  title_es="Tres pasos para una respuesta útil.",
  body_es="Sin emparejamiento automático. Cada consulta la revisa nuestro equipo técnico."),
"home.process.step1": dict(
  eyebrow_es="",
  title_es="Describa el producto y el envase",
  body_es="La forma del producto, el material del envase y el punto de la línea donde se ubicaría la inspección."),
"home.process.step2": dict(
  eyebrow_es="",
  title_es="Revise la tarea de inspección",
  body_es="El cuerpo extraño o el control de peso que necesita tratar, y las condiciones que lo rodean."),
"home.process.step3": dict(
  eyebrow_es="",
  title_es="Acuerde la configuración",
  body_es="El modelo, la apertura, el método de rechazo y los detalles de instalación se confirman con nuestro equipo técnico."),
"home.blog": dict(
  eyebrow_es="Blog y análisis",
  title_es="Ideas prácticas. Una conversación más clara.",
  body_es=""),
}

rows = call("GET", "/items/site_content?limit=100&fields=id,content_key", token=tok)["data"]
by_key = {r["content_key"]: r["id"] for r in rows}
ok = fail = 0
for key, patch in BLOCKS.items():
    rid = by_key.get(key)
    if not rid:
        print("  miss", key); fail += 1; continue
    try:
        call("PATCH", f"/items/site_content/{rid}", patch, token=tok); ok += 1
    except Exception as e:
        print("  err", key, e); fail += 1
print(f"  首页块西语: 成功 {ok} / 失败 {fail}")
