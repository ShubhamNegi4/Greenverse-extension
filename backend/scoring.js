function normalize(value, min, max) {
  if (min === max) return 1;
  return Math.min(Math.max((value - min) / (max - min), 0), 1);
}

const POSITIVE_TERMS = [
  "organic",
  "certified organic",
  "GOTS",
  "recycled",
  "sustainable",
  "eco-friendly"
];
const NEGATIVE_TERMS = [
  "polyester",
  "pesticide",
  "synthetic",
  "chemical",
  "toxic",
  "harmful"
];

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
  POSITIVE_TERMS.forEach((term) => {
    if (lower.includes(term)) score += 10;
  });
  NEGATIVE_TERMS.forEach((term) => {
    if (lower.includes(term)) score -= 15;
  });
  return Math.round(Math.min(Math.max(score, 0), 100));
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

export function computeFinalScore(
  { footprint, keywords, rating, reviews, price },
  weights = { wFoot: 0.25, wKey: 0.25, wRate: 0.2, wRev: 0.15, wPrice: 0.15 }
) {
  const { wFoot, wKey, wRate, wRev, wPrice } = weights;
  const total =
    footprint * wFoot + keywords * wKey + rating * wRate + reviews * wRev + price * wPrice;
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