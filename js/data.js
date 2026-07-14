// H₂Grid — data.js (v4)
// US dataset from the Gemini Deep Research report (2026-07-08) + DOE hubs,
// Asia-Pacific (v3), and the July 2026 global assessment (v4): Europe, MENA,
// Africa, LatAm, Canada, electrolyzer gigafactories, contracted corridors.
// color: green | blue | pink | turquoise | gray_blue | gray | brown | mfg
// region: americas | latam | europe | mena | africa | apac
// scale: 1–8 relative capacity tier (drives marker size; see capacity for actuals)

window.HYDROGEN_DATA = {

  upstream: {
    type: "FeatureCollection",
    features: [
      feat([-76.4111, 43.5253], {
        name: "Nine Mile Point Nuclear Station", category: "upstream", subtype: "Nuclear Plant",
        color: "pink", capacity: "1.25 MW (electrolyzer)", status: "Operating", scale: 2,
        operator: "Constellation Energy", source: "https://www.osti.gov/biblio/3020015", updated: "2023"
      }),
      feat([-92.6336, 44.6206], {
        name: "Prairie Island Nuclear Generating Plant", category: "upstream", subtype: "Nuclear Plant",
        color: "pink", capacity: "240 kW (electrolyzer)", status: "Under Construction", scale: 1,
        operator: "Xcel Energy / Bloom Energy", source: "https://www.ans.org/news/tag-prairie%20island/", updated: "2024"
      }),
      feat([-83.0850, 41.5964], {
        name: "Davis-Besse Nuclear Power Station", category: "upstream", subtype: "Nuclear Plant",
        color: "pink", capacity: "2 MW (electrolyzer)", status: "Planned", scale: 2,
        operator: "Energy Harbor", source: "https://pubs.aip.org/physicstoday/article-pdf/73/8/20/10124577/20_1_online.pdf", updated: "2022"
      }),
      feat([-79.0377, 43.0962], {
        name: "Niagara Power Project", category: "upstream", subtype: "Hydroelectric Dam",
        color: "green", capacity: "120 MW (contracted to Plug Power)", status: "Operating", scale: 5,
        operator: "NYPA", source: "https://www.nypa.gov/news/press-releases/2023/20230525-economic-development-awards", updated: "2023"
      }),
      feat([-119.8614, 47.9475], {
        name: "Wells Dam / Douglas County PUD", category: "upstream", subtype: "Hydroelectric Dam",
        color: "green", capacity: "5 MW (electrolyzer)", status: "Operating", scale: 2,
        operator: "Douglas County PUD", source: "https://www.airswift.com/blog/green-hydrogen-projects-usa", updated: "2025"
      }),
      feat([-112.5766, 39.4600], {
        name: "ACES Delta Renewable Energy (Solar/Wind)", category: "upstream", subtype: "Solar / Wind",
        color: "green", capacity: ">220 MW", status: "Operating", scale: 6,
        operator: "ACES Delta", source: "https://aces-delta.com/sites/", updated: "Feb 2026"
      }),
      feat([-111.7574, 32.8795], {
        name: "Casa Grande Solar", category: "upstream", subtype: "Solar Farm",
        color: "green", capacity: "10 MT/D equivalent", status: "Planned", scale: 3,
        operator: "Air Products", source: "https://www.airswift.com/blog/green-hydrogen-projects-usa", updated: "2024"
      }),
      feat([119.6000, -20.5000], {
        name: "Australian Renewable Energy Hub (AREH)", category: "upstream", subtype: "Wind + Solar Mega-Hub",
        color: "green", capacity: "26 GW renewables (proposed)", status: "At risk — bp withdrew mid-2025", scale: 8, region: "apac",
        note: "bp exited AREH and H2Kwinana in mid-2025 citing unbankable green ammonia export economics. Intercontinental Energy retains federal development backing (Feb 2026) but the project is effectively stalled.",
        operator: "Intercontinental Energy (bp withdrawn)", source: "https://www.pv-magazine-australia.com/2026/02/04/developer-lands-federal-backing-for-26-gw-green-hydrogen-hub-in-was-pilbara/", updated: "2026"
      })
    ]
  },

  production: {
    type: "FeatureCollection",
    features: [
      // ---- Americas ----
      feat([-81.7182, 30.9502], {
        name: "Woodbine Hydrogen Plant", category: "production", subtype: "Electrolyzer",
        color: "green", capacity: "15 MT/D", status: "Operating", scale: 3,
        operator: "Plug Power", source: "https://advancedbiofuelsusa.info/plug-power-starts-production-of-liquid-green-hydrogen-at-its-georgia-plant", updated: "Jan 2024"
      }),
      feat([-91.0940, 30.2635], {
        name: "St. Gabriel Hydrogen Plant", category: "production", subtype: "Electrolyzer",
        color: "green", capacity: "15 MT/D", status: "Operating", scale: 3,
        operator: "Plug Power / Olin Corp", source: "https://www.airswift.com/blog/green-hydrogen-projects-usa", updated: "April 2025"
      }),
      feat([-78.3894, 43.0836], {
        name: "Genesee County Hydrogen Project (STAMP)", category: "production", subtype: "Electrolyzer",
        color: "green", capacity: "74 MT/D (120 MW) — as designed", status: "Cancelled Mar 2026", scale: 5,
        note: "Plug Power abandoned the mega-project in March 2026, selling the site and substation to Stream Data Centers for $132.5M to conserve capital — a landmark casualty of the US green-H2 correction.",
        operator: "Plug Power", source: "https://www.hydrogeninsight.com/production/", updated: "Mar 2026"
      }),
      feat([-79.0455, 43.0918], {
        name: "Niagara Falls Hydrogen Project", category: "production", subtype: "Electrolyzer",
        color: "green", capacity: "35 MW", status: "Under Construction", scale: 4,
        operator: "Linde", source: "https://www.airswift.com/blog/green-hydrogen-projects-usa", updated: "2025"
      }),
      feat([-93.9400, 29.8850], {
        name: "Port Arthur SMR-CCS", category: "production", subtype: "SMR + CCS",
        color: "blue", capacity: ">1,000,000 MT CO2 captured/yr", status: "Operating", scale: 6,
        operator: "Air Products", source: "https://www.osti.gov/biblio/1437618", updated: "2018"
      }),
      feat([-94.9774, 29.7355], {
        name: "Baytown Blue Hydrogen", category: "production", subtype: "SMR + CCS",
        color: "blue", capacity: "1 Billion scf/day", status: "Paused / Delayed", scale: 7,
        note: "Explicitly shelved Nov 2025: weak customer demand and unbankable economics for the CCS premium.",
        operator: "ExxonMobil", source: "https://www.enverus.com/blog/blue-freeze-exxon-mobil-pauses-major-clean-hydrogen-project/", updated: "Nov 2025"
      }),
      feat([-87.42, 39.53], {
        name: "Wabash Valley Resources", category: "production", subtype: "Coal Gasification + CCS",
        color: "brown", capacity: "1.6–1.7 MM MT CO2 captured/yr", status: "Under Construction", scale: 5,
        operator: "Wabash Valley Resources", source: "https://www.epa.gov/system/files/documents/2023-07/IN-167-6A-0001_Wabash_Draft_Permit.pdf", updated: "2025"
      }),
      feat([-90.9973, 30.1030], {
        name: "Donaldsonville Complex", category: "production", subtype: "Electrolyzer (cancelled) / SMR+CCS",
        color: "blue", capacity: "2 MM MT CO2 captured/yr (blue ammonia JV)", status: "Pivoted to Blue", scale: 6,
        operator: "CF Industries / ExxonMobil", source: "https://decarbonfuse.com/posts/cf-industries-cancels-electrolyzer-project-pivots-to-carbon-capture-strategy", updated: "Dec 2025"
      }),
      feat([-112.5760, 39.4550], {
        name: "Advanced Clean Energy Storage (ACES) Phase 1", category: "production", subtype: "Electrolyzer",
        color: "green", capacity: "100 MT/D (220 MW)", status: "Operating (100% load Feb 2026)", scale: 6,
        note: "All 40 HydrogenPro electrolyzers reached full load in Feb 2026 — the world's largest proof of renewable H2 + salt-cavern seasonal storage integration.",
        operator: "Mitsubishi Power / Chevron", source: "https://aces-delta.com/sites/", updated: "Feb 2026"
      }),
      feat([-90.9200, 30.2000], {
        name: "Louisiana Clean Energy Complex", category: "production", subtype: "ATR + CCS (blue H2 & ammonia)",
        color: "blue", capacity: "~750 MMscf/day H2 (design)", status: "Under Construction (scope revised 2025)", scale: 7,
        operator: "Air Products", source: "https://www.airproducts.com/campaigns/la-blue-hydrogen-project", updated: "2025"
      }),
      // ---- Asia-Pacific ----
      feat([82.9587, 41.7159], {
        name: "Sinopec Kuqa Green Hydrogen Plant", category: "production", subtype: "Electrolyzer (world's largest operating)",
        color: "green", capacity: "260 MW / 20,000 t/yr", status: "Operating (ramping to full output)", scale: 7, region: "apac",
        note: "Ran at roughly 20% utilization through 2024–25 due to intermittent-solar integration issues; full 20,000 t/yr ramp reached only in late 2025.",
        operator: "Sinopec (Xinjiang, China)", source: "https://www.woodmac.com/news/opinion/hydrogen-case-study-sinopec-kuqa-project/", updated: "2026"
      }),
      feat([109.7800, 39.6100], {
        name: "Sinopec Ordos Green Hydrogen Project", category: "production", subtype: "Electrolyzer",
        color: "green", capacity: "~390 MW / 30,000 t/yr", status: "Under Construction", scale: 7, region: "apac",
        note: "Will feed the Zhongtian Hechuang coal deep-processing site.",
        operator: "Sinopec (Inner Mongolia, China)", source: "https://www.hydrogeninsight.com/production/problems-at-world-s-largest-existing-green-hydrogen-project-will-not-be-solved-until-late-2025-sinopec-admits/2-1-1577860", updated: "2025"
      }),
      feat([106.2800, 38.4700], {
        name: "Baofeng Energy Solar-to-Hydrogen", category: "production", subtype: "Electrolyzer",
        color: "green", capacity: "150+ MW (expanding)", status: "Operating", scale: 5, region: "apac",
        operator: "Ningxia Baofeng Energy (China)", source: "https://globalhydrogenhub.com/chinas-first-20000-ton-green-hydrogen-plant-inaugrated-in-xinjiang.html", updated: "2024"
      }),
      feat([114.8800, 40.7800], {
        name: "Zhangjiakou Wind-to-Hydrogen", category: "production", subtype: "Electrolyzer (fueled 2022 Olympic FCEBs)",
        color: "green", capacity: "Multi-MW wind-powered", status: "Operating", scale: 3, region: "apac",
        operator: "Hebei Construction & Investment (China)", source: "https://www.iea.org/reports/global-hydrogen-review-2023", updated: "2023"
      }),
      feat([141.0050, 37.5150], {
        name: "Fukushima Hydrogen Energy Research Field (FH2R)", category: "production", subtype: "Electrolyzer",
        color: "green", capacity: "10 MW (solar-powered)", status: "Operating", scale: 3, region: "apac",
        operator: "NEDO / Toshiba / Tohoku Electric / Iwatani (Japan)", source: "https://www.nedo.go.jp/english/news/AA5en_100422.html", updated: "2026"
      }),
      feat([138.5680, 35.6640], {
        name: "Yamanashi Power-to-Gas (Kofu)", category: "production", subtype: "PEM Electrolyzer (P2G)",
        color: "green", capacity: "16 MW class (scaling from 1.5 MW pilot)", status: "Operating / Expanding", scale: 3, region: "apac",
        operator: "Yamanashi Prefecture / TEPCO / UCC consortium (Japan)", source: "https://www.pref.yamanashi.jp/koho/topics/p2g.html", updated: "2025"
      }),
      feat([146.4000, -38.2500], {
        name: "HESC Latrobe Valley Gasifier", category: "production", subtype: "Coal Gasification (future CCS)",
        color: "brown", capacity: "Pilot: ~70 t/yr; commercial phase under review", status: "Pilot Complete / Commercial phase under review", scale: 4, region: "apac",
        operator: "Kawasaki Heavy Industries / J-Power (Australia)", source: "https://www.hydrogenenergysupplychain.com/about-the-pilot/supply-chain/", updated: "2025"
      }),
      feat([116.7900, -20.7300], {
        name: "Yuri Project (Karratha)", category: "production", subtype: "Electrolyzer (green ammonia feed)",
        color: "green", capacity: "10 MW + 18 MW solar", status: "Commissioning (start-up late 2026)", scale: 3, region: "apac",
        operator: "ENGIE / Yara Pilbara (Australia)", source: "https://www.airswift.com/blog/australian-green-hydrogen-jobs-projects", updated: "2026"
      }),
      feat([151.2500, -23.8400], {
        name: "CQ-H2 Gladstone", category: "production", subtype: "Electrolyzer (export scale)",
        color: "green", capacity: "Was to reach 2.4 GW+", status: "Cancelled 2025 (state funding withdrawn)", scale: 6, region: "apac",
        operator: "Stanwell consortium (Australia)", source: "https://reneweconomy.com.au/project-cancellation-exposes-fatal-flaws-in-australias-hydrogen-export-strategy/", updated: "2025"
      }),
      feat([137.5600, -33.0300], {
        name: "Whyalla Hydrogen Facility", category: "production", subtype: "Electrolyzer + H2 power plant",
        color: "green", capacity: "Was to be 250 MW", status: "Cancelled (state backing withdrawn)", scale: 5, region: "apac",
        operator: "South Australian Government", source: "https://www.orfonline.org/expert-speak/why-is-the-green-hydrogen-industry-faltering-in-australia", updated: "2025"
      }),
      feat([82.2400, 16.9900], {
        name: "AM Green Kakinada (Greenko)", category: "production", subtype: "Green Ammonia Complex",
        color: "green", capacity: "≥250,000 t/yr green ammonia (to Singapore & beyond)", status: "Under Construction", scale: 6, region: "apac",
        note: "Uniper offtake signed: 500 kt/yr RFNBO-compliant ammonia to Europe from 2028 — the largest agreement under India's National Green Hydrogen Mission.",
        operator: "AM Green / Greenko (India)", source: "https://www.keppel.com/infrastructure/news-item.aspx?aid=20572", updated: "2026"
      }),
      feat([126.5100, 36.3300], {
        name: "Boryeong Blue Hydrogen Project", category: "production", subtype: "Blue H2 / Ammonia (CCS)",
        color: "blue", capacity: "~25,000 t/yr blue H2 (initial)", status: "Planned", scale: 5, region: "apac",
        operator: "SK E&S / KOMIPO (South Korea)", source: "https://www.skens.com/en", updated: "2025"
      }),
      // ---- Europe ----
      feat([4.0300, 51.9500], { name: "Shell Holland Hydrogen 1", category: "production", subtype: "PEM Electrolyzer", color: "green", capacity: "200 MW / 60 t/day", status: "Under Construction", scale: 5, region: "europe", operator: "Shell (Rotterdam)", source: "https://www.shell.com/what-we-do/hydrogen.html", updated: "Jun 2026" }),
      feat([7.3200, 52.5080], { name: "GET H2 Lingen", category: "production", subtype: "PEM Electrolyzer", color: "green", capacity: "200 MW (phase build-out)", status: "Under Construction", scale: 5, region: "europe", operator: "RWE / BP", source: "https://www.rwe.com/en/research-and-development/hydrogen-projects/get-h2/", updated: "Jun 2026" }),
      feat([0.5400, 49.4880], { name: "Air Liquide Normand'Hy", category: "production", subtype: "PEM Electrolyzer", color: "green", capacity: "200 MW", status: "Under Construction", scale: 5, region: "europe", operator: "Air Liquide (Normandy)", source: "https://www.airliquide.com/group/press-releases-news", updated: "2025" }),
      feat([-4.1100, 38.6870], { name: "Iberdrola Puertollano", category: "production", subtype: "PEM Electrolyzer", color: "green", capacity: "20 MW", status: "Operating", scale: 3, region: "europe", operator: "Iberdrola / Fertiberia", source: "https://www.iberdrola.com/about-us/what-we-do/green-hydrogen/puertollano-green-hydrogen-plant", updated: "Jun 2026" }),
      feat([21.6880, 65.8250], { name: "Stegra Boden Electrolyzers", category: "production", subtype: "Alkaline Electrolyzer (Europe's largest)", color: "green", capacity: "700+ MW", status: "Under Construction (final modules installed Apr 2026)", scale: 7, region: "europe", note: "€6.5B+ financed green-steel anchor. Offtakes signed: Porsche, Mercedes-Benz, Volvo, ZF, IKEA, Microsoft. Targets 5 Mt near-zero steel/yr by 2030.", operator: "Stegra (ex-H2 Green Steel)", source: "https://stegra.com/", updated: "Apr 2026" }),
      feat([9.7550, 55.5640], { name: "HySynergy Fredericia", category: "production", subtype: "Alkaline Electrolyzer", color: "green", capacity: "20 MW (phase 1)", status: "Operating", scale: 3, region: "europe", operator: "Everfuel (Denmark)", source: "https://www.everfuel.com/projects/hysynergy/", updated: "2025" }),
      feat([12.0100, 51.3200], { name: "Leuna H2 (Linde/ITM)", category: "production", subtype: "PEM Electrolyzer", color: "green", capacity: "24 MW", status: "Operating", scale: 3, region: "europe", operator: "Linde / ITM Power", source: "https://www.linde.com/", updated: "Jun 2026" }),
      feat([4.3000, 51.8900], { name: "Air Liquide ELYgator", category: "production", subtype: "PEM Electrolyzer", color: "green", capacity: "200 MW", status: "Under Construction", scale: 5, region: "europe", operator: "Air Liquide (Rotterdam)", source: "https://www.airliquide.com/", updated: "2025" }),
      feat([4.2800, 51.8950], { name: "Air Products Botlek Blue H2", category: "production", subtype: "SMR + CCS", color: "blue", capacity: "110 kt/yr", status: "Under Construction", scale: 6, region: "europe", operator: "Air Products (Rotterdam)", source: "https://www.airproducts.com/", updated: "Jun 2026" }),
      feat([4.3520, 51.8850], { name: "Shell Pernis Blue H2", category: "production", subtype: "SMR + CCS", color: "blue", capacity: "100 kt/yr", status: "Under Construction", scale: 6, region: "europe", operator: "Shell (Rotterdam)", source: "https://www.shell.com/", updated: "Jun 2026" }),
      feat([6.9740, 50.8260], { name: "REFHYNE (Wesseling)", category: "production", subtype: "PEM Electrolyzer", color: "green", capacity: "10 MW", status: "Operating", scale: 2, region: "europe", operator: "Shell / ITM Power", source: "https://refhyne.eu/", updated: "Jun 2026" }),
      feat([13.6400, 54.1400], { name: "H2 Hub Lubmin", category: "production", subtype: "Electrolyzer (EU Bank Auction winner)", color: "green", capacity: "~200 MW", status: "Planned", scale: 5, region: "europe", operator: "H2 Hub Lubmin", source: "https://ec.europa.eu/", updated: "May 2025" }),
      feat([3.9800, 51.9650], { name: "Zeevonk Electrolyser", category: "production", subtype: "Electrolyzer (offshore-wind-fed)", color: "green", capacity: "~340 MW", status: "Planned", scale: 5, region: "europe", operator: "Zeevonk (Vattenfall/CIP)", source: "https://ec.europa.eu/", updated: "May 2025" }),
      feat([21.3700, 62.2700], { name: "Kristinestad PtX", category: "production", subtype: "Power-to-X (EU Bank Auction winner)", color: "green", capacity: "~215 MW", status: "Planned", scale: 5, region: "europe", operator: "Koppö Energia (Finland)", source: "https://ec.europa.eu/", updated: "May 2025" }),
      feat([-5.9800, 37.3800], { name: "Armonia Green Sevilla", category: "production", subtype: "Electrolyzer + green ammonia", color: "green", capacity: "~200 MW", status: "Planned", scale: 5, region: "europe", operator: "IGNIS (Spain)", source: "https://ec.europa.eu/", updated: "May 2025" }),
      feat([-8.4100, 43.3600], { name: "Armonia Green Galicia", category: "production", subtype: "Electrolyzer + green ammonia", color: "green", capacity: "~200 MW", status: "Planned", scale: 5, region: "europe", operator: "IGNIS (Spain)", source: "https://ec.europa.eu/", updated: "May 2025" }),
      feat([-5.6400, 36.8600], { name: "Villamartin H2", category: "production", subtype: "Electrolyzer", color: "green", capacity: "~100 MW", status: "Planned", scale: 4, region: "europe", operator: "Galena (Spain)", source: "https://ec.europa.eu/", updated: "May 2025" }),
      feat([8.5900, 59.8800], { name: "Rjukan H2", category: "production", subtype: "Hydro-fed Electrolyzer", color: "green", capacity: "~14 MW", status: "Planned", scale: 2, region: "europe", operator: "Norwegian Hydrogen", source: "https://ec.europa.eu/", updated: "May 2025" }),
      feat([-1.1300, 54.5800], { name: "BP H2Teesside", category: "production", subtype: "SMR + CCS (blue)", color: "blue", capacity: "1.2 GW (as designed)", status: "Cancelled 2026", scale: 7, region: "europe", note: "bp cancelled its flagship UK blue-H2 project in 2026 amid its broader retreat from hydrogen.", operator: "bp (Teesside)", source: "https://www.bp.com/", updated: "Jun 2026" }),
      feat([6.9000, 62.8000], { name: "Shell Aukra Green H2", category: "production", subtype: "Alkaline Electrolyzer (export scale)", color: "green", capacity: "2.5 GW (as designed)", status: "Cancelled 2025", scale: 7, region: "europe", operator: "Shell (Norway)", source: "https://www.shell.com/", updated: "Jul 2025" }),
      // ---- MENA ----
      feat([35.0300, 28.0800], { name: "NEOM Green Hydrogen (Helios)", category: "production", subtype: "Alkaline Electrolyzer (world's largest under construction)", color: "green", capacity: "2+ GW / 600 t/day (1.2 MTPA NH3)", status: "Under Construction — 90% complete Apr 2026", scale: 8, region: "mena", note: "4 GW dedicated wind+solar finishing mid-2026; thyssenkrupp nucera electrolyzers. 100% of output contracted to Air Products for 30 years; first ammonia export locked for 2027.", operator: "NEOM / ACWA / Air Products", source: "https://www.neomgreenhydrogen.com/", updated: "Apr 2026" }),
      feat([57.7000, 19.6600], { name: "ACME Duqm Phase 1", category: "production", subtype: "Electrolyzer + green ammonia", color: "green", capacity: "100 kt/yr NH3", status: "Under Construction (commissioning Q4 2026)", scale: 5, region: "mena", note: "Yara offtake: 100 kt/yr RFNBO-compliant ammonia for 15 years from 2027.", operator: "ACME Group (Oman)", source: "https://www.acme.in/", updated: "Jun 2026" }),
      feat([57.7500, 19.7100], { name: "HyPort Duqm", category: "production", subtype: "Electrolyzer (500 MW phase 1)", color: "green", capacity: "330 kt/yr NH3 (design)", status: "Planned (FID framework)", scale: 6, region: "mena", operator: "OQ / DEME (Oman)", source: "https://www.hyportduqm.com/", updated: "Jul 2025" }),
      feat([56.0000, 18.0000], { name: "Green Energy Oman (GEO)", category: "production", subtype: "Mega green H2/NH3 complex", color: "green", capacity: "1.8 MTPA H2 (aspirational)", status: "Planned", scale: 8, region: "mena", note: "Low confidence — very early stage.", operator: "GEO Consortium (Shell/OQ/Intercontinental)", source: "https://www.greenenergyoman.net/", updated: "Jun 2025" }),
      feat([59.5200, 22.5600], { name: "Sur Hydrogen Cluster", category: "production", subtype: "Green H2 cluster", color: "green", capacity: "487 t/day (design)", status: "Planned", scale: 6, region: "mena", operator: "Oman LNG / OQ", source: "https://hydrom.om/", updated: "Jul 2025" }),
      feat([54.0000, 16.9500], { name: "SalalaH2", category: "production", subtype: "Green ammonia complex", color: "green", capacity: "1 MTPA NH3 (design)", status: "Planned", scale: 7, region: "mena", operator: "OQ / Linde (Oman)", source: "https://hydrom.om/", updated: "Jun 2025" }),
      feat([52.7300, 24.1500], { name: "TA'ZIZ Low-Carbon Ammonia", category: "production", subtype: "Blue ammonia", color: "blue", capacity: "1 MTPA NH3", status: "Planned / early works", scale: 6, region: "mena", operator: "ADNOC / Fertiglobe (UAE)", source: "https://www.taziz.com/", updated: "Jun 2026" }),
      feat([32.3200, 29.6000], { name: "Egypt Green (Ain Sokhna)", category: "production", subtype: "Electrolyzer + green ammonia", color: "green", capacity: "100 MW / 13 kt/yr H2", status: "Operating (partial)", scale: 4, region: "mena", note: "Africa's first operating utility-scale green H2. De-risked by winning H2Global's pilot auction: 397 kt renewable NH3 to Rotterdam over 10 years at ~€1,000/t, plus €35M EIB grant.", operator: "Scatec / Fertiglobe", source: "https://scatec.com/", updated: "Feb 2026" }),
      feat([31.8100, 31.4100], { name: "Damietta Green Ammonia", category: "production", subtype: "Green ammonia", color: "green", capacity: "150 kt/yr NH3", status: "Planned", scale: 5, region: "mena", operator: "thyssenkrupp Uhde (Egypt)", source: "https://www.thyssenkrupp-uhde.com/", updated: "Mar 2025" }),
      feat([35.4800, 23.9500], { name: "Amun Green Ammonia (Ras Banas)", category: "production", subtype: "Green ammonia", color: "green", capacity: "1 MTPA NH3 (aspirational)", status: "Planned", scale: 6, region: "mena", note: "Low confidence — announcement stage.", operator: "Hynfra / Coxswains (Egypt)", source: "https://hynfra.eu/", updated: "Apr 2026" }),
      // ---- Africa ----
      feat([-17.0300, 20.9000], { name: "AMAN (Mauritania)", category: "production", subtype: "Mega green H2 (aspirational)", color: "green", capacity: "Up to 15 GW electrolysis", status: "Planned (conceptual)", scale: 8, region: "africa", note: "Remains conceptual — no offtake guarantees; prohibitive sovereign-risk premiums.", operator: "CWP Global", source: "https://www.cwp.global/", updated: "2023" }),
      feat([-16.8500, 21.1500], { name: "Project Nour (Mauritania)", category: "production", subtype: "Mega green H2 (aspirational)", color: "green", capacity: "Up to 10 GW electrolysis", status: "Planned (conceptual)", scale: 7, region: "africa", operator: "Chariot / TotalEren", source: "https://chariotenergygroup.com/", updated: "2023" }),
      feat([15.1500, -26.6400], { name: "Hyphen (Namibia)", category: "production", subtype: "Green H2 + ammonia", color: "green", capacity: "300 kt/yr H2 (design)", status: "Planned (feasibility)", scale: 7, region: "africa", operator: "Hyphen Hydrogen Energy", source: "https://hyphenafrica.com/", updated: "2025" }),
      feat([29.1800, -26.5400], { name: "Sasol Secunda", category: "production", subtype: "Coal Gasification (world's largest legacy H2 site)", color: "brown", capacity: "Massive legacy gray/brown output", status: "Operating", scale: 7, region: "africa", note: "Transitional anchor for South Africa's hydrogen strategy — candidate for progressive greening.", operator: "Sasol", source: "https://www.sasol.com/", updated: "2023" }),
      feat([25.6800, -33.7900], { name: "Coega Green Ammonia", category: "production", subtype: "Green ammonia", color: "green", capacity: "TBD", status: "Planned", scale: 4, region: "africa", operator: "Hive Hydrogen (South Africa)", source: "https://hivehydrogen.co.za/", updated: "Mar 2026" }),
      feat([-11.0000, 28.0000], { name: "HEVO Ammonia Morocco", category: "production", subtype: "Green ammonia", color: "green", capacity: "TBD", status: "Planned", scale: 3, region: "africa", note: "Low confidence — early stage.", operator: "HEVO / Fusion Fuel", source: "https://www.fusion-fuel.eu/", updated: "Jun 2026" }),
      // ---- Latin America ----
      feat([-70.8800, -52.9300], { name: "Haru Oni (HIF Magallanes)", category: "production", subtype: "E-fuels (wind-to-methanol/gasoline)", color: "green", capacity: "Demonstration scale", status: "Operating", scale: 3, region: "latam", note: "The world's flagship operating e-fuels plant, backed by Porsche.", operator: "HIF Global (Chile)", source: "https://hifglobal.com/", updated: "Jun 2026" }),
      feat([-38.3200, -12.6900], { name: "Unigel Camaçari", category: "production", subtype: "Electrolyzer (green ammonia)", color: "green", capacity: "60 MW (phase 1 design)", status: "Paused", scale: 4, region: "latam", note: "Paused amid financial restructuring in Brazil's fertilizer sector.", operator: "Unigel / Proquigel", source: "https://www.unigel.com.br/", updated: "Aug 2025" }),
      // ---- Canada ----
      feat([-113.3300, 53.5400], { name: "Air Products Edmonton Net-Zero H2", category: "production", subtype: "ATR + CCS (blue)", color: "blue", capacity: "Regional refining + mobility supply", status: "Under Construction", scale: 6, region: "americas", operator: "Air Products (Alberta)", source: "https://www.airproducts.com/", updated: "Jun 2026" }),
      feat([-72.4100, 46.3600], { name: "Air Liquide Bécancour PEM", category: "production", subtype: "PEM Electrolyzer (hydro-fed)", color: "green", capacity: "20 MW", status: "Operating", scale: 3, region: "americas", operator: "Air Liquide (Québec)", source: "https://www.airliquide.com/", updated: "Jun 2026" }),
      feat([-61.3500, 45.5900], { name: "EverWind Point Tupper", category: "production", subtype: "Green ammonia (EU export)", color: "green", capacity: "200 kt/yr NH3 by 2028 (phase 1)", status: "Under Construction", scale: 5, region: "americas", note: "$240M Nuveen financing (Mar 2026); backstopped by €200M EU commitment subsidizing Canadian H2 exports to Germany.", operator: "EverWind Fuels (Nova Scotia)", source: "https://everwindfuels.com/", updated: "Mar 2026" }),
      feat([-58.5700, 48.5500], { name: "World Energy GH2 (Stephenville)", category: "production", subtype: "Wind-to-ammonia (export)", color: "green", capacity: "250 kt/yr (design)", status: "Cancelled Feb 2026", scale: 6, region: "americas", note: "Newfoundland & Labrador declined to renew Crown land reserves over unpaid fees — jeopardizing the multi-GW project.", operator: "World Energy GH2", source: "https://worldenergygh2.com/", updated: "Feb 2026" }),
      feat([-61.2700, 45.5700], { name: "Bear Head Energy", category: "production", subtype: "Green H2/ammonia", color: "green", capacity: "~1 GW (design)", status: "Planned", scale: 5, region: "americas", operator: "Bear Head Energy (Nova Scotia)", source: "https://bearheadenergy.com/", updated: "Jun 2026" }),
      feat([-68.1500, 49.2100], { name: "Hy2gen Courant (Baie-Comeau)", category: "production", subtype: "PEM Electrolyzer (hydro-fed)", color: "green", capacity: "~275 MW (design)", status: "Planned", scale: 4, region: "americas", operator: "Hy2gen (Québec)", source: "https://hy2gen.com/", updated: "Apr 2026" })
    ]
  },

  manufacturing: {
    type: "FeatureCollection",
    features: [
      feat([114.4700, 36.6000], { name: "PERIC (Handan)", category: "manufacturing", subtype: "ALK Gigafactory", color: "mfg", capacity: "6.5 GW/yr", status: "Operating — domestic price leader", scale: 7, region: "apac", operator: "PERIC (China)", source: "https://www.peric.com.cn/", updated: "2026" }),
      feat([120.3000, 31.5700], { name: "LONGi Hydrogen (Wuxi)", category: "manufacturing", subtype: "ALK Gigafactory", color: "mfg", capacity: "3.5 GW/yr", status: "Operating — vertically integrated solar+H2", scale: 6, region: "apac", operator: "LONGi (China)", source: "https://www.longi.com/en/products/hydrogen/", updated: "2026" }),
      feat([117.2800, 31.8600], { name: "Sungrow Hydrogen (Hefei)", category: "manufacturing", subtype: "ALK/PEM Gigafactory", color: "mfg", capacity: "3.0 GW/yr", status: "Operating — export bundles with inverters", scale: 6, region: "apac", operator: "Sungrow (China)", source: "https://en.sungrowpower.com/", updated: "2026" }),
      feat([120.5500, 31.8700], { name: "Guofu Hydrogen (Zhangjiagang)", category: "manufacturing", subtype: "ALK Gigafactory", color: "mfg", capacity: "2.5 GW/yr", status: "Operating", scale: 5, region: "apac", operator: "Guofu (China)", source: "https://www.gfhee.com/", updated: "2026" }),
      feat([13.3300, 52.5300], { name: "Siemens Energy Gigafactory (Berlin)", category: "manufacturing", subtype: "PEM Gigafactory", color: "mfg", capacity: "3.0 GW/yr", status: "Operating — JV with Air Liquide", scale: 6, region: "europe", operator: "Siemens Energy", source: "https://www.siemens-energy.com/", updated: "2026" }),
      feat([7.4700, 51.5100], { name: "thyssenkrupp nucera (Dortmund)", category: "manufacturing", subtype: "ALK Gigafactory", color: "mfg", capacity: ">2.0 GW/yr", status: "Operating — supplies NEOM & Stegra", scale: 6, region: "europe", operator: "thyssenkrupp nucera", source: "https://thyssenkrupp-nucera.com/", updated: "2026" }),
      feat([5.5100, 50.5800], { name: "John Cockerill (Seraing)", category: "manufacturing", subtype: "ALK Gigafactory", color: "mfg", capacity: "~2.0 GW/yr", status: "Operating — expanding JVs into MENA/Asia", scale: 5, region: "europe", operator: "John Cockerill (Belgium)", source: "https://hydrogen.johncockerill.com/", updated: "2026" }),
      feat([-77.6200, 43.1200], { name: "Plug Power (Rochester)", category: "manufacturing", subtype: "PEM Gigafactory", color: "mfg", capacity: "~1.5 GW/yr", status: "Operating — consolidating after STAMP exit", scale: 5, region: "americas", operator: "Plug Power (USA)", source: "https://www.plugpower.com/", updated: "Mar 2026" }),
      feat([9.6300, 59.1300], { name: "Nel Herøya", category: "manufacturing", subtype: "ALK/PEM Gigafactory", color: "mfg", capacity: ">1.0 GW/yr", status: "Operating — expanding, pressurized ALK focus", scale: 5, region: "europe", operator: "Nel ASA (Norway)", source: "https://nelhydrogen.com/", updated: "2026" }),
      feat([-1.4100, 53.3900], { name: "ITM Power (Sheffield)", category: "manufacturing", subtype: "PEM Gigafactory", color: "mfg", capacity: ">1.0 GW/yr", status: "Operating — deep Linde integration", scale: 5, region: "europe", operator: "ITM Power (UK)", source: "https://itm-power.com/", updated: "2026" }),
      feat([-93.2700, 45.0900], { name: "Accelera by Cummins (Fridley)", category: "manufacturing", subtype: "PEM/ALK Gigafactory", color: "mfg", capacity: "~1.0 GW/yr", status: "Operating", scale: 4, region: "americas", operator: "Cummins / Accelera (USA)", source: "https://www.accelerazero.com/", updated: "2026" }),
      feat([-121.9500, 37.5100], { name: "Bloom Energy (Fremont)", category: "manufacturing", subtype: "SOEC Factory", color: "mfg", capacity: "<1.0 GW/yr", status: "Operating — high-efficiency solid oxide", scale: 4, region: "americas", operator: "Bloom Energy (USA)", source: "https://www.bloomenergy.com/", updated: "2026" })
    ]
  },

  storagePoints: {
    type: "FeatureCollection",
    features: [
      feat([-112.58, 39.50], {
        name: "ACES Delta Salt Caverns", category: "storage", subtype: "Salt Cavern",
        color: "green", capacity: "300 GWh (11,000 MT across 2 caverns)", status: "Operating", scale: 6,
        operator: "Mitsubishi Power / Chevron", source: "https://aces-delta.com/sites/", updated: "Feb 2026"
      }),
      feat([-94.1955, 30.0728], {
        name: "Spindletop Cavern", category: "storage", subtype: "Salt Cavern",
        color: "gray_blue", capacity: "274 TWh (converted from natural gas)", status: "Operating", scale: 7,
        operator: "Air Liquide", source: "https://www.lyellcollection.org/doi/full/10.3389/esss.2024.10125", updated: "2024"
      }),
      feat([-94.4508, 30.1113], {
        name: "Moss Bluff Cavern", category: "storage", subtype: "Salt Cavern",
        color: "gray_blue", capacity: "566,000 m³ volume", status: "Operating", scale: 5,
        operator: "Linde", source: "https://royalsocietypublishing.org/rsta/article/382/2276/20230187/41360/Effects-of-reservoir-mechanical-properties-on", updated: "2023"
      }),
      feat([-94.4450, 30.1200], {
        name: "TRU Hub (Moss Bluff)", category: "storage", subtype: "Salt Cavern (future H2)",
        color: "gray_blue", capacity: "Phase 1: 26 Bcf (natural gas, future H2)", status: "Planned", scale: 4,
        operator: "Neuventus", source: "https://www.neuventus.com/tru-hub", updated: "2025"
      }),
      feat([-90.0715, 29.9511], {
        name: "New Orleans Liquefaction", category: "storage", subtype: "Liquefaction Plant",
        color: "gray_blue", capacity: "31.8 MT/D (x2 plants)", status: "Operating", scale: 4,
        operator: "Undisclosed", source: "https://www.hydrogen.energy.gov/docs/hydrogenprogramlibraries/pdfs/24003-hydrogen-liquefaction-capacity-united-states.pdf", updated: "May 2024"
      }),
      feat([-95.0399, 29.6658], {
        name: "La Porte Liquefaction", category: "storage", subtype: "Liquefaction Plant",
        color: "gray_blue", capacity: "30 MT/D", status: "Operating", scale: 4,
        operator: "Air Products", source: "https://www.airproducts.com/company/news-center/2021/10/1007-air-products-new-liquid-hydrogen-plant-onstream-at-laporte-texas-facility", updated: "2024"
      }),
      feat([135.2350, 34.6560], {
        name: "Kobe LH2 Import Terminal (Hy touch Kobe)", category: "storage", subtype: "Liquefied H2 Import Terminal (world's first)",
        color: "brown", capacity: "2,500 m³ LH2 sphere; commercial-scale expansion underway", status: "Operating (pilot) / Expanding", scale: 4, region: "apac",
        operator: "Kawasaki Heavy Industries / HySTRA (Japan)", source: "https://www.hydrogenenergysupplychain.com/about-the-pilot/supply-chain/the-port-of-kobe/", updated: "Apr 2026"
      }),
      feat([145.1900, -38.3000], {
        name: "Hastings LH2 Export Terminal", category: "storage", subtype: "Liquefaction + Export Port",
        color: "brown", capacity: "Pilot scale (Suiso Frontier voyages)", status: "Pilot Complete", scale: 3, region: "apac",
        operator: "HESC consortium (Australia)", source: "https://www.hydrogenenergysupplychain.com/about-the-pilot/supply-chain/the-suiso-frontier/", updated: "2025"
      }),
      feat([114.9300, 4.5800], {
        name: "AHEAD Brunei MCH Demo Plant", category: "storage", subtype: "Methylcyclohexane Carrier (LOHC)",
        color: "gray_blue", capacity: "210 t/yr H2 shipped to Japan (demo)", status: "Pilot Complete", scale: 2, region: "apac",
        operator: "AHEAD (Chiyoda / Mitsubishi / Mitsui / NYK)", source: "https://www.ahead.or.jp/en/", updated: "2021"
      }),
      // ---- Europe storage & terminals ----
      feat([6.8900, 53.0800], { name: "HyStock Zuidwending", category: "storage", subtype: "Salt Cavern", color: "green", capacity: "4 caverns, >20,000 t planned", status: "Planned", scale: 5, region: "europe", operator: "Gasunie (Netherlands)", source: "https://www.hystock.nl/en", updated: "Jun 2026" }),
      feat([7.8300, 53.4500], { name: "Etzel H2CAST", category: "storage", subtype: "Salt Cavern (pilot)", color: "green", capacity: "90 t filled (2×150,000 m³ @ 170 bar)", status: "Operating (pilot)", scale: 3, region: "europe", note: "Milestone 90-tonne hydrogen fill completed early 2026 — Europe's leading cavern conversion proof.", operator: "STORAG ETZEL / Gasunie", source: "https://h2cast.com/", updated: "Apr 2026" }),
      feat([-1.1330, 54.5830], { name: "Teesside Hydrogen Storage", category: "storage", subtype: "Salt Cavern", color: "gray_blue", capacity: "210,000 m³", status: "Operating", scale: 4, region: "europe", operator: "Sabic (UK)", source: "https://www.sabic.com/", updated: "Jun 2026" }),
      feat([11.8600, 51.3800], { name: "Energiepark Bad Lauchstädt", category: "storage", subtype: "Salt Cavern", color: "green", capacity: "150 GWh", status: "Planned", scale: 5, region: "europe", operator: "VNG Gasspeicher (Germany)", source: "https://energiepark-bad-lauchstaedt.de/", updated: "2025" }),
      feat([5.8600, 43.8300], { name: "HyGreen Provence", category: "storage", subtype: "Salt Cavern", color: "green", capacity: "200 GWh", status: "Planned", scale: 5, region: "europe", operator: "Engie / Storengy (France)", source: "https://www.storengy.com/en", updated: "2025" }),
      feat([8.1200, 53.5600], { name: "Wilhelmshaven Ammonia Cracker", category: "terminal", subtype: "NH3 Import Cracker (demo)", color: "green", capacity: "28 t/day H2", status: "Under Construction (online late 2026)", scale: 3, region: "europe", note: "Uniper / thyssenkrupp Uhde demonstration cracker — the technological precursor for GW-scale European import terminals.", operator: "Uniper", source: "https://www.uniper.energy/", updated: "Jan 2026" }),
      feat([4.3400, 51.2600], { name: "Antwerp H2 Import Terminal", category: "terminal", subtype: "Import Terminal", color: "green", capacity: "TBD", status: "Planned", scale: 3, region: "europe", operator: "Fluxys (Belgium)", source: "https://www.fluxys.com/", updated: "Jun 2026" }),
      // ---- Africa / LatAm terminals ----
      feat([16.5900, -28.7700], { name: "Boegoebaai Export Port", category: "terminal", subtype: "Green H2 Export Terminal", color: "green", capacity: "TBD", status: "Planned", scale: 4, region: "africa", operator: "Sasol / Northern Cape", source: "https://www.sasol.com/", updated: "Jun 2026" }),
      feat([-38.8300, -3.5400], { name: "Pecém Green H2 Hub", category: "terminal", subtype: "Export Hub / Terminal", color: "green", capacity: "TBD", status: "Planned", scale: 4, region: "latam", operator: "Port of Pecém (Brazil)", source: "https://www.complexodopecem.com.br/", updated: "Jun 2026" })
    ]
  },

  pipelines: {
    type: "FeatureCollection",
    features: [
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[-95.3698, 29.7604], [-93.9400, 29.8850], [-90.0715, 29.9511]] },
        properties: {
          name: "Gulf Coast Hydrogen Pipeline Network", category: "pipeline", subtype: "Pipeline",
          color: "gray_blue", capacity: ">1 Billion scf/day (~600 mi)", status: "Operating", scale: 6,
          operator: "Air Products", source: "https://www.airproducts.com/-/media/files/en/338/338-12-003-us-air-products-us-gulf-coast-hydrogen-network.pdf", updated: "2024"
        }
      },
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[-95.6963, 29.0466], [-94.1955, 30.0728], [-93.2174, 30.2266]] },
        properties: {
          name: "Linde Gulf Coast Pipeline", category: "pipeline", subtype: "Pipeline",
          color: "gray_blue", capacity: "1.3 Billion scf/day (~340 mi)", status: "Operating", scale: 6,
          operator: "Linde", source: "https://www.linde.com/clean-energy/our-h2-technology/hydrogen-storage", updated: "2022"
        }
      },
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[111.0, 41.0], [113.5, 40.6], [116.4, 39.9]] },
        properties: {
          name: "Inner Mongolia → Beijing H2 Pipeline", category: "pipeline", subtype: "Pipeline (planned, ~400 km)",
          color: "green", capacity: "100,000 t/yr (design)", status: "Planned", scale: 6, region: "apac",
          operator: "Sinopec (China)", source: "https://www.hydrogeninsight.com/production/problems-at-world-s-largest-existing-green-hydrogen-project-will-not-be-solved-until-late-2025-sinopec-admits/2-1-1577860", updated: "2025"
        }
      },
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[6.852, 52.651], [7.189, 52.208]] },
        properties: {
          name: "Kernnetz: Vlieghuis–Ochtrup", category: "pipeline", subtype: "H2 Pipeline (German Kernnetz segment)",
          color: "green", capacity: "60 km (of 5,800 km Kernnetz, €20B, full ops 2032)", status: "Planned (approved)", scale: 5, region: "europe",
          operator: "Thyssengas", source: "https://www.fnb-gas.de/en/hydrogen-core-network/", updated: "Aug 2025"
        }
      },
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[4.020, 51.950], [4.352, 51.888]] },
        properties: {
          name: "Hynetwork: Maasvlakte–Pernis", category: "pipeline", subtype: "H2 Pipeline (first Dutch segment)",
          color: "green", capacity: "32 km", status: "Under Construction (2026 ops)", scale: 4, region: "europe",
          operator: "Gasunie / Hynetwork", source: "https://www.hynetwork.nl/en", updated: "Jun 2026"
        }
      },
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[4.200, 51.900], [6.082, 51.928]] },
        properties: {
          name: "Delta Rhine Corridor", category: "pipeline", subtype: "H2 Pipeline (Rotterdam→Kernnetz)",
          color: "green", capacity: "Delayed to 2032", status: "Delayed (permitting bottlenecks)", scale: 5, region: "europe",
          operator: "Gasunie / Dutch government", source: "https://www.deltarhinecorridor.com/", updated: "Jun 2026"
        }
      },
      {
        type: "Feature",
        geometry: { type: "LineString", coordinates: [[2.173, 41.385], [5.369, 43.300]] },
        properties: {
          name: "H2Med BarMar (subsea)", category: "pipeline", subtype: "Subsea H2 Pipeline (EU PCI)",
          color: "green", capacity: "Iberia → NW Europe corridor", status: "Planned", scale: 6, region: "europe",
          operator: "Enagás / GRTgaz", source: "https://www.enagas.es/en/", updated: "Jun 2026"
        }
      }
    ]
  },

  endUse: {
    type: "FeatureCollection",
    features: [
      // ---- Americas ----
      feat([-116.4023, 33.8225], {
        name: "SunLine Transit Agency", category: "end_use", subtype: "Bus Fleet",
        color: "green", capacity: "44 FCEBs (100% ZEB goal by 2035)", status: "Operating", scale: 3,
        operator: "SunLine Transit", source: "https://www.sunline.org/media/attachments/2026/05/11/zero-emission-bus-rollout-plan-draft-as-of-10.21.25.pdf", updated: "2025"
      }),
      feat([-117.7550, 34.0397], {
        name: "Foothill Transit", category: "end_use", subtype: "Bus Fleet",
        color: "green", capacity: "33 FCEBs (190 planned)", status: "Operating", scale: 3,
        operator: "Foothill Transit", source: "https://investors.cleanenergyfuels.com/news-events/press-releases/detail/452/", updated: "2025"
      }),
      feat([-122.2839, 37.8321], {
        name: "AC Transit", category: "end_use", subtype: "Bus Fleet",
        color: "green", capacity: "Dozens of FCEBs", status: "Operating", scale: 2,
        operator: "AC Transit", source: "https://californiahydrogen.org/resources/hydrogen-fuel-cell-bus-info-page-the-better-electric-bus/", updated: "2023"
      }),
      feat([-81.3784, 40.7989], {
        name: "Stark Area RTA (SARTA)", category: "end_use", subtype: "Bus Fleet",
        color: "green", capacity: "~20 FCEBs — largest fleet outside California", status: "Operating", scale: 2,
        operator: "SARTA (Canton, OH)", source: "https://www.sartaonline.com/fuel-cell/", updated: "2025"
      }),
      feat([-117.8677, 33.7460], {
        name: "OCTA Hydrogen Bus Fleet & Station", category: "end_use", subtype: "Bus Fleet",
        color: "green", capacity: "10 FCEBs + large transit H2 fueling station", status: "Operating", scale: 2,
        operator: "Orange County Transportation Authority", source: "https://www.octa.net/about/environmental-sustainability/zero-emission-bus-program/", updated: "2024"
      }),
      feat([-117.2898, 34.1083], {
        name: "ZEMU (Zero-Emission Multiple Unit)", category: "end_use", subtype: "Train",
        color: "green", capacity: "2-car passenger train", status: "Operating (Late 2025)", scale: 2,
        operator: "SBCTA / Metrolink", source: "https://www.gosbcta.com/project/zero-emission-multiple-unit-zemu/", updated: "2025"
      }),
      feat([-122.3937, 37.7955], {
        name: "MV Sea Change", category: "end_use", subtype: "Ferry Ship",
        color: "green", capacity: "75 passengers (360 kW fuel cell)", status: "Operating", scale: 2,
        operator: "SWITCH Maritime / WETA", source: "https://www.sandia.gov/app/uploads/sites/273/2025/02/Sea-Change-DOE-Report.pdf", updated: "2025"
      }),
      feat([6.1994, 59.2483], {
        name: "MF Hydra (Norway)", category: "end_use", subtype: "Ferry Ship",
        color: "green", capacity: "300 passengers, 80 cars", status: "Operating", scale: 2, region: "europe",
        operator: "Norled", source: "https://hydrogenera.eu/tpost/ac00h0x101-green-hydrogen-for-maritime-shipping-", updated: "Dec 2023"
      }),
      feat([-118.2160, 33.7540], {
        name: "Toyota Tri-Gen, Port of Long Beach", category: "end_use", subtype: "Port / Fuel Cell Tri-Gen",
        color: "green", capacity: "1.2 MT/D H2 + 2.3 MW power (biogas-derived)", status: "Operating", scale: 3,
        operator: "FuelCell Energy / Toyota", source: "https://www.fuelcellenergy.com/tri-gen", updated: "2024"
      }),
      feat([-87.4548, 41.6392], {
        name: "Indiana Harbor #7 Blast Furnace", category: "end_use", subtype: "Industrial (Steel)",
        color: "gray_blue", capacity: "Largest blast furnace in North America", status: "Operating", scale: 5,
        operator: "Cleveland-Cliffs", source: "https://www.clevelandcliffs.com/news/news-releases/detail/620/cleveland-cliffs-completes-successful-blast-furnace", updated: "2024"
      }),
      feat([-112.5920, 39.3790], {
        name: "Intermountain Power Project (IPP Renewed)", category: "end_use", subtype: "H2-Capable Power Plant",
        color: "green", capacity: "840 MW turbines, 30% H2 blend at start-up", status: "Operating", scale: 6,
        operator: "Intermountain Power Agency / LADWP", source: "https://www.ipautah.com/ipp-renewed/", updated: "2025"
      }),
      feat([-104.8202, 41.1400], {
        name: "Cheyenne Data Center Backup", category: "end_use", subtype: "Data Center (fuel cell backup)",
        color: "green", capacity: "1.5–3 MW PEM fuel cell (48 hrs)", status: "Pilot Complete", scale: 3,
        operator: "Microsoft / Caterpillar / Ballard", source: "https://introl.com/blog/green-hydrogen-ai-data-centers-clean-power-fuel-cells-2025", updated: "2025"
      }),
      feat([-122.0780, 37.4020], {
        name: "ECL Hydrogen-Powered Data Center", category: "end_use", subtype: "Data Center (primary power)",
        color: "green", capacity: "1 MW module — off-grid, hydrogen as primary power", status: "Operating", scale: 2,
        operator: "ECL (Mountain View, CA)", source: "https://www.ecl.com/", updated: "2024"
      }),
      // ---- Asia-Pacific ----
      feat([129.3200, 35.5000], {
        name: "Ulsan Fuel Cell Power Plant (new unit)", category: "end_use", subtype: "Fuel Cell Power Plant",
        color: "gray_blue", capacity: "20 MW (byproduct H2)", status: "Operating (commercial Apr 2026)", scale: 3, region: "apac",
        operator: "South Korea (Ulsan)", source: "https://fuelcellsworks.com/2026/04/13/clean-energy/south-korea-expands-hydrogen-fuel-cell-power-with-new-ulsan-plant", updated: "Apr 2026"
      }),
      feat([126.3600, 36.9000], {
        name: "Daesan Byproduct-H2 Fuel Cell Plant", category: "end_use", subtype: "Fuel Cell Power Plant",
        color: "gray_blue", capacity: "50 MW — world's first/largest byproduct-H2 fuel cell plant", status: "Operating", scale: 4, region: "apac",
        operator: "Hanwha Energy / Doosan (South Korea)", source: "https://www.hanwha.com/newsroom.html", updated: "2020"
      }),
      feat([103.6500, 1.2700], {
        name: "Keppel Sakra Cogen Plant", category: "end_use", subtype: "H2-Ready CCGT Power Plant",
        color: "gray_blue", capacity: "600 MW; 30% H2 co-firing capable, 100%-H2 upgradable", status: "Operating (commercial May 2026)", scale: 6, region: "apac",
        operator: "Keppel / Mitsubishi Power (Singapore)", source: "https://www.keppel.com/infrastructure/news-item.aspx?aid=20572", updated: "May 2026"
      }),
      feat([174.2800, -39.0600], {
        name: "Hiringa H2 Refuelling Network", category: "end_use", subtype: "Heavy-Truck Fueling Network",
        color: "green", capacity: "First nationwide green H2 truck-refuelling network", status: "Operating", scale: 2, region: "apac",
        operator: "Hiringa Energy (New Zealand)", source: "https://www.hiringa.co.nz/", updated: "2024"
      }),
      feat([139.7200, 35.5300], {
        name: "Kawasaki (Keihin) MCH Dehydrogenation", category: "end_use", subtype: "LOHC Receiving / Industrial Use",
        color: "gray_blue", capacity: "210 t/yr H2 demo (Brunei → Japan)", status: "Pilot Complete", scale: 2, region: "apac",
        operator: "AHEAD / Toa Oil (Japan)", source: "https://www.ahead.or.jp/en/", updated: "2021"
      }),
      // ---- Europe (steel anchors) ----
      feat([6.7300, 51.4900], { name: "thyssenkrupp tkH2Steel (Duisburg)", category: "end_use", subtype: "Steel DRI Plant", color: "green", capacity: "2.5 MTPA direct reduction", status: "Under Construction (2027–28 target)", scale: 7, region: "europe", note: "Fed by the DoHa Kernnetz pipeline segment from 2027. Europe's largest single industrial H2 offtake.", operator: "thyssenkrupp Steel", source: "https://www.thyssenkrupp-steel.com/en/company/sustainability/climate-strategy/", updated: "Jun 2026" }),
      feat([20.6500, 67.1330], { name: "HYBRIT Gällivare DRI", category: "end_use", subtype: "Steel DRI Plant", color: "green", capacity: "1.3 MTPA", status: "Under Construction", scale: 6, region: "europe", operator: "SSAB / LKAB / Vattenfall", source: "https://www.hybritdevelopment.se/en/", updated: "Jun 2026" })
    ]
  },

  // DOE Regional Clean Hydrogen Hubs — federal funding status as of mid-2026.
  hubs: [
    {
      short: "ARCHES", name: "ARCHES — California Hydrogen Hub",
      center: [-119.7, 36.3], radiusKm: 300, states: "CA",
      award: "$1.2B (terminated Oct 2025)", funding: "terminated",
      colorFocus: "green", focus: "Renewables & biomass electrolysis; ports, heavy trucking, power",
      note: "Federal award terminated Oct 2025; termination upheld in DOE's April 2026 project review. ARCHES says it will proceed regardless — citing ~$10B in private/public commitments.",
      source: "https://www.canarymedia.com/articles/hydrogen/hydrogen-hub-cuts-trump-doe-list"
    },
    {
      short: "PNWH2", name: "Pacific Northwest Hydrogen Hub",
      center: [-121.0, 46.2], radiusKm: 260, states: "WA / OR / MT",
      award: "$1.0B (terminated Oct 2025)", funding: "terminated",
      colorFocus: "green", focus: "Hydropower-fed electrolysis; heavy-duty transport, fertilizer",
      note: "Federal award terminated Oct 2025 alongside ARCHES (~$2.2B combined cut).",
      source: "https://www.eenews.net/articles/doe-cancellations-hit-hydrogen-air-capture-hubs/"
    },
    {
      short: "MACH2", name: "Mid-Atlantic Clean Hydrogen Hub",
      center: [-75.3, 39.9], radiusKm: 130, states: "PA / DE / NJ",
      award: "up to $750M (retained)", funding: "retained",
      colorFocus: "pink", focus: "Renewable + nuclear electrolysis; repurposed refinery infrastructure",
      note: "Was reported at risk in Oct 2025 leak; retained as of mid-2026.",
      source: "https://www.latitudemedia.com/news/these-are-the-hydrogen-hubs-slated-to-lose-their-doe-funding/"
    },
    {
      short: "MachH2", name: "Midwest Alliance for Clean Hydrogen",
      center: [-87.8, 41.6], radiusKm: 220, states: "IL / IN / MI",
      award: "up to $1.0B (retained)", funding: "retained",
      colorFocus: "pink", focus: "Nuclear + renewable + low-carbon H2; steel, ammonia, refining, aviation",
      note: "Backers include Exelon and Constellation; retained as of mid-2026.",
      source: "https://www.catf.us/hydrogen/hydrogen-hubs/"
    },
    {
      short: "ARCH2", name: "Appalachian Regional Clean Hydrogen Hub",
      center: [-80.6, 39.5], radiusKm: 200, states: "WV / OH / PA",
      award: "up to $925M (retained)", funding: "retained",
      colorFocus: "blue", focus: "Natural-gas-based blue H2 with CCS; industry & heavy transport",
      note: "Confirmed fully funded ($925M) after DOE's April 2026 review — the most secure of the seven hubs (EQT, Battelle-led), though physical progress has stalled.",
      source: "https://mountainstatespotlight.org/2025/12/03/arch2-funding-threatened/"
    },
    {
      short: "HyVelocity", name: "HyVelocity Gulf Coast Hydrogen Hub",
      center: [-95.0, 29.9], radiusKm: 240, states: "TX / LA",
      award: "up to $1.2B (retained)", funding: "retained",
      colorFocus: "blue", focus: "Blue + green H2 at scale on existing Gulf Coast pipeline network",
      note: "Anchored by ExxonMobil, Chevron, Air Liquide, AES; world's densest existing H2 infrastructure.",
      source: "https://www.catf.us/hydrogen/hydrogen-hubs/"
    },
    {
      short: "Heartland", name: "Heartland Hydrogen Hub",
      center: [-98.8, 46.5], radiusKm: 260, states: "MN / ND / SD",
      award: "up to $925M (retained)", funding: "retained",
      colorFocus: "blue", focus: "Low-carbon H2 for ammonia fertilizer & agriculture decarbonization",
      note: "Retained as of mid-2026; Xcel Energy among partners.",
      source: "https://www.catf.us/hydrogen/hydrogen-hubs/"
    }
  ],

  // Real supply-chain relationships rendered as animated energy-flow arcs.
  flows: [
    { name: "NYPA hydropower → Plug Power STAMP (contract; project cancelled 2026)", color: "green",
      from: [-79.0377, 43.0962], to: [-78.3894, 43.0836] },
    { name: "ACES wind & solar → ACES electrolyzers", color: "green",
      from: [-112.5766, 39.4600], to: [-112.5760, 39.4550] },
    { name: "ACES electrolyzers → Delta salt caverns", color: "green",
      from: [-112.5760, 39.4550], to: [-112.58, 39.50] },
    { name: "Delta salt caverns → IPP Renewed H2 power plant", color: "green",
      from: [-112.58, 39.50], to: [-112.5920, 39.3790] },
    { name: "Spindletop storage ↔ Gulf Coast pipeline network", color: "gray_blue",
      from: [-94.1955, 30.0728], to: [-93.9400, 29.8850] },
    { name: "Nine Mile Point nuclear → on-site pink H2", color: "pink",
      from: [-76.4111, 43.5253], to: [-76.30, 43.40] },
    { name: "Port Arthur SMR → La Porte liquefaction", color: "blue",
      from: [-93.9400, 29.8850], to: [-95.0399, 29.6658] },
    // Asia-Pacific supply chains
    { name: "HESC: Hastings LH2 → Kobe import terminal (Suiso Frontier route)", color: "brown",
      from: [145.1900, -38.3000], to: [135.2350, 34.6560] },
    { name: "AHEAD: Brunei MCH → Kawasaki dehydrogenation", color: "gray_blue",
      from: [114.9300, 4.5800], to: [139.7200, 35.5300] },
    { name: "AM Green Kakinada → Keppel Sakra, Singapore (green ammonia)", color: "green",
      from: [82.2400, 16.9900], to: [103.6500, 1.2700] },
    // Contracted intercontinental corridors (v4)
    { name: "NEOM → global ammonia (Air Products, 30-yr exclusive, first export 2027)", color: "green",
      from: [35.0300, 28.0800], to: [4.1000, 51.9300] },
    { name: "Egypt Green → Rotterdam (H2Global: 397 kt over 10 yrs @ ~€1,000/t)", color: "green",
      from: [32.3200, 29.6000], to: [4.2000, 51.9200] },
    { name: "AM Green Kakinada → Uniper Europe (500 kt/yr RFNBO NH3, 2028)", color: "green",
      from: [82.2400, 16.9900], to: [8.1200, 53.5600] },
    { name: "Sembcorp India → Kyushu Electric Japan (200 kt/yr NH3 co-firing)", color: "green",
      from: [78.1300, 8.7600], to: [130.5500, 33.2300] },
    { name: "EverWind Nova Scotia → Germany (EU-subsidized export corridor)", color: "green",
      from: [-61.3500, 45.5900], to: [8.1000, 53.5500] }
  ],

  // Fallback snapshot for the fueling-station layer, used only if the live
  // DOE AFDC API fetch fails. Note: California's retail network is contracting —
  // ~55 operational stations vs the state's goal of 200 by 2025.
  fuelingStationsFallback: {
    type: "FeatureCollection",
    features: [
      feat([-118.4912, 34.0195], { name: "Santa Monica Retail H2 Station (cached)", category: "end_use", subtype: "Fueling Station", color: "gray_blue", capacity: "Light-duty", status: "Cached snapshot", operator: "True Zero", source: "https://afdc.energy.gov/stations", updated: "snapshot", scale: 1 }),
      feat([-117.6534, 34.0397], { name: "Ontario H2 Station (cached)", category: "end_use", subtype: "Fueling Station", color: "gray_blue", capacity: "Light + Heavy-duty", status: "Cached snapshot", operator: "True Zero", source: "https://afdc.energy.gov/stations", updated: "snapshot", scale: 1 }),
      feat([-122.2727, 37.8716], { name: "Berkeley H2 Station (cached)", category: "end_use", subtype: "Fueling Station", color: "gray_blue", capacity: "Light-duty", status: "Cached snapshot", operator: "True Zero", source: "https://afdc.energy.gov/stations", updated: "snapshot", scale: 1 }),
      feat([-121.2733, 36.1449], { name: "Coalinga Heavy-Duty H2 Station (cached)", category: "end_use", subtype: "Fueling Station", color: "gray_blue", capacity: "Heavy-duty truck", status: "Cached snapshot", operator: "First Element / Shell", source: "https://afdc.energy.gov/stations", updated: "snapshot", scale: 1 }),
      feat([-117.8265, 33.8703], { name: "Diamond Bar H2 Station (cached)", category: "end_use", subtype: "Fueling Station", color: "gray_blue", capacity: "Light-duty", status: "Cached snapshot", operator: "True Zero", source: "https://afdc.energy.gov/stations", updated: "snapshot", scale: 1 })
    ]
  }
};

// Global context stats — IEA Hydrogen Tracker / Global Hydrogen Review 2026
// (iea.org/data-and-statistics/data-tools/hydrogen-tracker, updated 18 Jun 2026)
// + July 2026 Gemini Deep Research global assessment.
window.HYDROGEN_DATA.ieaGlobal = {
  source: "https://www.iea.org/data-and-statistics/data-tools/hydrogen-tracker",
  label: "IEA Hydrogen Tracker / GHR 2026 + global assessment",
  facts: [
    "Low-emissions H₂ reached ~1 Mt in 2025 — set to top 1% of global production in 2026",
    "Installed electrolysis capacity doubled in 2025 to >4 GW, led by China",
    "Only 4–7% of the 520 GW of announced projects worldwide have reached construction",
    "Committed 2030 production: 4.3 Mt — potential >6 Mt if pending FIDs land",
    "Investment ~$7B in 2025, heading toward ~$10B in 2026",
    "China ALK stacks now <$400/kW — 39 GW of factory capacity vs 1.1 GW domestic demand",
    "EU Hydrogen Bank Auction 3: €1.3B, 7× oversubscribed, winning bids from €0.44/kg",
    "Unsubsidized green H₂: $5–7/kg in US/EU · $3–4.5/kg in China · gray incumbent $1.5–2.5/kg",
    "NEOM is 90% complete — 600 t/day green H₂, first ammonia export locked for 2027",
    "China holds >60% of committed electrolyser capacity through 2026"
  ]
};

function feat(coords, properties) {
  return { type: "Feature", geometry: { type: "Point", coordinates: coords }, properties };
}

// ---- Post-processing: normalize statusClass + region on every feature.
(function normalize() {
  const classify = (s) => {
    const t = String(s || "").toLowerCase();
    if (/pause|delay|pivot|cancel|terminat|doubt|review|at risk|withdr|abandon|suspend|paralyz/.test(t)) return "atrisk";
    if (/construct|commissioning/.test(t)) return "construction";
    if (/operat|pilot complete|cached/.test(t)) return "operating";
    if (/plan/.test(t)) return "planned";
    return "other";
  };
  ["upstream", "production", "manufacturing", "storagePoints", "pipelines", "endUse", "fuelingStationsFallback"].forEach((k) => {
    (window.HYDROGEN_DATA[k].features || []).forEach((f) => {
      f.properties.statusClass = classify(f.properties.status);
      if (!f.properties.region) f.properties.region = "americas";
      if (!f.properties.scale) f.properties.scale = 2;
    });
  });
})();
