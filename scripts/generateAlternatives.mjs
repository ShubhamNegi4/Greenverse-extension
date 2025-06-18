// File: scripts/generateAlternatives.mjs
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM, VirtualConsole } from 'jsdom';
import { fileURLToPath } from 'url';

const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', () => {});

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load category data
const categoryJsonPath = path.resolve(__dirname, '../extension/data/categories.json');
const categoryData = JSON.parse(
  fs.readFileSync(categoryJsonPath, 'utf-8')
);

// Import scoring functions
import {
  computeFootprintScore,
  computeKeywordScore,
  computeRatingScore,
  computeReviewCountScore,
  computePriceScore,
  computeFinalScore,
  estimateCarbonFootprint,
  computeDurabilityScore
} from '../backend/scoring.js';

// Category-specific price ranges (INR)
const CATEGORY_PRICE_RANGES = {
  tshirt: { min: 200, max: 2000 },
  jeans: { min: 800, max: 5000 },
  plastic_bottle: { min: 100, max: 1500 },
  phone_charger: { min: 200, max: 2500 },
  coffee_mug: { min: 150, max: 2000 },
  sneakers: { min: 1000, max: 8000 }
};

// Sorting methods
const SORT_METHODS = [
  { param: 'best-sellers', name: 'Best Sellers' },
  { param: 'review-rank', name: 'Average Customer Review' },
  { param: 'date-desc-rank', name: 'Newest Arrivals' }
];

async function scrapeSearch(categoryKey, query, sortMethod) {
  const priceRange = CATEGORY_PRICE_RANGES[categoryKey] || { min: 100, max: 5000 };
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}` + 
              `&s=${sortMethod}` + 
              `&rh=p_36%3A${priceRange.min}00-${priceRange.max}00`;
  
  const res = await fetch(url, { 
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    } 
  });
  
  const html = await res.text();
  const dom = new JSDOM(html, { virtualConsole });
  
  // Extract all product containers
  const items = Array.from(
    dom.window.document.querySelectorAll('.s-result-item[data-asin]')
  ).filter(el => {
    // Filter out sponsored ads and non-product items
    const isSponsored = el.querySelector('.s-sponsored-label-text') !== null;
    return !isSponsored && el.getAttribute('data-asin') !== '';
  });
  
  return items;
}

async function processProduct(el, categoryKey) {
  const asin = el.getAttribute('data-asin');
  if (!asin) return null;
  
  // Title
  const title = el.querySelector('h2')?.textContent.trim() || '';
  
  // Price
  const priceWhole = el.querySelector('.a-price-whole')?.textContent.replace(/[^\d.]/g, '') || '0';
  const priceFraction = el.querySelector('.a-price-fraction')?.textContent || '00';
  const price = parseFloat(`${priceWhole}.${priceFraction}`);
  
  // Rating
  const ratingStr = el.querySelector('.a-icon-alt')?.textContent || '';
  const ratingMatch = ratingStr.match(/([0-5]\.?\d?) out of 5/);
  const rating = ratingMatch ? parseFloat(ratingMatch[1]) : 0;
  
  // Review Count
  const reviewCountStr = el.querySelector('[aria-label$=" ratings"]')?.getAttribute('aria-label') || 
                        el.querySelector('.a-size-base')?.textContent || '0';
  const reviewCount = parseInt(reviewCountStr.replace(/[^0-9]/g, ''), 10) || 0;
  
  // Image URL
  const imgElement = el.querySelector('.s-image');
  let imgUrl = imgElement ? imgElement.src : '';
  
  // Handle image placeholders
  if (imgUrl.includes('data:image') || imgUrl.includes('placeholder')) {
    imgUrl = '';
  }
  
  // Fetch product details page for more text content
  let allText = title;
  try {
    const detailRes = await fetch(`https://www.amazon.in/dp/${asin}`, {
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9'
      }
    });
    const detailHtml = await detailRes.text();
    const detailDom = new JSDOM(detailHtml, { virtualConsole });
    
    // Feature bullets
    const bullets = Array.from(
      detailDom.window.document.querySelectorAll('#feature-bullets li, .product-facts li')
    ).map(li => li.textContent.trim()).join(' ');
    
    // Product description
    const desc = detailDom.window.document.querySelector('#productDescription')?.textContent.trim() || 
               detailDom.window.document.querySelector('#productDescription_feature_div')?.textContent.trim() || 
               '';
    
    // Technical details
    const detailsTable = Array.from(
      detailDom.window.document.querySelectorAll('#productDetails_techSpec_section_1 tr, .techD, #productDetails_detailBullets_sections1 tr')
    ).map(tr => tr.textContent.replace(/\s+/g, ' ').trim()).join(' ');
    
    // Brand information
    const brandEl = detailDom.window.document.querySelector('#bylineInfo') || 
                   detailDom.window.document.querySelector('#brand') ||
                   detailDom.window.document.querySelector('.a-link-normal[href*="/brand/"]');
    const brand = brandEl?.textContent.trim() || '';
    
    // Country of origin
    let country = '';
    const originRow = Array.from(detailDom.window.document.querySelectorAll('tr')).find(
      tr => tr.textContent.includes('Country of Origin')
    );
    if (originRow) {
      country = originRow.querySelector('td')?.textContent.trim() || '';
    }
    
    allText = [title, brand, bullets, desc, detailsTable, country].join(' ');
  } catch (e) {
    console.error(`Error fetching details for ASIN ${asin}:`, e.message);
  }
  
  // Estimate carbon footprint using category
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

async function scrapeCategory(categoryKey, query) {
  const uniqueProducts = new Map();
  let totalProducts = 0;
  
  for (const sortMethod of SORT_METHODS) {
    try {
      console.log(`Scraping ${categoryKey} with sort: ${sortMethod.name}`);
      const items = await scrapeSearch(categoryKey, query, sortMethod.param);
      
      // Process first 20 items from each sort method
      for (let i = 0; i < Math.min(items.length, 20); i++) {
        const product = await processProduct(items[i], categoryKey);
        if (product && !uniqueProducts.has(product.asin)) {
          uniqueProducts.set(product.asin, product);
          totalProducts++;
          
          // Stop when we have 60+ products
          if (totalProducts >= 60) break;
        }
      }
      
      if (totalProducts >= 60) break;
    } catch (e) {
      console.error(`Error scraping ${categoryKey} with sort ${sortMethod.name}:`, e.message);
    }
  }
  
  return Array.from(uniqueProducts.values());
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

(async () => {
  const allProducts = [];
  
  // Define search queries for each category
  const categoryQueries = {
    tshirt: "organic cotton t-shirt",
    jeans: "sustainable jeans",
    plastic_bottle: "eco-friendly water bottle",
    phone_charger: "energy efficient charger",
    coffee_mug: "sustainable coffee mug",
    sneakers: "eco-friendly sneakers"
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
  }

  if (allProducts.length === 0) {
    console.error('⚠️ No products scraped; check selectors or network');
    process.exit(1);
  }
  
  // Remove color variants
  const dedupedProducts = deduplicateProducts(allProducts);
  console.log(`Total unique products after deduplication: ${dedupedProducts.length}`);

  // Compute price bounds per category
  const priceBounds = {};
  dedupedProducts.forEach(p => {
    const bounds = priceBounds[p.categoryKey] ||= { min: Infinity, max: 0 };
    bounds.min = Math.min(bounds.min, p.price);
    bounds.max = Math.max(bounds.max, p.price);
  });

  // Score each product
  const alternatives = dedupedProducts.map(p => {
    const category = categoryData[p.categoryKey];
    if (!category) {
      console.warn(`No category data for ${p.categoryKey}, skipping ${p.asin}`);
      return null;
    }
    
    const { maxCO2, maxWater, maxWaste } = category;
    
    // Calculate scores
    const carbonScore = Math.round(100 * (1 - (p.carbon / maxCO2)));
    const keywordsScore = computeKeywordScore(p.allText);
    const ratingScore = computeRatingScore(p.rating);
    const reviewsScore = computeReviewCountScore(p.reviewCount);
    const { min, max } = priceBounds[p.categoryKey];
    const priceScore = computePriceScore(p.price, min, max);
    const durabilityScore = computeDurabilityScore(p.allText);
    
    const finalScore = computeFinalScore({
      carbon: carbonScore,
      keywords: keywordsScore,
      rating: ratingScore,
      reviews: reviewsScore,
      price: priceScore,
      durability: durabilityScore
    });

    return {
      asin: p.asin,
      category: p.categoryKey,
      title: p.title,
      score: finalScore,
      imgUrl: p.imgUrl,
      carbon: p.carbon,
      price: p.price
    };
  }).filter(Boolean);

  const outPath = path.resolve(__dirname, '../extension/data/alternatives.json');
  fs.writeFileSync(outPath, JSON.stringify(alternatives, null, 2), 'utf-8');
  console.log(`\n✅ Written ${alternatives.length} unique items to alternatives.json`);
})();