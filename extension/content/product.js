// File: extension/content/product.js

// Updated keyword lists
const POS_TERMS = [
  "organic", "certified organic", "gots", "recycled", "sustainable", "eco-friendly", "eco friendly",
  "biodegradable", "compostable", "fair trade", "energy efficient", "renewable", "low impact", "vegan",
  "cruelty free", "zero waste", "carbon neutral", "plant-based", "upcycled", "refurbished", "fsc",
  "organic cotton", "hemp", "bamboo", "eco", "green", "natural", "non-toxic", "water saving",
  "energy saving", "reusable", "durable", "recyclable", "recycled content", "cradle to cradle",
  "closed loop", "sustainably sourced", "ethically sourced", "locally made", "sustainable materials",
  "environmentally friendly", "sustainable packaging", "plastic free", "minimal packaging",
  "compostable packaging", "recycled packaging", "low carbon", "carbon negative", "climate positive"
];

const NEG_TERMS = [
  "polyester", "pesticide", "synthetic", "chemical", "toxic", "harmful", "petroleum", "pvc", "phthalate", "bpa",
  "lead", "cadmium", "mercury", "heavy metal", "unsustainable", "high carbon", "high energy", "wasteful",
  "disposable", "single use", "fast fashion", "excessive packaging", "plastic packaging", "non-recyclable",
  "virgin plastic", "deforestation", "overexploited", "sweatshop", "low quality", "short lifespan",
  "planned obsolescence", "hard to repair", "toxic chemicals", "hazardous", "polluting", "high water usage",
  "water intensive", "energy intensive", "carbon intensive", "fossil fuel", "non-renewable", "high emission",
  "high footprint", "landfill", "incineration", "imported", "long distance transport", "air freighted"
];

// Enhanced scoring functions
function computeKeywordScore(text = "") {
  const lower = text.toLowerCase();
  let s = 50;
  POS_TERMS.forEach(t => {
    if (t.includes("certified") || t === "gots" || t === "fsc") {
      if (lower.includes(t)) s += 15;
    } else {
      if (lower.includes(t)) s += 10;
    }
  });
  NEG_TERMS.forEach(t => {
    if (t === "toxic" || t === "bpa" || t === "phthalate") {
      if (lower.includes(t)) s -= 20;
    } else {
      if (lower.includes(t)) s -= 15;
    }
  });
  return Math.max(0, Math.min(s, 100));
}

function computeRatingScore(r = 0) { 
  return Math.round((r/5)*100); 
}

function computeReviewCountScore(c = 0) {
  const lg = Math.min(Math.log10(c+1), 4);
  return Math.round((lg/4)*100);
}

function computeDurabilityScore(text = '') {
  const lower = text.toLowerCase();
  let score = 50;
  
  if (/\bdurable\b/.test(lower)) score += 20;
  if (/\blong lasting\b/.test(lower)) score += 15;
  if (/\bhigh quality\b/.test(lower)) score += 10;
  if (/\bhard to repair\b/.test(lower)) score -= 20;
  if (/\bplanned obsolescence\b/.test(lower)) score -= 25;
  
  return Math.min(Math.max(score, 0), 100);
}

function computeFinalScore(vals) {
  const {keywords, rating, reviews, durability = 50} = vals;
  return Math.round(keywords*0.4 + rating*0.3 + reviews*0.2 + durability*0.1);
}

// Hybrid Carbon Estimation with corrected weights
const CARBON_BASE = {
  tshirt: 8.2,
  jeans: 12.5,
  plastic_bottle: 0.18,
  phone_charger: 0.15,
  coffee_mug: 0.35,
  sneakers: 16.8
};

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

function extractFeatures(text = '', categoryKey) {
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
  
  return features;
}

function estimateCarbonFootprint(text = '', categoryKey) {
  const base = CARBON_BASE[categoryKey] || 8.0;
  const features = extractFeatures(text, categoryKey);
  const model = new CarbonModel();
  const correction = model.predict(features);
  const adjustedFootprint = base * (1 + correction);
  return Math.max(0.1, parseFloat(adjustedFootprint.toFixed(2)));
}

// Page scraping helpers
function getText(sel) {
  const el = document.querySelector(sel);
  return el?.textContent?.trim() || "";
}

function parsePrice(txt) {
  if (!txt) return null;
  const match = txt.match(/(\d[\d,]*\.?\d*)/);
  return match ? parseFloat(match[0].replace(/,/g, '')) : null;
}

function getNumber(sel, re) {
  const m = getText(sel).match(re);
  return m ? parseFloat(m[1].replace(/,/g, '')) : 0;
}

// Category mapping
const CATEGORY_MAP = {
  "t-shirt": "tshirt", "t shirt": "tshirt", "tee": "tshirt", 
  "jeans": "jeans", "pants": "jeans", 
  "charger": "phone_charger", "adapter": "phone_charger",
  "coffee mug": "coffee_mug", "mug": "coffee_mug", 
  "water bottle": "plastic_bottle", "bottle": "plastic_bottle", 
  "sneaker": "sneakers", "shoe": "sneakers", "footwear": "sneakers"
};

// Insert button
function insertGreenerButton() {
  const titleEl = document.querySelector('#productTitle') || 
                 document.querySelector('#title');
  
  if (!titleEl || document.getElementById('greener-btn')) return;
  
  const btn = document.createElement('button');
  btn.id = 'greener-btn';
  btn.innerText = 'Show greener alternatives';
  Object.assign(btn.style, {
    marginLeft: '10px', padding: '6px 12px',
    backgroundColor: '#4CAF50', color: '#fff',
    border: 'none', borderRadius: '4px', cursor: 'pointer',
    fontSize: '14px'
  });
  btn.onclick = onGreenerClick;
  
  titleEl.parentElement.appendChild(btn);
}

// Deduplicate products by removing color variants
function deduplicateProducts(products) {
  const seen = new Map();
  const uniqueProducts = [];
  
  products.forEach(product => {
    // Create a base name without color/size variants
    const baseName = product.title
      .replace(/\([^)]*\)/g, '') // Remove parentheses content
      .replace(/\b(black|blue|beige|orange|white|red|green|small|medium|large|xl|xxl)\b/gi, '')
      .replace(/\s\s+/g, ' ') // Collapse multiple spaces
      .trim()
      .toLowerCase();
    
    // Skip exact duplicates
    if (!seen.has(baseName)) {
      seen.set(baseName, true);
      uniqueProducts.push(product);
    }
  });
  
  return uniqueProducts;
}

// Main click handler
async function onGreenerClick() {
  if (document.getElementById('greener-panel')) return;

  // Show loading state
  const btn = document.getElementById('greener-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = 'Loading alternatives...';
  }

  try {
    // Scrape basic product info
    const rawTitle = getText('#productTitle') || getText('#title') || '';
    const priceText = getText('#priceblock_ourprice') || 
                     getText('#priceblock_dealprice') || 
                     getText('.a-price-whole') ||
                     getText('.a-offscreen');
    const basePrice = parsePrice(priceText);
    
    if (!rawTitle || basePrice === null) {
      return alert('Could not detect product title or price.');
    }
    
    const rating = getNumber('.a-icon-alt', /([0-5]\.?\d?) out of 5/);
    const reviewCount = getNumber('#acrCustomerReviewText', /([\d,]+)/);
    
    // Get product description text
    const bullets = Array.from(document.querySelectorAll('#feature-bullets li'))
                       .map(li => li.textContent.trim()).join(' ');
    const desc = getText('#productDescription');
    const allText = [rawTitle, bullets, desc].join(' ');

    // Determine category
    const lowerTitle = rawTitle.toLowerCase();
    let categoryKey = null;
    for (const [kw, cat] of Object.entries(CATEGORY_MAP)) {
      if (lowerTitle.includes(kw)) {
        categoryKey = cat;
        break;
      }
    }
    
    if (!categoryKey) {
      return alert('Could not determine product category.');
    }

    // Calculate current product carbon
    const currentCarbon = estimateCarbonFootprint(allText, categoryKey);
    
    // Calculate current product score
    const kScore = computeKeywordScore(allText);
    const rScore = computeRatingScore(rating);
    const vScore = computeReviewCountScore(reviewCount);
    const dScore = computeDurabilityScore(allText);
    const pageScore = computeFinalScore({
      keywords: kScore,
      rating: rScore,
      reviews: vScore,
      durability: dScore
    });

    // Load alternatives
    let alts;
    try {
      const response = await fetch(chrome.runtime.getURL('data/alternatives.json'));
      alts = await response.json();
    } catch (e) {
      console.error(e);
      return alert('Failed to load alternatives.');
    }

    // Find alternatives in the same category
    const categoryAlts = alts.filter(a => a.category === categoryKey);
    
    if (categoryAlts.length === 0) {
      return alert('No alternatives found for this category.');
    }

    // Sort by score descending
    categoryAlts.sort((a, b) => b.score - a.score);
    
    // Remove color variants
    const dedupedRecommendations = deduplicateProducts(categoryAlts);
    
    // Always show top recommendations
    const topRecommendations = dedupedRecommendations.slice(0, 5);
    
    // Display recommendations with current carbon
    displayRecommendations(topRecommendations, pageScore, currentCarbon);
  } catch (error) {
    console.error('Error:', error);
    alert('An error occurred. Please try again.');
  } finally {
    // Restore button state
    if (btn) {
      btn.disabled = false;
      btn.innerText = 'Show greener alternatives';
    }
  }
}

// Display recommendations with carbon info
function displayRecommendations(items, currentScore, currentCarbon) {
  const existingPanel = document.getElementById('greener-panel');
  if (existingPanel) existingPanel.remove();
  
  // Don't show if no recommendations
  if (items.length === 0) {
    return alert('No unique alternatives found after removing color variants');
  }
  
  const panel = document.createElement('div');
  panel.id = 'greener-panel';
  Object.assign(panel.style, {
    position: 'fixed', top: '20px', right: '20px',
    width: '400px', maxHeight: '80vh', overflowY: 'auto',
    backgroundColor: '#fff', border: '2px solid #4CAF50',
    padding: '20px', zIndex: 10000, boxShadow: '0 4px 15px rgba(0,0,0,0.2)',
    fontFamily: 'Arial, sans-serif', borderRadius: '10px'
  });

  const closeBtn = document.createElement('button');
  closeBtn.innerText = '×';
  closeBtn.style.cssText = `
    position: absolute; top: 10px; right: 15px;
    border: none; background: transparent;
    font-size: 24px; cursor: pointer; color: #666;
    line-height: 1;
  `;
  closeBtn.onclick = () => panel.remove();
  panel.appendChild(closeBtn);

  const header = document.createElement('h3');
  header.innerText = '🌿 Recommended Alternatives';
  header.style.margin = '0 0 15px 0';
  header.style.color = '#2E7D32';
  header.style.fontSize = '18px';
  panel.appendChild(header);

  const scoreInfo = document.createElement('div');
  scoreInfo.innerHTML = `
    <div style="margin-bottom: 10px">Current Product:</div>
    <div style="display: flex; justify-content: space-between; margin-bottom: 5px">
      <span>Sustainability Score:</span>
      <span style="font-weight: bold">${currentScore}/100</span>
    </div>
    <div style="display: flex; justify-content: space-between">
      <span>Carbon Footprint:</span>
      <span style="font-weight: bold">${currentCarbon.toFixed(2)} kg CO₂e</span>
    </div>
  `;
  scoreInfo.style.marginBottom = '20px';
  scoreInfo.style.paddingBottom = '15px';
  scoreInfo.style.borderBottom = '1px solid #eee';
  panel.appendChild(scoreInfo);

  const subtitle = document.createElement('div');
  subtitle.innerHTML = 'Top sustainable alternatives:';
  subtitle.style.fontWeight = 'bold';
  subtitle.style.marginBottom = '15px';
  subtitle.style.color = '#555';
  panel.appendChild(subtitle);

  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.style.marginBottom = '20px';
    itemDiv.style.padding = '15px';
    itemDiv.style.border = '1px solid #e0e0e0';
    itemDiv.style.borderRadius = '8px';
    itemDiv.style.transition = 'all 0.3s';
    itemDiv.style.cursor = 'pointer';
    
    itemDiv.onmouseover = () => {
      itemDiv.style.boxShadow = '0 4px 8px rgba(0,0,0,0.1)';
      itemDiv.style.borderColor = '#4CAF50';
    };
    
    itemDiv.onmouseout = () => {
      itemDiv.style.boxShadow = 'none';
      itemDiv.style.borderColor = '#e0e0e0';
    };

    const title = document.createElement('div');
    title.textContent = item.title;
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    title.style.fontSize = '15px';
    itemDiv.appendChild(title);
    
    const score = document.createElement('div');
    score.textContent = `Sustainability score: ${item.score}/100`;
    score.style.marginBottom = '8px';
    score.style.fontSize = '14px';
    score.style.color = item.score > 70 ? '#4CAF50' : 
                       item.score > 50 ? '#FF9800' : '#F44336';
    itemDiv.appendChild(score);
    
    // Add carbon footprint display
    if (item.carbon) {
      const savings = currentCarbon - item.carbon;
      const absSavings = Math.abs(savings).toFixed(2);
      
      const carbon = document.createElement('div');
      carbon.innerHTML = `
        <div style="display: flex; justify-content: space-between">
          <span>Carbon Footprint:</span>
          <span>${item.carbon.toFixed(2)} kg CO₂e</span>
        </div>
        <div style="display: flex; justify-content: space-between; margin-top: 5px">
          <span>Savings:</span>
          <span style="color: ${savings > 0 ? '#4CAF50' : savings < 0 ? '#F44336' : '#000'}; font-weight: bold">
            ${savings > 0 ? '↓' : savings < 0 ? '↑' : ''} ${absSavings} kg
          </span>
        </div>
      `;
      carbon.style.marginBottom = '8px';
      carbon.style.fontSize = '13px';
      carbon.style.color = '#555';
      itemDiv.appendChild(carbon);
    }
    
    const link = document.createElement('a');
    link.href = `https://www.amazon.in/dp/${item.asin}`;
    link.textContent = 'View on Amazon';
    link.target = '_blank';
    link.style.display = 'block';
    link.style.padding = '8px 12px';
    link.style.backgroundColor = '#f0f8ff';
    link.style.color = '#0066c0';
    link.style.textAlign = 'center';
    link.style.borderRadius = '4px';
    link.style.textDecoration = 'none';
    link.style.fontWeight = '500';
    link.style.transition = 'background 0.2s';
    
    link.onmouseover = () => {
      link.style.backgroundColor = '#e1f0ff';
    };
    
    link.onmouseout = () => {
      link.style.backgroundColor = '#f0f8ff';
    };
    
    itemDiv.appendChild(link);
    
    // Add click handler to entire card
    itemDiv.onclick = (e) => {
      if (e.target.tagName !== 'A') {
        window.open(link.href, '_blank');
      }
    };
    
    panel.appendChild(itemDiv);
  });

  const footer = document.createElement('div');
  footer.style.marginTop = '15px';
  footer.style.paddingTop = '15px';
  footer.style.borderTop = '1px solid #eee';
  footer.style.textAlign = 'center';
  footer.style.fontSize = '12px';
  footer.style.color = '#777';
  footer.innerText = 'Powered by GreenVerse Extension';
  panel.appendChild(footer);

  document.body.appendChild(panel);
  
  // Add overlay
  const overlay = document.createElement('div');
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.backgroundColor = 'rgba(0,0,0,0.5)';
  overlay.style.zIndex = '9999';
  overlay.onclick = () => {
    panel.remove();
    overlay.remove();
  };
  document.body.appendChild(overlay);
}

// Initialize with retry
function initExtension() {
  insertGreenerButton();
  
  // Retry after delay if button not inserted
  setTimeout(() => {
    if (!document.getElementById('greener-btn')) {
      insertGreenerButton();
    }
  }, 2000);
}

window.addEventListener('load', initExtension);