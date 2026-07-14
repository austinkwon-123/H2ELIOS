#!/usr/bin/env python3
"""H2Grid — IEA database converter.
Reads the IEA Hydrogen Production + Infrastructure Projects Databases (June 2026,
CC BY 4.0) and emits iea-data.js: a compact GeoJSON tier of 'announced' projects.
Real lat/lng used where present (81% of production rows); otherwise country
centroid + deterministic golden-angle jitter, flagged approx."""
import openpyxl, json, math, re, sys

DL = "/sessions/busy-nifty-allen/mnt/Downloads/"
PROD = DL + "Hydrogen Production Projects Database - June 2026.xlsx"
INFRA = DL + "Hydrogen Infrastracture Projects Database - June 2026.xlsx"

C = {  # ISO3 -> [lng, lat] rough centroids
"USA":[-98.5,39.8],"CAN":[-106.3,56.1],"MEX":[-102.5,23.6],"BRA":[-51.9,-14.2],"CHL":[-71.5,-35.7],
"ARG":[-63.6,-38.4],"COL":[-74.3,4.6],"PER":[-75.0,-9.2],"URY":[-55.8,-32.5],"BOL":[-63.6,-16.3],
"PRY":[-58.4,-23.4],"ECU":[-78.2,-1.8],"VEN":[-66.6,6.4],"CRI":[-84.0,9.7],"PAN":[-80.8,8.5],
"DOM":[-70.2,18.7],"TTO":[-61.2,10.7],"JAM":[-77.3,18.1],"GTM":[-90.2,15.8],"HND":[-86.2,15.2],
"NLD":[5.3,52.1],"DEU":[10.4,51.2],"FRA":[2.2,46.2],"ESP":[-3.7,40.4],"PRT":[-8.2,39.4],
"GBR":[-3.4,55.4],"IRL":[-8.2,53.4],"ITA":[12.6,41.9],"BEL":[4.5,50.5],"LUX":[6.1,49.8],
"DNK":[9.5,56.3],"SWE":[18.6,60.1],"NOR":[8.5,60.5],"FIN":[25.7,61.9],"ISL":[-19.0,64.9],
"EST":[25.0,58.6],"LVA":[24.6,56.9],"LTU":[23.9,55.2],"POL":[19.1,51.9],"CZE":[15.5,49.8],
"SVK":[19.7,48.7],"AUT":[14.6,47.5],"CHE":[8.2,46.8],"HUN":[19.5,47.2],"ROU":[24.9,45.9],
"BGR":[25.5,42.7],"GRC":[21.8,39.1],"HRV":[15.2,45.1],"SVN":[14.9,46.2],"SRB":[21.0,44.0],
"UKR":[31.2,48.4],"TUR":[35.2,38.9],"CYP":[33.4,35.1],"MLT":[14.4,35.9],"ALB":[20.2,41.2],
"SAU":[45.1,23.9],"ARE":[53.8,23.4],"OMN":[57.0,21.5],"QAT":[51.2,25.4],"KWT":[47.5,29.3],
"BHR":[50.6,26.0],"ISR":[34.9,31.0],"JOR":[36.2,30.6],"EGY":[30.8,26.8],"MAR":[-7.1,31.8],
"DZA":[1.7,28.0],"TUN":[9.5,33.9],"LBY":[17.2,26.3],"IRQ":[43.7,33.2],"IRN":[53.7,32.4],
"MRT":[-10.9,21.0],"NAM":[18.5,-22.9],"ZAF":[22.9,-30.6],"KEN":[37.9,-0.02],"ETH":[40.5,9.1],
"NGA":[8.7,9.1],"GHA":[-1.0,7.9],"SEN":[-14.5,14.5],"CIV":[-5.5,7.5],"AGO":[17.9,-11.2],
"MOZ":[35.5,-18.7],"TZA":[34.9,-6.4],"UGA":[32.3,1.4],"ZWE":[29.2,-19.0],"BWA":[24.7,-22.3],
"COD":[21.8,-4.0],"GAB":[11.6,-0.8],"CMR":[12.4,7.4],"MLI":[-4.0,17.6],"DJI":[42.6,11.8],
"CHN":[104.2,35.9],"JPN":[138.3,36.2],"KOR":[127.8,36.5],"IND":[78.9,20.6],"AUS":[133.8,-25.3],
"NZL":[174.9,-40.9],"SGP":[103.8,1.35],"MYS":[101.9,4.2],"IDN":[113.9,-0.8],"THA":[101.0,15.9],
"VNM":[108.3,14.1],"PHL":[121.8,12.9],"BRN":[114.7,4.5],"KAZ":[66.9,48.0],"UZB":[64.6,41.4],
"PAK":[69.3,30.4],"BGD":[90.4,23.7],"LKA":[80.8,7.9],"TWN":[121.0,23.7],"MNG":[103.8,46.9],
"RUS":[105.3,61.5],"GEO":[43.4,42.3],"ARM":[45.0,40.1],"AZE":[47.6,40.1],"TKM":[59.6,38.97],
}

def region(lng, lat):
    if lng < -25: return "americas"
    if lng <= 45 and lat > 34: return "europe"
    if lng <= 63:
        return "mena" if lat >= 15 else "africa"
    return "apac"

def jitter(iso, idx):
    # deterministic golden-angle spiral around centroid, up to ~2.2 deg
    a = idx * 2.39996
    r = 0.25 + 0.09 * math.sqrt(idx)
    return min(r, 2.2) * math.cos(a), min(r, 2.2) * math.sin(a) * 0.7

def classify(s):
    t = str(s or "").lower()
    if any(k in t for k in ["cancel","dormant","on hold","decommis","removed","paused"]): return "atrisk"
    if any(k in t for k in ["fid","construction"]): return "construction"
    if any(k in t for k in ["operational","demo"]): return "operating"
    return "planned"

def color(tech):
    t = str(tech or "").lower()
    if "ccus" in t: return "brown" if "coal" in t else "blue"
    if "electroly" in t or t in ("alk","pem","soec","aem"): return "green"
    if "pyroly" in t: return "turquoise"
    return "gray_blue"

def scale(mwel, kt):
    v = None
    try: v = float(mwel)
    except: pass
    if v is None:
        try: v = float(kt) * 60  # ~kt/y -> MWel rough
        except: pass
    if not v: return 1
    for lim, s in [(1,1),(10,2),(50,3),(200,4),(500,5),(1000,6)]:
        if v < lim: return s
    return 7

def clean(x, n=60):
    s = re.sub(r"\s+", " ", str(x or "")).strip()
    return s[:n]

feats, cc_idx, skipped = [], {}, 0

def add(name, iso, status, subtype, cat, cap, year, lat=None, lng=None, tech=""):
    global skipped
    iso = clean(iso, 3).upper()
    approx = False
    if lat is None or lng is None:
        if iso not in C: skipped += 1; return
        base = C[iso]; cc_idx[iso] = cc_idx.get(iso, 0) + 1
        dx, dy = jitter(iso, cc_idx[iso])
        lng, lat = base[0] + dx, base[1] + dy
        approx = True
    sc = classify(status)
    if "removed" in str(status or "").lower(): skipped += 1; return
    feats.append({"type":"Feature","geometry":{"type":"Point","coordinates":[round(float(lng),3),round(float(lat),3)]},
        "properties":{"name":clean(name),"country":iso,"status":clean(status,28),"statusClass":sc,
        "subtype":clean(subtype,40),"category":cat,"color":color(tech or subtype),
        "capacity":clean(cap,38) or "n/a","updated":clean(year,12),"region":region(lng,lat),
        "approx":1 if approx else 0,"tier":"iea"}})

# ---- Production projects ----
wb = openpyxl.load_workbook(PROD, read_only=True, data_only=True)
ws = wb["Hydrogen production projects"]; rows = ws.iter_rows(values_only=True); next(rows); next(rows)
for r in rows:
    if not r[1]: continue
    lat = lng = None
    try:
        if r[31] is not None and r[32] is not None and abs(float(r[31]))<=90 and abs(float(r[32]))<=180 and (float(r[31]) or float(r[32])):
            lat, lng = float(r[31]), float(r[32])
    except: pass
    cap = ""
    if r[26]: cap = f"{r[26]} MWel"
    elif r[28]: cap = f"{r[28]} kt H2/y"
    elif r[25]: cap = clean(r[25], 38)
    f_scale = scale(r[26], r[28])
    add(r[1], r[2], r[5], clean(r[7] or r[6], 40) or "Production", "production", cap, r[3], lat, lng, str(r[6]))
    if feats: feats[-1]["properties"]["scale"] = f_scale
wb.close()

# ---- Infrastructure ----
wb = openpyxl.load_workbook(INFRA, read_only=True, data_only=True)
def sheet(name, fn):
    ws = wb[name]; rows = ws.iter_rows(values_only=True); next(rows)
    for r in rows:
        if r[1] or r[2]: fn(r)
sheet("UNDERGROUND H2 STORAGE", lambda r: add(r[1], r[2], r[10], str(r[12] or "Underground storage"), "storage", clean(r[13],38), r[7]))
sheet("NH3 INFRASTRUCTURE AT PORTS", lambda r: add(f"{r[1]} ({clean(r[5],14)})", r[4], r[10], "NH3 port infrastructure", "terminal", clean(r[11] or r[12],38), r[8]))
sheet("NH3 CRACKING PLANTS", lambda r: add(r[1], r[4] if len(r)>4 else r[2], r[10] if len(r)>10 else "", "NH3 cracking plant", "terminal", "", ""))
sheet("H2 INFRASTRUCTURE AT PORTS", lambda r: add(r[1], r[4] if len(r)>4 else r[2], r[10] if len(r)>10 else "", "H2 port infrastructure", "terminal", "", ""))
sheet("H2 BLENDING", lambda r: add(r[1], r[2], r[8], "H2 grid blending", "end_use", clean(r[10],38), r[6]))
wb.close()

for f in feats:
    f["properties"].setdefault("scale", 1)

out = {"type":"FeatureCollection","features":feats}
from collections import Counter
sc = Counter(f["properties"]["statusClass"] for f in feats)
rg = Counter(f["properties"]["region"] for f in feats)
ap = sum(f["properties"]["approx"] for f in feats)
meta = {"count":len(feats),"approx":ap,"skipped":skipped,
        "label":"IEA Hydrogen Production & Infrastructure Projects Databases (June 2026, CC BY 4.0)",
        "source":"https://www.iea.org/data-and-statistics/data-tools/hydrogen-tracker"}
with open("/sessions/busy-nifty-allen/mnt/outputs/hydrogen-map-v6/iea-data.js","w") as fo:
    fo.write("// Generated by build-iea.py from the IEA databases (CC BY 4.0). Do not hand-edit.\n")
    fo.write("window.IEA_META = " + json.dumps(meta) + ";\n")
    fo.write("window.IEA_DATA = " + json.dumps(out, separators=(",",":")) + ";\n")
print("features:", len(feats), "| approx:", ap, "| skipped:", skipped)
print("status:", dict(sc)); print("regions:", dict(rg))
