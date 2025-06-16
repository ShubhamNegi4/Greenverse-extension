// File: scripts/generateAlternatives.mjs
import fs from 'fs';
import path from 'path';
import fetch from 'node-fetch';
import { JSDOM, VirtualConsole } from 'jsdom';

// suppress CSS parsing errors from jsdom
const virtualConsole = new VirtualConsole();
virtualConsole.on('jsdomError', () => {});
import { fileURLToPath } from 'url';
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load category data
const categoryJsonPath = path.resolve(__dirname, '../extension/data/categories.json');
const categoryData = JSON.parse(
  fs.readFileSync(categoryJsonPath, 'utf-8')
);

import {
  computeFootprintScore,
  computeKeywordScore,
  computeRatingScore,
  computeReviewCountScore,
  computePriceScore,
  computeFinalScore
} from '../backend/scoring.js';

async function scrapeSearch(categoryKey, query) {
  const url = `https://www.amazon.in/s?k=${encodeURIComponent(query)}`;
  const res = await fetch(url, { 
    headers: { 
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9'
    } 
  });
  const html = await res.text();
  const dom = new JSDOM(html, { virtualConsole });
  const items = Array.from(
    dom.window.document.querySelectorAll('.s-result-item[data-asin]')
  ).slice(0, 15); // Increase to get more results

  const results = [];
  for (const el of items) {
    const asin = el.getAttribute('data-asin');
    if (!asin) continue;
    
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
      
      allText = [title, bullets, desc, detailsTable].join(' ');
    } catch (e) {
      console.error(`Error fetching details for ASIN ${asin}:`, e.message);
    }
    
    results.push({ 
      categoryKey, 
      asin, 
      title, 
      price, 
      rating, 
      reviewCount, 
      allText,
      imgUrl
    });
  }
  return results;
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
    console.log(`Scraping category: ${key} with query: ${query}`);
    try {
      const items = await scrapeSearch(key, query);
      allProducts.push(...items);
      console.log(`Found ${items.length} products for ${key}`);
    } catch (e) {
      console.error(`Error scraping ${key}:`, e.message);
    }
  }

  if (allProducts.length === 0) {
    console.warn('⚠️ No products scraped; check selectors or network');
    process.exit(1);
  }

  // Compute price bounds per category
  const priceBounds = {};
  allProducts.forEach(p => {
    const bounds = priceBounds[p.categoryKey] ||= { min: Infinity, max: 0 };
    bounds.min = Math.min(bounds.min, p.price);
    bounds.max = Math.max(bounds.max, p.price);
  });

  // Score each product
  const alternatives = allProducts.map(p => {
    const category = categoryData[p.categoryKey];
    if (!category) {
      console.warn(`No category data for ${p.categoryKey}, skipping ${p.asin}`);
      return null;
    }
    
    const { maxCO2, maxWater, maxWaste } = category;
    const footprint = computeFootprintScore(
      { co2: maxCO2, water: maxWater, waste: maxWaste },
      { maxCO2, maxWater, maxWaste }
    );
    const keywordsScore = computeKeywordScore(p.allText);
    const ratingScore = computeRatingScore(p.rating);
    const reviewsScore = computeReviewCountScore(p.reviewCount);
    const { min, max } = priceBounds[p.categoryKey];
    const priceScore = computePriceScore(p.price, min, max);
    const finalScore = computeFinalScore({
      footprint,
      keywords: keywordsScore,
      rating: ratingScore,
      reviews: reviewsScore,
      price: priceScore
    });

    return {
      asin: p.asin,
      category: p.categoryKey,
      title: p.title,
      score: finalScore,
      imgUrl: p.imgUrl
    };
  }).filter(Boolean); // Remove null items

  const outPath = path.resolve(__dirname, '../extension/data/alternatives.json');
  fs.writeFileSync(outPath, JSON.stringify(alternatives, null, 2), 'utf-8');
  console.log(`✅ Written ${alternatives.length} items to alternatives.json`);
})();