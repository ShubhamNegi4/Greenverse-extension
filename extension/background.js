async function loadJSON(name) {
  const url = chrome.runtime.getURL(`data/${name}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to load ${name}`);
  return res.json();
}

let DATA = { alternatives: [] };

chrome.runtime.onInstalled.addListener(loadAllData);
loadAllData();

async function loadAllData() {
  try {
    DATA.alternatives = await loadJSON('alternatives.json');
    console.log('Background: loaded alternatives.json with', DATA.alternatives.length, 'items');
  } catch (err) {
    console.error('Background: failed to load alternatives.json', err);
  }
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
    const { title, category, priceRange, basePrice } = payload;
    
    // Filter by category
    let categoryAlts = DATA.alternatives.filter(a => a.category === category);
    
    if (categoryAlts.length === 0) {
      sendResponse({ alternatives: [] });
      return true;
    }
    
    // Filter by price range if provided
    if (priceRange) {
      categoryAlts = categoryAlts.filter(item => 
        item.price >= priceRange.min && item.price <= priceRange.max
      );
    }
    
    // Sort by sustainability score, then rating, then review count
    categoryAlts.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.rating !== a.rating) return b.rating - a.rating;
      return b.reviewCount - a.reviewCount;
    });
    
    // Return top 5
    sendResponse({ alternatives: categoryAlts.slice(0, 5) });
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