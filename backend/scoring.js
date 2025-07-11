function normalize(value, min, max) {
  if (min === max) return 0.5;
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

const SCIENTIFIC_BASE = {
  tshirt: 8.2,
  jeans: 12.5,
  plastic_bottle: 0.18,
  phone_charger: 0.15,
  coffee_mug: 0.35,
  sneakers: 16.8
};

const CATEGORY_MAX_VALUES = {
  tshirt: { maxCO2: 15, maxWater: 2500, maxWaste: 0.5, maxPrice: 2000 },
  jeans: { maxCO2: 25, maxWater: 8000, maxWaste: 1.2, maxPrice: 5000 },
  plastic_bottle: { maxCO2: 1.0, maxWater: 10, maxWaste: 0.2, maxPrice: 1500 },
  phone_charger: { maxCO2: 0.5, maxWater: 50, maxWaste: 0.3, maxPrice: 2500 },
  coffee_mug: { maxCO2: 1.5, maxWater: 100, maxWaste: 0.4, maxPrice: 2000 },
  sneakers: { maxCO2: 30, maxWater: 4000, maxWaste: 1.5, maxPrice: 8000 },
  default: { maxCO2: 20, maxWater: 5000, maxWaste: 1.0, maxPrice: 5000 }
};

class CarbonModel {
  constructor() {
    this.weights = {
      organic: -0.25,
      recycled: -0.32,
      recycledPercent: -0.003,
      polyester: 0.28,
      imported: 0.22,
      airFreight: 0.52,
      fastFashion: 0.23,
      sustainableBrand: -0.28,
      distance: 0.00005,
      durability: -0.12,
      waterEfficient: -0.08,
      energyStar: -0.10,
      localProduction: -0.15,
      renewableEnergy: -0.18,
      syntheticMaterial: 0.25
    };
  }

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
    energyStar: 0,
    localProduction: 0,
    renewableEnergy: 0,
    syntheticMaterial: 0
  };
  
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
  
  if (/\bimported\b(?! from)/.test(lower)) features.imported = 1;
  if (/\bair freight\b/.test(lower)) features.airFreight = 1;
  if (/\bfast fashion\b/.test(lower)) features.fastFashion = 1;
  
  const SUSTAINABLE_BRANDS = ['patagonia', 'tentree', 'allbirds', 'reformation', 
                             'ecofriendly', 'ecoalf', 'thought', 'people tree'];
  if (SUSTAINABLE_BRANDS.some(b => new RegExp(`\\b${b}\\b`).test(lower))) {
    features.sustainableBrand = 1;
  }
  
  if (/\bmade in china\b/.test(lower)) features.distance = 5000;
  else if (/\bmade in bangladesh\b/.test(lower)) features.distance = 3000;
  else if (/\bmade in india\b/.test(lower)) features.distance = 0;
  else if (/\bimported\b/.test(lower)) features.distance = 4000;
  
  if (/\bdurable\b/.test(lower)) features.durability += 0.4;
  if (/\blong lasting\b/.test(lower)) features.durability += 0.3;
  if (/\bhigh quality\b/.test(lower)) features.durability += 0.3;
  features.durability = Math.min(features.durability, 1.0);
  
  if (/\bwater efficient\b/.test(lower)) features.waterEfficient = 1;
  if (/\benergy star\b/.test(lower)) features.energyStar = 1;
  
  if (/\blocal\b/.test(lower)) features.localProduction = 1;
  if (/\brenewable energy\b/.test(lower)) features.renewableEnergy = 1;
  
  if (/\bacrylic\b/.test(lower) || /\bnylon\b/.test(lower)) {
    features.syntheticMaterial = 1;
  }
  
  return features;
}

export function estimateCarbonFootprint(text = '', categoryKey) {
  const base = SCIENTIFIC_BASE[categoryKey] || 8.0;
  const features = extractFeatures(text, categoryKey);
  const model = new CarbonModel();
  const correction = model.predict(features);
  const adjustedFootprint = base * (1 + correction);
  return Math.max(0.1, parseFloat(adjustedFootprint.toFixed(2)));
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
  return (rating / 5) * 100;
}

export function computeReviewCountScore(count = 0) {
  const logCount = Math.min(Math.log10(count + 1), 4);
  return (logCount / 4) * 100;
}

export function computePriceScore(price, minPrice, maxPrice) {
  if (minPrice === maxPrice) return 100;
  const normalized = Math.max(0, 1 - ((price - minPrice) / (maxPrice - minPrice)));
  return normalized * 100;
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

export function computePriceAppropriatenessScore(productPrice, referencePrice) {
  if (productPrice <= referencePrice) return 100;
  
  const ratio = referencePrice / productPrice;
  return Math.max(20, Math.min(100, ratio * 100));
}

export function computeFinalScore(
  { carbon, keywords, rating, reviews, price, durability },
  categoryKey,
  referencePrice
) {
  const maxVals = CATEGORY_MAX_VALUES[categoryKey] || CATEGORY_MAX_VALUES.default;
  
  const carbonScore = Math.max(0, 1 - (carbon / maxVals.maxCO2)) * 100;
  const keywordScore = keywords;
  const ratingScore = rating;
  const reviewScore = reviews;
  const priceScore = computePriceAppropriatenessScore(price, referencePrice);
  const durabilityScore = durability;
  
  const totalScore = 
    (carbonScore * 0.30) +
    (keywordScore * 0.15) +
    (ratingScore * 0.25) +
    (reviewScore * 0.05) +
    (priceScore * 0.20) +
    (durabilityScore * 0.05);
    
  return Math.min(Math.round(totalScore), 100);
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

export function getCategoryMaxValues(categoryKey) {
  return CATEGORY_MAX_VALUES[categoryKey] || CATEGORY_MAX_VALUES.default;
}