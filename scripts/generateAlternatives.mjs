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
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  const html = await res.text();
  const dom = new JSDOM(html, { virtualConsole });
  const items = Array.from(
    dom.window.document.querySelectorAll('.s-result-item[data-asin]')
  ).slice(0, 10);

  const results = [];
  for (const el of items) {
    const asin = el.getAttribute('data-asin');
    if (!asin) continue;
    const title = el.querySelector('h2')?.textContent.trim() || '';
    const priceStr = el.querySelector('.a-price-whole')?.textContent.replace(/[,$]/g, '') || '0';
    const price = parseFloat(priceStr);
    const ratingStr = el.querySelector('.a-icon-alt')
      ?.textContent.match(/([0-5]\.?\d?) out of 5/)?.[1] || '0';
    const rating = parseFloat(ratingStr);
    const reviewCountStr = el.querySelector('[aria-label$=" ratings"]')
      ?.getAttribute('aria-label')?.replace(/[^0-9]/g, '') || '0';
    const reviewCount = parseInt(reviewCountStr, 10);

    const detailRes = await fetch(`https://www.amazon.in/dp/${asin}`, {
      headers: { 'User-Agent': 'Mozilla/5.0' }
    });
    const detailHtml = await detailRes.text();
    const detailDom = new JSDOM(detailHtml, { virtualConsole });
    const bullets = Array.from(
      detailDom.window.document.querySelectorAll('#feature-bullets li')
    ).map(li => li.textContent.trim()).join(' ');
    const desc = detailDom.window.document.querySelector('#productDescription')
      ?.textContent.trim() || '';
    const detailsTable = Array.from(
      detailDom.window.document.querySelectorAll('#productDetails_techSpec_section_1 tr')
    ).map(tr => tr.textContent.replace(/\s+/g, ' ').trim()).join(' ');
    const allText = [title, bullets, desc, detailsTable].join(' ');

    results.push({ categoryKey, asin, title, price, rating, reviewCount, allText });
  }
  return results;
}

(async () => {
  const allProducts = [];
  for (const key of Object.keys(categoryData)) {
    const query = key.replace(/_/g, ' ');
    const items = await scrapeSearch(key, query);
    allProducts.push(...items);
  }

  if (allProducts.length === 0) {
    console.warn('⚠️ No products scraped; check selectors or network');
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
    const { maxCO2, maxWater, maxWaste } = categoryData[p.categoryKey];
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
      score: finalScore
    };
  });

  const outPath = path.resolve(__dirname, '../extension/data/alternatives.json');
  fs.writeFileSync(outPath, JSON.stringify(alternatives, null, 2), 'utf-8');
  console.log(`✅ Written ${alternatives.length} items to alternatives.json`);
})();
