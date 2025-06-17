function normalize(value, min, max) {
  if (min === max) return 1;
  return Math.min(Math.max((value - min) / (max - min), 0), 1);
}

const POSITIVE_TERMS = [
  "organic", "certified organic", "GOTS", "recycled", "sustainable", "eco-friendly", "eco friendly",
  "biodegradable", "compostable", "fair trade", "energy efficient", "renewable", "low impact", "vegan",
  "cruelty free", "zero waste", "carbon neutral", "plant-based", "upcycled", "refurbished", "FSC",
  "organic cotton", "hemp", "bamboo", "eco", "green", "natural", "non-toxic", "water saving",
  "energy saving", "reusable", "durable", "recyclable", "recycled content", "cradle to cradle",
  "closed loop", "sustainably sourced", "ethically sourced", "locally made", "sustainable materials",
  "environmentally friendly", "sustainable packaging", "plastic free", "minimal packaging",
  "compostable packaging", "recycled packaging", "low carbon", "carbon negative", "climate positive"
];

const NEGATIVE_TERMS = [
  "polyester", "pesticide", "synthetic", "chemical", "toxic", "harmful", "petroleum", "PVC", "phthalate", "BPA",
  "lead", "cadmium", "mercury", "heavy metal", "unsustainable", "high carbon", "high energy", "wasteful",
  "disposable", "single use", "fast fashion", "excessive packaging", "plastic packaging", "non-recyclable",
  "virgin plastic", "deforestation", "overexploited", "sweatshop", "low quality", "short lifespan",
  "planned obsolescence", "hard to repair", "toxic chemicals", "hazardous", "polluting", "high water usage",
  "water intensive", "energy intensive", "carbon intensive", "fossil fuel", "non-renewable", "high emission",
  "high footprint", "landfill", "incineration", "imported", "long distance transport", "air freighted"
];

// Scientific base values (kg CO₂e per unit) - from peer-reviewed studies
const SCIENTIFIC_BASE = {
  tshirt: 8.2,
  jeans: 12.5,
  plastic_bottle: 0.18,
  phone_charger: 0.15,
  coffee_mug: 0.35,
  sneakers: 16.8
};

// Pre-trained ML model weights (updated to prevent over-correction)
class CarbonModel {
  constructor() {
    this.weights = {
      organic: -0.205,
      recycled: -0.295,
      recycledPercent: -0.0028,
      polyester: 0.2375,
      imported: 0.18,
      airFreight: 0.4625,
      fastFashion: 0.195,
      sustainableBrand: -0.23,
      distance: 0.000045,
      durability: -0.095,
      waterEfficient: -0.0625,
      energyStar: -0.0875
    };
  }

  // Predict correction factor (no longer capped)
  predict(features) {
    let correction = 0;
    for (const [feature, value] of Object.entries(features)) {
      if (this.weights[feature] !== undefined) {
        correction += this.weights[feature] * value;
      }
    }
    return correction;
  }
}

// Enhanced feature extraction
function extractFeatures(text, categoryKey) {
  const lower = text.toLowerCase();
  const features = {
    organic: 0,
    recycled: 0,
    recycledPercent: 0,
    polyester: 0,
    imported: 0,
    airFreight: 0,
    fastFashion: 0,
    sustainableBrand: 0,
    distance: 0,
    durability: 0,
    waterEfficient: 0,
    energyStar: 0
  };
  
  // Material composition
  if (/\borganic\b/.test(lower)) features.organic = 1;
  
  const recycledMatch = lower.match(/(\d+)% recycled/);
  if (recycledMatch) {
    features.recycled = 1;
    features.recycledPercent = parseInt(recycledMatch[1]) / 100;
  } else if (/\brecycled\b/.test(lower)) {
    features.recycled = 1;
    features.recycledPercent = 0.3;
  }
  
  if (/\bpolyester\b/.test(lower)) features.polyester = 1;
  
  // Manufacturing and transportation
  if (/\bimported\b(?! from)/.test(lower)) features.imported = 1;
  if (/\bair freight\b/.test(lower)) features.airFreight = 1;
  if (/\bfast fashion\b/.test(lower)) features.fastFashion = 1;
  
  // Brand reputation
  const SUSTAINABLE_BRANDS = ['patagonia', 'tentree', 'allbirds', 'reformation', 
                             'ecofriendly', 'ecoalf', 'thought', 'people tree'];
  if (SUSTAINABLE_BRANDS.some(b => new RegExp(`\\b${b}\\b`).test(lower))) {
    features.sustainableBrand = 1;
  }
  
  // Location-based distance
  if (/\bmade in china\b/.test(lower)) features.distance = 5000;
  else if (/\bmade in bangladesh\b/.test(lower)) features.distance = 3000;
  else if (/\bmade in india\b/.test(lower)) features.distance = 0;
  else if (/\bimported\b/.test(lower)) features.distance = 4000;
  
  // Durability
  if (/\bdurable\b/.test(lower)) features.durability += 0.4;
  if (/\blong lasting\b/.test(lower)) features.durability += 0.3;
  if (/\bhigh quality\b/.test(lower)) features.durability += 0.3;
  features.durability = Math.min(features.durability, 1.0);
  
  // Efficiency certifications
  if (/\bwater efficient\b/.test(lower)) features.waterEfficient = 1;
  if (/\benergy star\b/.test(lower)) features.energyStar = 1;
  
  return features;
}

// Main carbon estimation function
export function estimateCarbonFootprint(text = '', categoryKey) {
  // Get scientific base for category
  const base = SCIENTIFIC_BASE[categoryKey] || 8.0;
  
  // Extract features from text
  const features = extractFeatures(text, categoryKey);
  
  // Get ML-based correction
  const model = new CarbonModel();
  const correction = model.predict(features);
  
  // Apply correction
  const adjustedFootprint = base * (1 + correction);
  
  return Math.max(0.1, parseFloat(adjustedFootprint.toFixed(2)));
}

export function computeFootprintScore(
  { co2, water, waste },
  { maxCO2, maxWater, maxWaste }
) {
  const α = 0.5,
    β = 0.3,
    γ = 0.2;
  const nCo2 = co2 / maxCO2;
  const nWater = water / maxWater;
  const nWaste = waste / maxWaste;
  const footprintIndex = α * nCo2 + β * nWater + γ * nWaste;
  return Math.round(100 * (1 - footprintIndex));
}

export function computeKeywordScore(text = '') {
  const lower = text.toLowerCase();
  let score = 50;
  
  POSITIVE_TERMS.forEach(term => {
    if (term.includes("certified") || term === "GOTS" || term === "FSC") {
      if (lower.includes(term)) score += 15;
    } else if (lower.includes(term)) {
      score += 10;
    }
  });
  
  NEGATIVE_TERMS.forEach(term => {
    if (term === "toxic" || term === "BPA" || term === "phthalate") {
      if (lower.includes(term)) score -= 20;
    } else if (lower.includes(term)) {
      score -= 15;
    }
  });
  
  return Math.min(Math.max(score, 0), 100);
}

export function computeRatingScore(rating = 0) {
  return Math.round((rating / 5) * 100);
}

export function computeReviewCountScore(count = 0) {
  const logCount = Math.min(Math.log10(count + 1), 4);
  return Math.round((logCount / 4) * 100);
}

export function computePriceScore(price, minPrice, maxPrice) {
  const norm = normalize(price, minPrice, maxPrice);
  return Math.round((1 - norm) * 100);
}

export function computeDurabilityScore(text = '') {
  const lower = text.toLowerCase();
  let score = 50;
  
  if (/\bdurable\b/.test(lower)) score += 20;
  if (/\blong lasting\b/.test(lower)) score += 15;
  if (/\bhigh quality\b/.test(lower)) score += 10;
  if (/\bhard to repair\b/.test(lower)) score -= 20;
  if (/\bplanned obsolescence\b/.test(lower)) score -= 25;
  
  return Math.min(Math.max(score, 0), 100);
}

export function computeFinalScore(
  { carbon, keywords, rating, reviews, price, durability },
  weights = { wCarbon: 0.35, wKey: 0.25, wRate: 0.15, wRev: 0.10, wPrice: 0.10, wDurability: 0.05 }
) {
  const { wCarbon, wKey, wRate, wRev, wPrice, wDurability } = weights;
  const total =
    carbon * wCarbon +
    keywords * wKey +
    rating * wRate +
    reviews * wRev +
    price * wPrice +
    durability * wDurability;
    
  return Math.round(total);
}

export function deriveCategoryKey(text = '') {
  const lower = text.toLowerCase();
  if (/(t[- ]?shirt|polo)/.test(lower)) return 'tshirt';
  if (/(charger|adapter)/.test(lower)) return 'phone_charger';
  if (/(coffee mug|mug|cup)/.test(lower)) return 'coffee_mug';
  if (/(water bottle|bottle|flask)/.test(lower)) return 'plastic_bottle';
  if (/(sneaker|shoe|trainers|running shoe)/.test(lower)) return 'sneakers';
  return null;
}