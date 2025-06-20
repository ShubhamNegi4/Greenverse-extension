// background.js

// Load and group alternatives.json by category on startup
async function loadJSON(name) {
  const url = chrome.runtime.getURL(`data/${name}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${name}`);
  return res.json();
}

let DATA = { alternatives: {} };

chrome.runtime.onInstalled.addListener(loadAllData);
loadAllData();

async function loadAllData() {
  try {
    const alternativesArray = await loadJSON('alternatives.json');
    // Group by categoryKey
    const grouped = alternativesArray.reduce((acc, item) => {
      const cat = item.category;
      if (!cat) return acc;
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(item);
      return acc;
    }, {});
    // Optionally sort each category once by score desc, price asc
    for (const cat in grouped) {
      grouped[cat].sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        if (a.price != null && b.price != null) return a.price - b.price;
        return 0;
      });
    }
    DATA.alternatives = grouped;
    console.log('Background: loaded and grouped alternatives.json', 
                Object.keys(DATA.alternatives).map(k => [k, DATA.alternatives[k].length]));
  } catch (err) {
    console.error('Background: failed to load alternatives.json', err);
  }
}

// Keyword scoring helper (same as before)
function computeKeywordScore(text = '') {
  const lower = text.toLowerCase();
  let score = 50;
  
  const POSITIVE_TERMS = [
    "organic", "certified organic", "gots", "recycled", "sustainable", "eco-friendly", "eco friendly",
    "biodegradable", "compostable", "fair trade", "energy efficient", "renewable", "low impact", "vegan",
    "cruelty free", "zero waste", "carbon neutral", "plant-based", "upcycled", "refurbished", "fsc",
    "organic cotton", "hemp", "bamboo", "eco", "green", "natural", "non-toxic", "water saving",
    "energy saving", "reusable", "durable", "recyclable", "recycled content", "cradle to cradle",
    "closed loop", "sustainably sourced", "ethically sourced", "locally made", "sustainable materials",
    "environmentally friendly", "sustainable packaging", "plastic free", "minimal packaging",
    "compostable packaging", "recycled packaging", "low carbon", "carbon negative", "climate positive"
  ];

  const NEGATIVE_TERMS = [
    "polyester", "pesticide", "synthetic", "chemical", "toxic", "harmful", "petroleum", "pvc", "phthalate", "bpa",
    "lead", "cadmium", "mercury", "heavy metal", "unsustainable", "high carbon", "high energy", "wasteful",
    "disposable", "single use", "fast fashion", "excessive packaging", "plastic packaging", "non-recyclable",
    "virgin plastic", "deforestation", "overexploited", "sweatshop", "low quality", "short lifespan",
    "planned obsolescence", "hard to repair", "toxic chemicals", "hazardous", "polluting", "high water usage",
    "water intensive", "energy intensive", "carbon intensive", "fossil fuel", "non-renewable", "high emission",
    "high footprint", "landfill", "incineration", "imported", "long distance transport", "air freighted"
  ];
  
  POSITIVE_TERMS.forEach(term => {
    if (term.includes("certified") || term === "gots" || term === "fsc") {
      if (lower.includes(term)) score += 15;
    } else if (lower.includes(term)) {
      score += 10;
    }
  });
  NEGATIVE_TERMS.forEach(term => {
    if (term === "toxic" || term === "bpa" || term === "phthalate") {
      if (lower.includes(term)) score -= 20;
    } else if (lower.includes(term)) {
      score -= 15;
    }
  });
  return Math.min(Math.max(score, 0), 100);
}

// Derive categoryKey from title (same as before)
function deriveCategoryKey(text = '') {
  const lower = text.toLowerCase();
  if (/(t[- ]?shirt|polo)/.test(lower)) return 'tshirt';
  if (/(charger|adapter)/.test(lower)) return 'phone_charger';
  if (/(coffee mug|mug|cup)/.test(lower)) return 'coffee_mug';
  if (/(water bottle|bottle|flask)/.test(lower)) return 'plastic_bottle';
  if (/(sneaker|shoe|trainers|running shoe)/.test(lower)) return 'sneakers';
  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;
  
  if (type === 'GET_PREFS') {
    chrome.storage.local.get('prefs', data => {
      sendResponse(data.prefs || {
        strictOrganic: false,
        organicWeight: 0.7,
        priceWeight: 0.3
      });
    });
    return true;
  }
  
  if (type === 'SET_PREFS') {
    chrome.storage.local.set({ prefs: payload }, () => {
      sendResponse({ success: true });
    });
    return true;
  }

  if (type === 'GET_ALTERNATIVES') {
    const { title, priceRange, basePrice } = payload;
    const categoryKey = deriveCategoryKey(title) || null;
    if (!categoryKey) {
      sendResponse({ error: 'Cannot derive category' });
      return true;
    }
    const list = DATA.alternatives[categoryKey] || [];
    // Compute a rough “current score” based on keyword only, since background may not have full context
    const currentScore = computeKeywordScore(title);
    console.log('GET_ALTERNATIVES:', { title, categoryKey, currentScore, listLen: list.length });

    let candidates = Array.from(list); // shallow copy

    // 1) Try items with strictly higher score
    let better = candidates.filter(item => item.score > currentScore);

    // 2) If we have priceRange, filter by it first; otherwise skip price filter
    if (priceRange && better.length > 0) {
      const inRange = better.filter(item => item.price != null 
                            && item.price >= priceRange.min 
                            && item.price <= priceRange.max);
      if (inRange.length > 0) {
        better = inRange;
      } 
      // else: keep better as-is (higher score) so we can pick best even if outside priceRange
    }

    // 3) If none strictly higher-score items, try equal-score but cheaper than basePrice
    if (better.length === 0) {
      let bp = basePrice;
      if ((bp == null || isNaN(bp)) && priceRange) {
        bp = (priceRange.min + priceRange.max) / 2;
      }
      if (bp != null && !isNaN(bp)) {
        const equalCheaper = candidates.filter(item => 
          item.score === currentScore && item.price != null && item.price < bp
        );
        if (equalCheaper.length > 0) {
          better = equalCheaper;
          console.log('Equal-score cheaper found:', equalCheaper.length);
        }
      }
    }

    // 4) Eco-keyword fallback if still none
    if (better.length === 0) {
      const ecoCandidates = candidates.filter(item => {
        const lowerT = (item.title || '').toLowerCase();
        return /\borganic\b/.test(lowerT) 
            || /\brecycled\b/.test(lowerT) 
            || /\bsustainable\b/.test(lowerT);
      });
      if (ecoCandidates.length > 0) {
        better = ecoCandidates;
        console.log('Eco-keyword fallback found:', ecoCandidates.length);
      }
    }

    // 5) If still none, as a last resort return top N by score ignoring currentScore comparison
    if (better.length === 0) {
      console.log('No better or eco fallback; using top by score from full list');
      better = Array.from(candidates);
    }

    // Sort filtered set: score desc, then price asc
    better.sort((a,b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.price != null && b.price != null) return a.price - b.price;
      return 0;
    });

    // Finally take up to top 5
    const topN = better.slice(0, 5);
    console.log('Returning alternatives count:', topN.length);
    sendResponse({ alternatives: topN });
    return true;
  }

  if (type === 'LOG_ACTION') {
    const { deltaCO2 } = payload || {};
    chrome.storage.local.get(['totalCO2Saved'], data => {
      const total = (data.totalCO2Saved || 0) + (deltaCO2 || 0);
      chrome.storage.local.set({ totalCO2Saved: total });
    });
    sendResponse({ success: true });
    return true;
  }

  return false;
});
