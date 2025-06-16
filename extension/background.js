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
    const alternatives = await loadJSON('alternatives.json');
    DATA.alternatives = alternatives;
    console.log('Background: loaded alternatives.json', alternatives);
  } catch (err) {
    console.error('Background: failed to load alternatives.json', err);
  }
}

function computeKeywordScore(text = '') {
  const lower = text.toLowerCase();
  if (/\borganic\b/.test(lower)) return 100;
  if (/\bcertified organic\b|\bGOTS\b/.test(lower)) return 100;
  if (/\brecycled\b|\bsustainable\b|\beco-friendly\b|\beco friendly\b/.test(lower)) return 70;
  return 50;
}

function deriveCategoryKey(text = '') {
  const lower = text.toLowerCase();
  if (lower.includes('t-shirt') || lower.includes('t shirt') || lower.includes('polo') || lower.includes('shirt')) return 'tshirt';
  if (lower.includes('charger') || lower.includes('adapter')) return 'phone_charger';
  if (lower.includes('coffee mug') || lower.includes('mug') || lower.includes('cup')) return 'coffee_mug';
  if (lower.includes('water bottle') || lower.includes('bottle') || lower.includes('flask')) return 'plastic_bottle';
  if (lower.includes('sneaker') || lower.includes('shoe') || lower.includes('trainers') || lower.includes('running shoe')) return 'sneakers';
  return null;
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message;
  
  // FIXED: Proper preferences handling
  if (type === 'GET_PREFS') {
    chrome.storage.local.get('prefs', data => {
      sendResponse(data.prefs || {
        strictOrganic: false,
        organicWeight: 0.7,
        priceWeight: 0.3
      });
    });
    return true; // Indicates async response
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
    const currentScore = computeKeywordScore(title);
    console.log('GET_ALTERNATIVES:', { title, categoryKey, currentScore, listLen: list.length });

    // 1) Higher-score items within priceRange
    let better = list.filter(item => {
      if (item.score <= currentScore) return false;
      if (priceRange && item.price != null) {
        return item.price >= priceRange.min && item.price <= priceRange.max;
      }
      return true;
    });

    // 2) If none, equal-score but cheaper
    if (better.length === 0) {
      let bp = basePrice;
      if (bp == null && priceRange) bp = (priceRange.min + priceRange.max)/2;
      if (bp != null) {
        const equalCheaper = list.filter(item => item.score === currentScore && item.price != null && item.price < bp);
        if (equalCheaper.length > 0) {
          equalCheaper.sort((a,b) => a.price - b.price);
          better = equalCheaper;
          console.log('Equal-score cheaper found:', better.map(i => i.asin));
        }
      }
    }

    // 3) If still none, eco-keyword fallback
    if (better.length === 0) {
      const ecoCandidates = list.filter(item => {
        const lower = item.title.toLowerCase();
        return /\borganic\b/.test(lower) || /\brecycled\b/.test(lower) || /\bsustainable\b/.test(lower);
      });
      if (ecoCandidates.length > 0) {
        console.log('Eco-keyword fallback found:', ecoCandidates.map(i => i.asin));
        better = ecoCandidates;
      }
    }

    // Sort by score desc then price asc
    better.sort((a,b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.price != null && b.price != null) return a.price - b.price;
      return 0;
    });
    console.log('Returning alternatives count:', better.length);
    sendResponse({ alternatives: better });
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