import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM, VirtualConsole } from 'jsdom';
import { fileURLToPath } from 'url';
import {
  computeKeywordScore,
  computeRatingScore,
  computeReviewCountScore,
  computePriceScore,
  computeDurabilityScore,
  computeFinalScore,
  estimateCarbonFootprint,
  getCategoryMaxValues
} from '../backend/scoring.js';

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', () => {});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const CATEGORY_PRICE_RANGES = {
  tshirt: { min: 200, max: 2000 },
  jeans: { min: 800, max: 5000 },
  plastic_bottle: { min: 100, max: 1500 },
  phone_charger: { min: 200, max: 2500 },
  coffee_mug: { min: 150, max: 2000 },
  sneakers: { min: 1000, max: 8000 }
};

const SORT_METHODS = [
  { param: 'review-rank', name: 'Average Customer Review' },
  { param: 'popularity-rank', name: 'Popularity' },
  { param: 'date-desc-rank', name: 'Newest Arrivals' }
];

// User agents to rotate to avoid blocking
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.1 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0'
];

// Get random user agent
function getRandomUserAgent() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// Enhanced scraping function with pagination
async function scrapeSearch(categoryKey, query, sortMethod, page = 1) {
  const priceRange = CATEGORY_PRICE_RANGES[categoryKey] || { min: 100, max: 5000 };
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}` + 
              `&s=${sortMethod}` + 
              `&rh=p_36%3A${priceRange.min}00-${priceRange.max}00` +
              `&page=${page}`;
  
  try {
    const res = await fetch(url, { 
      headers: { 
        'User-Agent': getRandomUserAgent(),
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Referer': 'https://www.amazon.in/'
      },
      timeout: 15000
    });
    
    if (!res.ok) {
      console.error(`Request failed: ${res.status} ${res.statusText}`);
      return [];
    }
    
    const html = await res.text();
    const dom = new JSDOM(html, { virtualConsole });
    
    const items = Array.from(
      dom.window.document.querySelectorAll('.s-result-item[data-asin]')
    ).filter(el => {
      const isSponsored = el.querySelector('.s-sponsored-label-text') !== null;
      const asin = el.getAttribute('data-asin');
      return !isSponsored && asin && asin.trim() !== '';
    });
    
    return items;
  } catch (e) {
    console.error(`Error fetching page ${page} for ${categoryKey}:`, e.message);
    return [];
  }
}

// Enhanced product processing with better error handling
async function processProduct(el, categoryKey) {
  const asin = el.getAttribute('data-asin');
  if (!asin) return null;
  
  const titleEl = el.querySelector('h2 a') || el.querySelector('h2');
  const title = titleEl?.textContent?.trim() || '';
  
  if (!title) return null;
  
  // Extract price
  let price = 0;
  try {
    const priceWhole = el.querySelector('.a-price-whole')?.textContent.replace(/[^\d.]/g, '') || '0';
    const priceFraction = el.querySelector('.a-price-fraction')?.textContent || '00';
    price = parseFloat(`${priceWhole}.${priceFraction}`);
  } catch (e) {
    console.error(`Price parse error for ${asin}:`, e.message);
  }
  
  // Extract rating
  let rating = 0;
  try {
    const ratingStr = el.querySelector('.a-icon-alt')?.textContent || '';
    const ratingMatch = ratingStr.match(/([0-5]\.?\d?) out of 5/);
    rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
  } catch (e) {
    console.error(`Rating parse error for ${asin}:`, e.message);
  }
  
  // Extract review count
  let reviewCount = 0;
  try {
    const reviewCountEl = el.querySelector('.a-size-base.s-underline-text') || 
                          el.querySelector('[aria-label*="ratings"]');
    const reviewCountStr = reviewCountEl?.textContent?.replace(/[^0-9]/g, '') || '0';
    reviewCount = parseInt(reviewCountStr, 10) || 0;
  } catch (e) {
    console.error(`Review count parse error for ${asin}:`, e.message);
  }
  
  // Extract image
  let imgUrl = '';
  try {
    const imgElement = el.querySelector('.s-image');
    imgUrl = imgElement ? imgElement.src : '';
    if (imgUrl.includes('data:image') || imgUrl.includes('placeholder')) {
      imgUrl = '';
    }
  } catch (e) {
    console.error(`Image extraction error for ${asin}:`, e.message);
  }
  
  let allText = title;
  try {
    const detailRes = await fetch(`https://www.amazon.in/dp/${asin}`, {
      headers: { 
        'User-Agent': getRandomUserAgent(),
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 20000
    });
    
    if (!detailRes.ok) {
      console.error(`Detail request failed for ASIN ${asin}: ${detailRes.status}`);
      return null;
    }
    
    const detailHtml = await detailRes.text();
    const detailDom = new JSDOM(detailHtml, { virtualConsole });
    
    // Extract product details
    const bullets = Array.from(
      detailDom.window.document.querySelectorAll('#feature-bullets li, .product-facts li')
    ).map(li => li.textContent.trim()).join(' ');
    
    const desc = detailDom.window.document.querySelector('#productDescription')?.textContent.trim() || 
               detailDom.window.document.querySelector('#productDescription_feature_div')?.textContent.trim() || 
               '';
    
    const detailsTable = Array.from(
      detailDom.window.document.querySelectorAll('#productDetails_techSpec_section_1 tr, .techD, #productDetails_detailBullets_sections1 tr')
    ).map(tr => tr.textContent.replace(/\s+/g, ' ').trim()).join(' ');
    
    const brandEl = detailDom.window.document.querySelector('#bylineInfo') || 
                   detailDom.window.document.querySelector('#brand') ||
                   detailDom.window.document.querySelector('.a-link-normal[href*="/brand/"]');
    const brand = brandEl?.textContent.trim() || '';
    
    let country = '';
    const originRow = Array.from(detailDom.window.document.querySelectorAll('tr')).find(
      tr => tr.textContent.includes('Country of Origin')
    );
    if (originRow) {
      country = originRow.querySelector('td')?.textContent.trim() || '';
    }
    
    allText = [title, brand, bullets, desc, detailsTable, country].join(' ');
  } catch (e) {
    console.error(`Detail extraction error for ASIN ${asin}:`, e.message);
  }
  
  const carbon = estimateCarbonFootprint(allText, categoryKey);
  
  return { 
    categoryKey, 
    asin, 
    title, 
    price, 
    rating, 
    reviewCount, 
    allText,
    imgUrl,
    carbon
  };
}

// Enhanced scraping with pagination and retries
async function scrapeCategory(categoryKey, query) {
  const uniqueProducts = new Map();
  const MAX_PAGES = 5;
  const PRODUCTS_PER_CATEGORY = 150;
  
  for (const sortMethod of SORT_METHODS) {
    let page = 1;
    let hasMorePages = true;
    
    while (hasMorePages && uniqueProducts.size < PRODUCTS_PER_CATEGORY) {
      try {
        console.log(`Scraping ${categoryKey} with sort: ${sortMethod.name}, page ${page}`);
        const items = await scrapeSearch(categoryKey, query, sortMethod.param, page);
        
        if (items.length === 0) {
          hasMorePages = false;
          continue;
        }
        
        for (let i = 0; i < items.length; i++) {
          if (uniqueProducts.size >= PRODUCTS_PER_CATEGORY) break;
          
          try {
            const product = await processProduct(items[i], categoryKey);
            if (product && !uniqueProducts.has(product.asin)) {
              uniqueProducts.set(product.asin, product);
              console.log(`Added product: ${product.title.substring(0, 40)}...`);
            }
          } catch (e) {
            console.error(`Product processing error:`, e.message);
          }
          
          // Add delay between product processing
          await new Promise(resolve => setTimeout(resolve, 500));
        }
        
        page++;
        if (page > MAX_PAGES) hasMorePages = false;
        
        // Add delay between pages
        await new Promise(resolve => setTimeout(resolve, 2000));
      } catch (e) {
        console.error(`Page ${page} error for ${categoryKey}:`, e.message);
        hasMorePages = false;
      }
    }
    
    if (uniqueProducts.size >= PRODUCTS_PER_CATEGORY) break;
  }
  
  return Array.from(uniqueProducts.values());
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

(async () => {
  const allProducts = [];
  
  const categoryQueries = {
    tshirt: "t-shirt",
    jeans: "jeans",
    plastic_bottle: "water bottle",
    phone_charger: "phone charger",
    coffee_mug: "coffee mug",
    sneakers: "sneakers"
  };
  
  for (const [key, query] of Object.entries(categoryQueries)) {
    console.log(`\n===== Scraping category: ${key} =====`);
    try {
      const items = await scrapeCategory(key, query);
      allProducts.push(...items);
      console.log(`Found ${items.length} products for ${key}`);
    } catch (e) {
      console.error(`Error scraping ${key}:`, e.message);
    }
    
    // Add delay between categories
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  if (allProducts.length === 0) {
    console.error('⚠️ No products scraped; check selectors or network');
    process.exit(1);
  }
  
  const dedupedProducts = deduplicateProducts(allProducts);
  console.log(`Total unique products after deduplication: ${dedupedProducts.length}`);

  const priceBounds = {};
  dedupedProducts.forEach(p => {
    const bounds = priceBounds[p.categoryKey] ||= { min: Infinity, max: 0 };
    bounds.min = Math.min(bounds.min, p.price);
    bounds.max = Math.max(bounds.max, p.price);
  });

  const alternatives = dedupedProducts.map(p => {
    const maxVals = getCategoryMaxValues(p.categoryKey);
    const { min, max } = priceBounds[p.categoryKey] || { min: 0, max: 0 };
    
    const keywordsScore = computeKeywordScore(p.allText);
    const ratingScore = computeRatingScore(p.rating);
    const reviewsScore = computeReviewCountScore(p.reviewCount);
    const priceScore = computePriceScore(p.price, min, max);
    const durabilityScore = computeDurabilityScore(p.allText);
    
    const finalScore = computeFinalScore(
      {
        carbon: p.carbon,
        keywords: keywordsScore,
        rating: ratingScore,
        reviews: reviewsScore,
        price: p.price,
        durability: durabilityScore
      },
      p.categoryKey,
      min // referencePrice is min price in the category for alternatives
    );

    return {
      asin: p.asin,
      category: p.categoryKey,
      title: p.title,
      score: finalScore,
      imgUrl: p.imgUrl,
      carbon: p.carbon,
      price: p.price,
      rating: p.rating,
      reviewCount: p.reviewCount,
      keywords: keywordsScore,
      durability: durabilityScore
    };
  }).filter(Boolean);

  const outPath = path.resolve(__dirname, '../extension/data/alternatives.json');
  fs.writeFileSync(outPath, JSON.stringify(alternatives, null, 2), 'utf-8');
  console.log(`\n✅ Written ${alternatives.length} unique items to alternatives.json`);
})();