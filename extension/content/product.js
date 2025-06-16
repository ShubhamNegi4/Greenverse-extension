// File: extension/content/product.js

// --- 1. Simplified Scoring Functions ---
const POS_TERMS = ["organic","certified organic","gots","recycled","sustainable","eco-friendly"];
const NEG_TERMS = ["polyester","pesticide","synthetic","chemical","toxic","harmful"];

function computeKeywordScore(text = "") {
  const lower = text.toLowerCase();
  let s = 50;
  POS_TERMS.forEach(t => lower.includes(t) && (s += 10));
  NEG_TERMS.forEach(t => lower.includes(t) && (s -= 15));
  return Math.max(0, Math.min(s, 100));
}

function computeRatingScore(r = 0) { 
  return Math.round((r/5)*100); 
}

function computeReviewCountScore(c = 0) {
  const lg = Math.min(Math.log10(c+1), 4);
  return Math.round((lg/4)*100);
}

function computeFinalScore(vals) {
  const {keywords, rating, reviews} = vals;
  return Math.round(keywords*0.4 + rating*0.3 + reviews*0.3);
}

// --- 2. Page Scraping Helpers ---
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

// --- 3. Category Mapping ---
const CATEGORY_MAP = {
  "t-shirt": "tshirt", "t shirt": "tshirt", "tee": "tshirt", 
  "jeans": "jeans", "pants": "jeans", 
  "charger": "phone_charger", "adapter": "phone_charger",
  "coffee mug": "coffee_mug", "mug": "coffee_mug", 
  "water bottle": "plastic_bottle", "bottle": "plastic_bottle", 
  "sneaker": "sneakers", "shoe": "sneakers", "footwear": "sneakers"
};

// --- 4. Insert Button ---
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

// --- 5. Main Click Handler ---
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

    // Calculate current product score
    const kScore = computeKeywordScore(allText);
    const rScore = computeRatingScore(rating);
    const vScore = computeReviewCountScore(reviewCount);
    const pageScore = computeFinalScore({
      keywords: kScore,
      rating: rScore,
      reviews: vScore
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
    
    // Always show top recommendations
    const topRecommendations = categoryAlts.slice(0, 5);
    
    // Display recommendations
    displayRecommendations(topRecommendations, pageScore);
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

// --- 6. Display Recommendations ---
function displayRecommendations(items, currentScore) {
  const existingPanel = document.getElementById('greener-panel');
  if (existingPanel) existingPanel.remove();
  
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
  scoreInfo.innerHTML = `Your current product score: <strong>${currentScore}/100</strong>`;
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