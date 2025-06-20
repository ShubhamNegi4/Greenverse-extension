import {
  computeKeywordScore,
  computeRatingScore,
  computeReviewCountScore,
  computeDurabilityScore,
  computeFinalScore,
  estimateCarbonFootprint,
  getCategoryMaxValues,
  computePriceAppropriatenessScore
} from '../../backend/scoring.js';

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

const CATEGORY_MAP = {
  "t-shirt": "tshirt", "t shirt": "tshirt", "tee": "tshirt", "tshirt": "tshirt", "top": "tshirt",
  "jeans": "jeans", "pants": "jeans", "denim": "jeans", "trousers": "jeans", 
  "charger": "phone_charger", "adapter": "phone_charger", "power adapter": "phone_charger", "wall charger": "phone_charger",
  "coffee mug": "coffee_mug", "mug": "coffee_mug", "cup": "coffee_mug", "travel mug": "coffee_mug", 
  "water bottle": "plastic_bottle", "bottle": "plastic_bottle", "flask": "plastic_bottle", "hydration": "plastic_bottle", 
  "sneaker": "sneakers", "shoe": "sneakers", "footwear": "sneakers", "trainers": "sneakers", "athletic": "sneakers"
};

function insertGreenerButton() {
  const titleEl = document.querySelector('#productTitle') || 
                 document.querySelector('#title');
  
  if (!titleEl || document.getElementById('greener-btn')) return;
  
  const btn = document.createElement('button');
  btn.id = 'greener-btn';
  btn.innerText = '🌱 Greener Alternatives';
  Object.assign(btn.style, {
    marginLeft: '15px', padding: '8px 15px',
    backgroundColor: '#2E7D32', color: '#fff',
    border: 'none', borderRadius: '6px', cursor: 'pointer',
    fontSize: '14px', fontWeight: 'bold',
    boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
    transition: 'all 0.3s'
  });
  
  btn.onmouseover = () => {
    btn.style.backgroundColor = '#1B5E20';
    btn.style.transform = 'translateY(-2px)';
    btn.style.boxShadow = '0 4px 8px rgba(0,0,0,0.3)';
  };
  
  btn.onmouseout = () => {
    btn.style.backgroundColor = '#2E7D32';
    btn.style.transform = 'translateY(0)';
    btn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.2)';
  };
  
  btn.onclick = onGreenerClick;
  
  titleEl.parentElement.appendChild(btn);
}

function deduplicateProducts(products) {
  const seen = new Map();
  const uniqueProducts = [];
  
  products.forEach(product => {
    const baseName = product.title
      .replace(/\([^)]*\)/g, '')
      .replace(/\b(black|blue|beige|orange|white|red|green|small|medium|large|xl|xxl)\b/gi, '')
      .replace(/\s\s+/g, ' ')
      .trim()
      .toLowerCase();
    
    if (!seen.has(baseName)) {
      seen.set(baseName, true);
      uniqueProducts.push(product);
    }
  });
  
  return uniqueProducts;
}

async function onGreenerClick() {
  if (document.getElementById('greener-panel')) return;

  const btn = document.getElementById('greener-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '🌿 Finding Alternatives...';
  }

  try {
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
    
    const bullets = Array.from(document.querySelectorAll('#feature-bullets li'))
                       .map(li => li.textContent.trim()).join(' ');
    const desc = getText('#productDescription');
    const allText = [rawTitle, bullets, desc].join(' ');

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

    const currentCarbon = estimateCarbonFootprint(allText, categoryKey);
    const maxVals = getCategoryMaxValues(categoryKey);
    
    const kScore = computeKeywordScore(allText);
    const rScore = computeRatingScore(rating);
    const vScore = computeReviewCountScore(reviewCount);
    const dScore = computeDurabilityScore(allText);
    
    // Calculate current product's sustainability score
    const pageScore = computeFinalScore(
      {
        carbon: currentCarbon,
        keywords: kScore,
        rating: rScore,
        reviews: vScore,
        price: basePrice,
        durability: dScore
      },
      categoryKey,
      basePrice
    );

    // Load alternatives
    let alts;
    try {
      const response = await fetch(chrome.runtime.getURL('data/alternatives.json'));
      alts = await response.json();
    } catch (e) {
      console.error(e);
      return alert('Failed to load alternatives.');
    }

    const categoryAlts = alts.filter(a => a.category === categoryKey);
    
    if (categoryAlts.length === 0) {
      return alert('No alternatives found for this category.');
    }

    // Sort by score descending
    categoryAlts.sort((a, b) => b.score - a.score);
    const dedupedRecommendations = deduplicateProducts(categoryAlts);
    const topRecommendations = dedupedRecommendations.slice(0, 5);
    
    displayRecommendations(topRecommendations, pageScore, currentCarbon, rating, reviewCount, basePrice);
  } catch (error) {
    console.error('Error:', error);
    alert('An error occurred. Please try again.');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🌱 Greener Alternatives';
    }
  }
}

function displayRecommendations(items, currentScore, currentCarbon, currentRating, currentReviewCount, currentPrice) {
  const existingPanel = document.getElementById('greener-panel');
  if (existingPanel) existingPanel.remove();
  
  if (items.length === 0) {
    return alert('No unique alternatives found after removing color variants');
  }
  
  const panel = document.createElement('div');
  panel.id = 'greener-panel';
  Object.assign(panel.style, {
    position: 'fixed', top: '20px', right: '20px',
    width: '500px', maxHeight: '85vh', overflowY: 'auto',
    backgroundColor: '#fff', border: '2px solid #4CAF50',
    padding: '25px', zIndex: 10000, boxShadow: '0 8px 30px rgba(0,0,0,0.2)',
    fontFamily: 'Arial, sans-serif', borderRadius: '12px',
    color: '#333'
  });

  const closeBtn = document.createElement('button');
  closeBtn.innerText = '×';
  closeBtn.style.cssText = `
    position: absolute; top: 15px; right: 20px;
    border: none; background: transparent;
    font-size: 28px; cursor: pointer; color: #666;
    line-height: 1;
    transition: color 0.3s;
  `;
  closeBtn.onmouseover = () => { closeBtn.style.color = '#f44336'; };
  closeBtn.onmouseout = () => { closeBtn.style.color = '#666'; };
  closeBtn.onclick = () => panel.remove();
  panel.appendChild(closeBtn);

  const header = document.createElement('h3');
  header.innerHTML = '🌿 <span style="color: #2E7D32;">Recommended Sustainable Alternatives</span>';
  header.style.margin = '0 0 20px 0';
  header.style.fontSize = '20px';
  header.style.fontWeight = 'bold';
  panel.appendChild(header);

  // Current product info
  const currentProductDiv = document.createElement('div');
  currentProductDiv.style.marginBottom = '25px';
  currentProductDiv.style.padding = '15px';
  currentProductDiv.style.backgroundColor = '#f8f9fa';
  currentProductDiv.style.borderRadius = '8px';
  currentProductDiv.style.borderLeft = '4px solid #4CAF50';
  
  currentProductDiv.innerHTML = `
    <div style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #2E7D32;">
      Current Product
    </div>
    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
      <div>
        <div style="font-weight: 600;">Sustainability Score:</div>
        <div style="font-size: 18px; font-weight: bold; color: #2E7D32;">${currentScore}/100</div>
      </div>
      <div>
        <div style="font-weight: 600;">Carbon Footprint:</div>
        <div style="font-size: 18px; font-weight: bold;">${currentCarbon.toFixed(2)} kg CO₂e</div>
      </div>
      <div>
        <div style="font-weight: 600;">Price:</div>
        <div style="font-size: 16px;">₹${currentPrice.toFixed(2)}</div>
      </div>
      <div>
        <div style="font-weight: 600;">Rating:</div>
        <div style="font-size: 16px;">
          ${'★'.repeat(Math.round(currentRating))}${'☆'.repeat(5 - Math.round(currentRating))}
          (${currentReviewCount} reviews)
        </div>
      </div>
    </div>
  `;
  panel.appendChild(currentProductDiv);

  const subtitle = document.createElement('div');
  subtitle.innerHTML = '<span style="font-weight: bold; font-size: 17px; color: #2E7D32;">Top Sustainable Alternatives:</span>';
  subtitle.style.marginBottom = '15px';
  panel.appendChild(subtitle);

  items.forEach(item => {
    const itemDiv = document.createElement('div');
    itemDiv.style.marginBottom = '20px';
    itemDiv.style.padding = '15px';
    itemDiv.style.border = '1px solid #e0e0e0';
    itemDiv.style.borderRadius = '8px';
    itemDiv.style.transition = 'all 0.3s';
    itemDiv.style.cursor = 'pointer';
    itemDiv.style.backgroundColor = '#fff';
    
    itemDiv.onmouseover = () => {
      itemDiv.style.boxShadow = '0 6px 12px rgba(0,0,0,0.1)';
      itemDiv.style.borderColor = '#4CAF50';
      itemDiv.style.transform = 'translateY(-3px)';
    };
    
    itemDiv.onmouseout = () => {
      itemDiv.style.boxShadow = 'none';
      itemDiv.style.borderColor = '#e0e0e0';
      itemDiv.style.transform = 'none';
    };

    // Product content grid
    const contentDiv = document.createElement('div');
    contentDiv.style.display = 'grid';
    contentDiv.style.gridTemplateColumns = '100px 1fr';
    contentDiv.style.gap = '15px';
    contentDiv.style.alignItems = 'start';
    
    // Product image
    const imgContainer = document.createElement('div');
    if (item.imgUrl) {
      const img = document.createElement('img');
      img.src = item.imgUrl;
      img.style.width = '100%';
      img.style.height = '100px';
      img.style.objectFit = 'cover';
      img.style.borderRadius = '6px';
      img.style.border = '1px solid #eee';
      imgContainer.appendChild(img);
    } else {
      imgContainer.innerHTML = '<div style="width:100px; height:100px; background:#f0f0f0; border-radius:6px; display:flex; align-items:center; justify-content:center; color:#999;">No Image</div>';
    }
    contentDiv.appendChild(imgContainer);
    
    // Product details
    const detailsDiv = document.createElement('div');
    
    // Title
    const title = document.createElement('div');
    title.textContent = item.title;
    title.style.fontWeight = 'bold';
    title.style.marginBottom = '8px';
    title.style.fontSize = '15px';
    title.style.color = '#1a73e8';
    detailsDiv.appendChild(title);
    
    // Sustainability score
    const score = document.createElement('div');
    score.innerHTML = `<span style="font-weight:600;">Sustainability:</span> 
                      <span style="font-weight:bold; color:${item.score > 70 ? '#4CAF50' : item.score > 50 ? '#FF9800' : '#F44336'};">${item.score}/100</span>`;
    score.style.marginBottom = '5px';
    score.style.fontSize = '14px';
    detailsDiv.appendChild(score);
    
    // Carbon footprint
    if (item.carbon) {
      const savings = currentCarbon - item.carbon;
      const absSavings = Math.abs(savings).toFixed(2);
      
      const carbon = document.createElement('div');
      carbon.innerHTML = `<span style="font-weight:600;">Carbon Footprint:</span> 
                         ${item.carbon.toFixed(2)} kg CO₂e
                         <span style="margin-left:10px; color:${savings > 0 ? '#4CAF50' : savings < 0 ? '#F44336' : '#000'}; font-weight:bold;">
                         ${savings > 0 ? '↓' : savings < 0 ? '↑' : ''} ${absSavings} kg</span>`;
      carbon.style.marginBottom = '5px';
      carbon.style.fontSize = '14px';
      detailsDiv.appendChild(carbon);
    }
    
    // Price comparison
    if (item.price) {
      const priceDiff = item.price - currentPrice;
      const priceDiffText = Math.abs(priceDiff).toFixed(2);
      
      const priceDiv = document.createElement('div');
      priceDiv.innerHTML = `<span style="font-weight:600;">Price:</span> 
                           ₹${item.price.toFixed(2)}
                           <span style="margin-left:10px; color:${priceDiff < 0 ? '#4CAF50' : priceDiff > 0 ? '#F44336' : '#000'};">
                           ${priceDiff < 0 ? '↓' : priceDiff > 0 ? '↑' : ''} ₹${priceDiffText}</span>`;
      priceDiv.style.marginBottom = '5px';
      priceDiv.style.fontSize = '14px';
      detailsDiv.appendChild(priceDiv);
    }
    
    // Rating
    if (item.rating) {
      const ratingDiv = document.createElement('div');
      ratingDiv.innerHTML = `<span style="font-weight:600;">Rating:</span> 
                            ${'★'.repeat(Math.round(item.rating))}${'☆'.repeat(5 - Math.round(item.rating))}
                            (${item.reviewCount} reviews)`;
      ratingDiv.style.marginBottom = '5px';
      ratingDiv.style.fontSize = '14px';
      detailsDiv.appendChild(ratingDiv);
    }
    
    contentDiv.appendChild(detailsDiv);
    itemDiv.appendChild(contentDiv);
    
    // View button
    const link = document.createElement('a');
    link.href = `https://www.amazon.in/dp/${item.asin}`;
    link.textContent = 'View on Amazon';
    link.target = '_blank';
    link.style.display = 'block';
    link.style.marginTop = '10px';
    link.style.padding = '8px 12px';
    link.style.backgroundColor = '#f0f8ff';
    link.style.color = '#0066c0';
    link.style.textAlign = 'center';
    link.style.borderRadius = '4px';
    link.style.textDecoration = 'none';
    link.style.fontWeight = '500';
    link.style.transition = 'all 0.2s';
    link.style.border = '1px solid #1a73e8';
    
    link.onmouseover = () => {
      link.style.backgroundColor = '#e1f0ff';
      link.style.transform = 'scale(1.02)';
    };
    
    link.onmouseout = () => {
      link.style.backgroundColor = '#f0f8ff';
      link.style.transform = 'none';
    };
    
    itemDiv.appendChild(link);
    
    itemDiv.onclick = (e) => {
      if (e.target.tagName !== 'A') {
        window.open(link.href, '_blank');
      }
    };
    
    panel.appendChild(itemDiv);
  });

  const footer = document.createElement('div');
  footer.style.marginTop = '20px';
  footer.style.paddingTop = '15px';
  footer.style.borderTop = '1px solid #eee';
  footer.style.textAlign = 'center';
  footer.style.fontSize = '12px';
  footer.style.color = '#777';
  footer.innerHTML = 'Powered by <span style="font-weight:bold; color:#2E7D32;">GreenVerse</span> Extension';
  panel.appendChild(footer);

  document.body.appendChild(panel);
  
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

function initExtension() {
  insertGreenerButton();
  
  setTimeout(() => {
    if (!document.getElementById('greener-btn')) {
      insertGreenerButton();
    }
  }, 3000);
}

window.addEventListener('load', initExtension);