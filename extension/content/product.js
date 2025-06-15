// extension/content/product.js

// 1. Helper: infer keyword from title (if you need elsewhere)
function inferKeywordFromTitle() {
  const titleEl = document.querySelector('#productTitle');
  if (!titleEl) return null;
  const title = titleEl.innerText.trim().toLowerCase();
  const categories = ['t-shirt','t shirt','jeans','charger','coffee mug','mug','water bottle','bottle','sneaker','shoe'];
  for (let kw of categories) {
    if (title.includes(kw)) {
      return kw.replace(' ', '+');
    }
  }
  const words = title.split(/\s+/).slice(0,2).join('+');
  return words.toLowerCase();
}

// 2. Helper: parse price text to number
function parsePriceText(text) {
  if (!text) return null;
  const cleaned = text.replace(/₹|,|\s/g,'');
  const parts = cleaned.split('–');
  const num = parseFloat(parts[0]);
  return isNaN(num) ? null : num;
}

// 3. Helper: get price range ±20%
function getPriceRangeFromPage(defaultPct = 0.2) {
  const priceEl = document.querySelector('#priceblock_ourprice, #priceblock_dealprice');
  if (priceEl) {
    const raw = priceEl.innerText;
    const num = parsePriceText(raw);
    if (num != null && !isNaN(num)) {
      const delta = num * defaultPct;
      return { min: Math.max(1, num - delta), max: num + delta };
    }
  }
  return null;
}

// 4. Helper: simple keyword-based sustainability score (used offline; content script just displays)
function computeKeywordScore(text = '') {
  const lower = text.toLowerCase();
  if (/\borganic\b/.test(lower)) return 100;
  if (/\bcertified organic\b|\bGOTS\b/.test(lower)) return 100;
  if (/\brecycled\b|\bsustainable\b|\beco-friendly\b|\beco friendly\b/.test(lower)) return 70;
  return 50;
}

// 5. Helper: build Amazon search URL (unused here; background handles alternatives)
function buildSearchUrl(keywordWithPlus, priceRange) {
  const encoded = encodeURIComponent(keywordWithPlus);
  const minPaise = Math.round(priceRange.min * 100);
  const maxPaise = Math.round(priceRange.max * 100);
  return `https://www.amazon.in/s?k=${encoded}&rh=p_36:${minPaise}-${maxPaise}`;
}

// 6. Helper: scrape search results via hidden iframe (unused if background returns precomputed data)
function scrapeAmazonSearch(searchUrl, requireOrganicKeyword, timeoutMs = 10000) {
  return new Promise((resolve, reject) => {
    console.log('[scrapeAmazonSearch] loading URL:', searchUrl);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = searchUrl;
    document.body.appendChild(iframe);

    let finished = false;
    const cleanup = () => {
      if (iframe && iframe.parentNode) iframe.parentNode.removeChild(iframe);
    };

    const timer = setTimeout(() => {
      if (!finished) {
        finished = true;
        cleanup();
        reject(new Error('Timeout loading search iframe'));
      }
    }, timeoutMs);

    iframe.onload = () => {
      const doc = iframe.contentDocument;
      const start = Date.now();
      const poll = () => {
        const itemsDivs = doc.querySelectorAll('div[data-asin]');
        if (itemsDivs.length > 0 || Date.now() - start > timeoutMs) {
          const results = [];
          itemsDivs.forEach(div => {
            const asin = div.getAttribute('data-asin');
            if (!asin) return;
            const titleEl = div.querySelector('span.a-size-medium.a-color-base.a-text-normal');
            const title = titleEl ? titleEl.innerText.trim() : '';
            if (!title) return;
            let price = null;
            const priceWhole = div.querySelector('span.a-price-whole');
            const priceFrac = div.querySelector('span.a-price-fraction');
            if (priceWhole) {
              const whole = priceWhole.innerText.replace(/[,₹\s]/g,'');
              const frac = priceFrac ? priceFrac.innerText.replace(/[,₹\s]/g,'') : '00';
              const num = parseFloat(whole + '.' + frac);
              if (!isNaN(num)) price = num;
            }
            const imgEl = div.querySelector('img.s-image');
            const imageUrl = imgEl ? imgEl.src : '';
            if (requireOrganicKeyword) {
              if (!title.toLowerCase().includes('organic')) return;
            }
            results.push({ asin, title, price, imgUrl: imageUrl });
          });
          finished = true;
          clearTimeout(timer);
          cleanup();
          console.log('[scrapeAmazonSearch] found items:', results.length);
          resolve(results);
        } else {
          setTimeout(poll, 500);
        }
      };
      poll();
    };
    // If onload never fires, timeout handles it.
  });
}

// 7. Insert “Show greener alternatives” button
function insertGreenerButton() {
  let target = document.querySelector('#titleSection') || document.querySelector('#title');
  if (!target) {
    const titleEl = document.querySelector('#productTitle');
    if (titleEl) target = titleEl.parentElement;
  }
  if (!target || document.getElementById('greener-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'greener-btn';
  btn.innerText = 'Show greener alternatives';
  Object.assign(btn.style, {
    marginLeft: '10px', padding: '6px 12px',
    backgroundColor: '#4CAF50', color: '#fff',
    border: 'none', borderRadius: '4px', cursor: 'pointer'
  });
  btn.onclick = onGreenerClick;
  target.appendChild(btn);
}

// 8. Click handler with background messaging, now including basePrice
async function onGreenerClick() {
  if (document.getElementById('greener-panel')) return;

  const titleEl = document.querySelector('#productTitle');
  if (!titleEl) {
    alert('Cannot detect product title.');
    return;
  }
  const titleText = titleEl.innerText.trim();

  // Determine priceRange
  let priceRange = getPriceRangeFromPage();
  if (!priceRange) {
    const inp = prompt('Enter desired price range (min-max), e.g., 200-500:');
    if (!inp) return;
    const parts = inp.split('-').map(s => parseFloat(s.trim()));
    if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      priceRange = { min: parts[0], max: parts[1] };
    } else {
      alert('Invalid range.');
      return;
    }
  }

  // Extract basePrice if available
  const priceEl = document.querySelector('#priceblock_ourprice, #priceblock_dealprice');
  const basePrice = priceEl
    ? parsePriceText(priceEl.innerText) || null
    : null;

  console.log('[onGreenerClick] title:', titleText, 'priceRange:', priceRange, 'basePrice:', basePrice);

  // Send to background
  chrome.runtime.sendMessage(
    { type: 'GET_ALTERNATIVES', payload: { title: titleText, priceRange, basePrice } },
    resp => {
      if (!resp) {
        console.error('No response for GET_ALTERNATIVES');
        alert('Error retrieving alternatives.');
        return;
      }
      if (resp.error) {
        alert(resp.error);
        return;
      }
      const list = resp.alternatives || [];
      if (list.length === 0) {
        alert('No greener alternatives found.');
      } else {
        displayRecommendations(list);
      }
    }
  );
}

// 9. Display panel
function displayRecommendations(items) {
  const old = document.getElementById('greener-panel');
  if (old) old.remove();
  const panel = document.createElement('div');
  panel.id = 'greener-panel';
  Object.assign(panel.style, {
    position: 'fixed', top: '10%', right: '10%',
    width: '350px', maxHeight: '80%', overflowY: 'auto',
    backgroundColor: '#fff', border: '1px solid #ccc',
    padding: '10px', zIndex: 10000, boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
  });
  const closeBtn = document.createElement('button');
  closeBtn.innerText = '×';
  Object.assign(closeBtn.style, {
    float: 'right', border: 'none', background: 'transparent',
    fontSize: '16px', cursor: 'pointer'
  });
  closeBtn.onclick = () => panel.remove();
  panel.appendChild(closeBtn);

  const header = document.createElement('h3');
  header.innerText = 'Greener Alternatives';
  header.style.marginTop = '0';
  panel.appendChild(header);

  items.forEach(item => {
    const div = document.createElement('div');
    div.style.marginBottom = '12px';

    const img = document.createElement('img');
    img.src = item.imgUrl;
    Object.assign(img.style, {
      width: '50px', height: '50px', objectFit: 'cover',
      marginRight: '8px', verticalAlign: 'middle'
    });

    const link = document.createElement('a');
    link.href = `https://www.amazon.in/dp/${item.asin}`;
    link.target = '_blank';
    link.innerText = item.title;
    link.style.fontSize = '12px';

    const priceDiv = document.createElement('div');
    priceDiv.innerText = item.price != null ? `₹${item.price}` : '';
    priceDiv.style.fontSize = '12px';

    const scoreDiv = document.createElement('div');
    scoreDiv.innerText = `Score: ${item.score}`;
    scoreDiv.style.fontSize = '12px';

    div.append(img, link, priceDiv, scoreDiv);
    panel.appendChild(div);
  });

  document.body.appendChild(panel);
}

// Initialize on page load
window.addEventListener('load', insertGreenerButton);
