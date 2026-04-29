// ─────────────────────────────────────────────────────────────────────────────
//  STATIC DATA
//  - PRODUCTS: 26 LORGAR SKUs across 5 categories
//  - MARKETS: 7 separate markets with retailers + aggregator + currency
//  - COMPETITOR_BRANDS: list considered when Sonnet builds the competitive map
// ─────────────────────────────────────────────────────────────────────────────

export const PRODUCTS = [
  // ── Gaming Mice ──
  { c: "Gaming Mice", s: "LRG-MSE357",   n: "LORGAR Jetter 357" },
  { c: "Gaming Mice", s: "LRG-MSE579",   n: "LORGAR Stricter 579" },
  { c: "Gaming Mice", s: "LRG-MSA10",    n: "LORGAR MSA10 Advanced" },
  { c: "Gaming Mice", s: "LRG-MSA10W",   n: "LORGAR MSA10W Advanced Wireless" },
  { c: "Gaming Mice", s: "LRG-MSP80",    n: "LORGAR MSP80 Pro" },
  { c: "Gaming Mice", s: "LRG-MSE90W",   n: "LORGAR MSE90W Elite Wireless" },
  // ── Gaming Keyboards ──
  { c: "Gaming Keyboards", s: "LRG-KBP514",    n: "LORGAR Azar 514" },
  { c: "Gaming Keyboards", s: "LRG-KBP514TKL", n: "LORGAR Azar 514 TKL" },
  { c: "Gaming Keyboards", s: "LRG-KBP70TKLW", n: "LORGAR KBP70TKLW Wireless TKL" },
  { c: "Gaming Keyboards", s: "LRG-KBP7075W",  n: "LORGAR KBP7075W Wireless 75%" },
  { c: "Gaming Keyboards", s: "LRG-KBP70MW",   n: "LORGAR KBP70MW Wireless" },
  // ── Gaming Headsets ──
  { c: "Gaming Headsets", s: "LRG-GHS101B", n: "LORGAR Noah 101 Black" },
  { c: "Gaming Headsets", s: "LRG-GHS101W", n: "LORGAR Noah 101 White" },
  { c: "Gaming Headsets", s: "LRG-GHS500",  n: "LORGAR Noah 500" },
  { c: "Gaming Headsets", s: "LRG-GHS501",  n: "LORGAR Noah 501 Wireless" },
  { c: "Gaming Headsets", s: "LRG-GHS701",  n: "LORGAR Noah 701 Wireless" },
  { c: "Gaming Headsets", s: "LRG-GHS702",  n: "LORGAR Noah 702 Elite Wireless" },
  { c: "Gaming Headsets", s: "LRG-GHS460",  n: "LORGAR Kaya 460" },
  // ── Webcams & Mics ──
  { c: "Webcams & Mics", s: "LRG-SC701BL", n: "LORGAR Rapax 701 Blue" },
  { c: "Webcams & Mics", s: "LRG-SC701WT", n: "LORGAR Rapax 701 White" },
  { c: "Webcams & Mics", s: "LRG-SC701PK", n: "LORGAR Rapax 701 Pink" },
  { c: "Webcams & Mics", s: "LRG-SC910",   n: "LORGAR Circulus 910" },
  { c: "Webcams & Mics", s: "LRG-SMP40",   n: "LORGAR SMP40 Pro Microphone" },
  // ── Mousepads ──
  { c: "Mousepads", s: "LRG-GMP913", n: "LORGAR Steller 913" },
  { c: "Mousepads", s: "LRG-GMP919", n: "LORGAR Steller 919 RGB" },
  { c: "Mousepads", s: "LRG-GMP319", n: "LORGAR Main 319" },
];

export const CATEGORIES = ["Gaming Mice", "Gaming Keyboards", "Gaming Headsets", "Webcams & Mics", "Mousepads"];

export const CAT_ICON = {
  "Gaming Mice": "M",
  "Gaming Keyboards": "K",
  "Gaming Headsets": "H",
  "Webcams & Mics": "W",
  "Mousepads": "P",
};
export const CAT_COLOR = {
  "Gaming Mice": "#e85d04",
  "Gaming Keyboards": "#58a6ff",
  "Gaming Headsets": "#3fb950",
  "Webcams & Mics": "#bc8cff",
  "Mousepads": "#e3b341",
};

// ── MARKETS (7 separate countries) ─────────────────────────────────────────
export const MARKETS = {
  Poland: {
    code: "PL",
    currency: "PLN",
    retailers: ["x-kom.pl", "morele.net", "komputronik.pl", "mediaexpert.pl"],
    aggregator: "ceneo.pl",
    aggregatorSearch: q => `https://www.ceneo.pl/szukaj-${encodeURIComponent(q)}`,
  },
  Czechia: {
    code: "CZ",
    currency: "CZK",
    retailers: ["alza.cz", "czc.cz", "mironet.cz", "datart.cz"],
    aggregator: "heureka.cz",
    aggregatorSearch: q => `https://www.heureka.cz/?h%5Bfraze%5D=${encodeURIComponent(q)}`,
  },
  Hungary: {
    code: "HU",
    currency: "HUF",
    retailers: ["alza.hu", "emag.hu", "edigital.hu", "extreme.hu"],
    aggregator: "arukereso.hu",
    aggregatorSearch: q => `https://www.arukereso.hu/kereses/?searchTerm=${encodeURIComponent(q)}`,
  },
  Romania: {
    code: "RO",
    currency: "RON",
    retailers: ["emag.ro", "altex.ro", "cel.ro", "pcgarage.ro"],
    aggregator: "compari.ro",
    aggregatorSearch: q => `https://www.compari.ro/cautare/?q=${encodeURIComponent(q)}`,
  },
  Estonia: {
    code: "EE",
    currency: "EUR",
    retailers: ["arvutitark.ee", "1a.ee", "photopoint.ee", "klick.ee"],
    aggregator: "hinnavaatlus.ee",
    aggregatorSearch: q => `https://hinnavaatlus.ee/search?q=${encodeURIComponent(q)}`,
  },
  Latvia: {
    code: "LV",
    currency: "EUR",
    retailers: ["1a.lv", "datorzona.lv", "euronics.lv", "capital.lv"],
    aggregator: "salidzini.lv",
    aggregatorSearch: q => `https://www.salidzini.lv/cena.php?q=${encodeURIComponent(q)}`,
  },
  Lithuania: {
    code: "LT",
    currency: "EUR",
    retailers: ["kilobaitas.lt", "pigu.lt", "varle.lt", "topocentras.lt"],
    aggregator: "kainos.lt",
    aggregatorSearch: q => `https://www.kainos.lt/paieska/${encodeURIComponent(q)}`,
  },
};

// ── COMPETITOR BRANDS (with category fit + market presence per region) ────
export const COMPETITOR_BRANDS = [
  // Tier-1 global
  { name: "Logitech G",   tier: "global",   cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets","Webcams & Mics","Mousepads"] },
  { name: "Razer",        tier: "global",   cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets","Webcams & Mics","Mousepads"] },
  { name: "SteelSeries",  tier: "global",   cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets","Mousepads"] },
  { name: "HyperX",       tier: "global",   cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets","Webcams & Mics","Mousepads"] },
  { name: "Corsair",      tier: "global",   cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets","Mousepads"] },
  { name: "ASUS ROG",     tier: "global",   cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets"] },
  { name: "Glorious",     tier: "global",   cats: ["Gaming Mice","Gaming Keyboards","Mousepads"] },
  { name: "Elgato",       tier: "global",   cats: ["Webcams & Mics"] },
  { name: "Turtle Beach", tier: "global",   cats: ["Gaming Headsets"] },
  { name: "JBL Quantum",  tier: "global",   cats: ["Gaming Headsets"] },
  { name: "Keychron",     tier: "global",   cats: ["Gaming Keyboards"] },
  // Tier-2 regional / value
  { name: "Genesis",      tier: "regional", cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets","Mousepads"] },
  { name: "Trust GXT",    tier: "regional", cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets","Webcams & Mics","Mousepads"] },
  { name: "ENDORFY",      tier: "regional", cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets","Mousepads"] },
  { name: "KRUX",         tier: "regional", cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets","Mousepads"] },
  { name: "Roccat",       tier: "regional", cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets"] },
  { name: "Speedlink",    tier: "regional", cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets","Webcams & Mics"] },
  { name: "Sharkoon",     tier: "regional", cats: ["Gaming Mice","Gaming Keyboards","Gaming Headsets","Webcams & Mics"] },
];

// Brand market presence (rough estimates 0-100, used for brand strength scoring)
// Higher = stronger / more recognized in that region
export const BRAND_PRESENCE = {
  "Logitech G":   { PL: 30, CZ: 28, HU: 26, RO: 24, EE: 26, LV: 26, LT: 26 },
  "Razer":        { PL: 22, CZ: 20, HU: 18, RO: 18, EE: 18, LV: 18, LT: 18 },
  "SteelSeries":  { PL: 18, CZ: 18, HU: 16, RO: 16, EE: 18, LV: 18, LT: 18 },
  "HyperX":       { PL: 20, CZ: 18, HU: 18, RO: 18, EE: 16, LV: 16, LT: 16 },
  "Corsair":      { PL: 16, CZ: 18, HU: 14, RO: 14, EE: 14, LV: 14, LT: 14 },
  "ASUS ROG":     { PL: 16, CZ: 16, HU: 14, RO: 14, EE: 12, LV: 12, LT: 12 },
  "Glorious":     { PL: 10, CZ: 12, HU: 8,  RO: 8,  EE: 8,  LV: 8,  LT: 8  },
  "Elgato":       { PL: 12, CZ: 14, HU: 10, RO: 10, EE: 10, LV: 10, LT: 10 },
  "Turtle Beach": { PL: 8,  CZ: 8,  HU: 6,  RO: 6,  EE: 8,  LV: 8,  LT: 8  },
  "JBL Quantum":  { PL: 10, CZ: 12, HU: 10, RO: 12, EE: 10, LV: 10, LT: 10 },
  "Keychron":     { PL: 8,  CZ: 8,  HU: 6,  RO: 6,  EE: 6,  LV: 6,  LT: 6  },
  "Genesis":      { PL: 28, CZ: 14, HU: 18, RO: 16, EE: 14, LV: 14, LT: 14 },
  "Trust GXT":    { PL: 14, CZ: 14, HU: 14, RO: 14, EE: 12, LV: 12, LT: 12 },
  "ENDORFY":      { PL: 22, CZ: 20, HU: 16, RO: 12, EE: 10, LV: 10, LT: 10 },
  "KRUX":         { PL: 24, CZ: 6,  HU: 6,  RO: 4,  EE: 4,  LV: 4,  LT: 4  },
  "Roccat":       { PL: 10, CZ: 12, HU: 10, RO: 10, EE: 10, LV: 10, LT: 10 },
  "Speedlink":    { PL: 8,  CZ: 12, HU: 10, RO: 8,  EE: 8,  LV: 8,  LT: 8  },
  "Sharkoon":     { PL: 10, CZ: 14, HU: 10, RO: 8,  EE: 8,  LV: 8,  LT: 8  },
};
