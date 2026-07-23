const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');

const DL = "C:/Users/user/Downloads/";
const PROD = DL + "Hydrogen Production Projects Database - June 2026.xlsx";
const INFRA = DL + "Hydrogen Infrastracture Projects Database - June 2026.xlsx";

// Centroids matching python C dictionary
const C = {
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
};

function region(lng, lat) {
  if (lng < -25) return "americas";
  if (lng <= 45 && lat > 34) return "europe";
  if (lng <= 63) {
    return lat >= 15 ? "mena" : "africa";
  }
  return "apac";
}

function jitter(iso, idx) {
  const a = idx * 2.39996;
  const r = 0.25 + 0.09 * Math.sqrt(idx);
  return [
    Math.min(r, 2.2) * Math.cos(a),
    Math.min(r, 2.2) * Math.sin(a) * 0.7
  ];
}

function classify(s) {
  const t = String(s || "").toLowerCase();
  if (["cancel","dormant","on hold","decommis","removed","paused"].some(k => t.includes(k))) return "atrisk";
  if (["fid","construction"].some(k => t.includes(k))) return "construction";
  if (["operational","demo"].some(k => t.includes(k))) return "operating";
  return "planned";
}

function color(tech) {
  const t = String(tech || "").toLowerCase();
  if (t.includes("ccus")) return t.includes("coal") ? "brown" : "blue";
  if (t.includes("electroly") || ["alk","pem","soec","aem"].includes(t)) return "green";
  if (t.includes("pyroly")) return "turquoise";
  return "gray_blue";
}

function calculateScale(mwel, kt) {
  let v = parseFloat(mwel);
  if (isNaN(v)) {
    v = parseFloat(kt) * 60;
  }
  if (!v || isNaN(v)) return 1;
  const thresholds = [[1, 1], [10, 2], [50, 3], [200, 4], [500, 5], [1000, 6]];
  for (const [lim, s] of thresholds) {
    if (v < lim) return s;
  }
  return 7;
}

function clean(x, n = 60) {
  if (x === null || x === undefined) return "";
  const s = String(x).replace(/\s+/g, " ").trim();
  return s.slice(0, n);
}

const feats = [];
const cc_idx = {};
let skipped = 0;

function addFeature(name, iso, status, subtype, cat, cap, year, lat, lng, tech, endUses = null) {
  iso = clean(iso, 3).toUpperCase();
  let approx = false;
  if (lat === null || lat === undefined || lng === null || lng === undefined || isNaN(lat) || isNaN(lng)) {
    if (!C[iso]) {
      skipped++;
      return;
    }
    const base = C[iso];
    cc_idx[iso] = (cc_idx[iso] || 0) + 1;
    const [dx, dy] = jitter(iso, cc_idx[iso]);
    lng = base[0] + dx;
    lat = base[1] + dy;
    approx = true;
  }
  const sc = classify(status);
  if (String(status || "").toLowerCase().includes("removed")) {
    skipped++;
    return;
  }

  const props = {
    name: clean(name),
    country: iso,
    status: clean(status, 28),
    statusClass: sc,
    subtype: clean(subtype, 40),
    category: cat,
    color: color(tech || subtype),
    capacity: clean(cap, 38) || "n/a",
    updated: clean(year, 12),
    region: region(lng, lat),
    approx: approx ? 1 : 0,
    tier: "iea"
  };

  if (endUses) {
    Object.assign(props, endUses);
  }

  feats.push({
    type: "Feature",
    geometry: {
      type: "Point",
      coordinates: [parseFloat(lng.toFixed(3)), parseFloat(lat.toFixed(3))]
    },
    properties: props
  });
}

// 1. Process Hydrogen Production Projects
console.log("Loading production sheet...");
const wbProd = XLSX.readFile(PROD);
const wsProd = wbProd.Sheets["Hydrogen production projects"];
const rowsProd = XLSX.utils.sheet_to_json(wsProd, { header: 1 });
console.log(`Processing ${rowsProd.length - 2} rows from production database...`);
// Skip first two rows
for (let i = 2; i < rowsProd.length; i++) {
  const r = rowsProd[i];
  if (!r || !r[1]) continue;
  let lat = null, lng = null;
  try {
    if (r[31] !== null && r[31] !== undefined && r[32] !== null && r[32] !== undefined && Math.abs(parseFloat(r[31])) <= 90 && Math.abs(parseFloat(r[32])) <= 180 && (parseFloat(r[31]) || parseFloat(r[32]))) {
      lat = parseFloat(r[31]);
      lng = parseFloat(r[32]);
    }
  } catch (err) {}

  let cap = "";
  if (r[26]) cap = `${r[26]} MWel`;
  else if (r[28]) cap = `${r[28]} kt H2/y`;
  else if (r[25]) cap = clean(r[25], 38);

  const f_scale = calculateScale(r[26], r[28]);

  const refs = [];
  for (let cIdx = 34; cIdx < r.length; cIdx++) {
    if (r[cIdx]) {
      const cleanedRef = String(r[cIdx]).trim();
      if (cleanedRef && (cleanedRef.startsWith("http") || cleanedRef.includes(".") || cleanedRef.length > 8)) {
        refs.push(cleanedRef);
      }
    }
  }

  const endUses = {
    end_refining: r[11] ? 1 : 0,
    end_ammonia: r[12] ? 1 : 0,
    end_methanol: r[13] ? 1 : 0,
    end_iron_steel: r[14] ? 1 : 0,
    end_other_ind: r[15] ? 1 : 0,
    end_mobility: r[16] ? 1 : 0,
    end_power: r[17] ? 1 : 0,
    end_grid_inj: r[18] ? 1 : 0,
    end_chp: r[19] ? 1 : 0,
    end_domestic_heat: r[20] ? 1 : 0,
    end_biofuels: r[21] ? 1 : 0,
    end_synfuels: r[22] ? 1 : 0
  };

  if (refs.length > 0) {
    endUses.refs = refs.join("|");
  }

  addFeature(r[1], r[2], r[5], clean(r[7] || r[6], 40) || "Production", "production", cap, r[3], lat, lng, String(r[6] || ""), endUses);
  if (feats.length > 0) {
    feats[feats.length - 1].properties.scale = f_scale;
  }
}

// 2. Process Infrastructure Projects
console.log("Loading infrastructure sheet...");
const wbInfra = XLSX.readFile(INFRA);
function processSheet(sheetName, fn) {
  const ws = wbInfra.Sheets[sheetName];
  if (!ws) return;
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
  console.log(`Processing sheet ${sheetName} (${rows.length - 1} rows)...`);
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    if (r && (r[1] || r[2])) fn(r);
  }
}

processSheet("UNDERGROUND H2 STORAGE", r => addFeature(r[1], r[2], r[10], String(r[12] || "Underground storage"), "storage", clean(r[13], 38), r[7], null, null, ""));
processSheet("NH3 INFRASTRUCTURE AT PORTS", r => addFeature(`${r[1]} (${clean(r[5], 14)})`, r[4], r[10], "NH3 port infrastructure", "terminal", clean(r[11] || r[12], 38), r[8], null, null, ""));
processSheet("NH3 CRACKING PLANTS", r => addFeature(r[1], r[4] !== undefined ? r[4] : r[2], r[10] !== undefined ? r[10] : "", "NH3 cracking plant", "terminal", "", "", null, null, ""));
processSheet("H2 INFRASTRUCTURE AT PORTS", r => addFeature(r[1], r[4] !== undefined ? r[4] : r[2], r[10] !== undefined ? r[10] : "", "H2 port infrastructure", "terminal", "", "", null, null, ""));
processSheet("H2 BLENDING", r => addFeature(r[1], r[2], r[8], "H2 grid blending", "end_use", clean(r[10], 38), r[6], null, null, ""));

feats.forEach(f => {
  if (f.properties.scale === undefined) {
    f.properties.scale = 1;
  }
});

const out = {
  type: "FeatureCollection",
  features: feats
};

const meta = {
  count: feats.length,
  approx: feats.filter(f => f.properties.approx === 1).length,
  skipped: skipped,
  label: "IEA Hydrogen Production & Infrastructure Projects Databases (June 2026, CC BY 4.0)",
  source: "https://www.iea.org/data-and-statistics/data-tools/hydrogen-tracker"
};

const outputFilePath = path.join(__dirname, 'js/iea-data.js');
const fileContent = `// Generated by build-iea.js from the IEA databases (CC BY 4.0). Do not hand-edit.
window.IEA_META = ${JSON.stringify(meta, null, 2)};
window.IEA_DATA = ${JSON.stringify(out)};
`;

fs.writeFileSync(outputFilePath, fileContent, 'utf8');
console.log(`Successfully generated js/iea-data.js with ${feats.length} features.`);
