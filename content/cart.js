console.log("🧪 cart.js is running");
alert("GreenVerse Extension is active on Cart page!");

(async function () {
  const existing = await new Promise(resolve => {
    chrome.storage.local.get('carbonProducts', data => {
      console.log("📦 Existing products in storage:", data);
      resolve(data.carbonProducts || []);
    });
  });

  const productElements = document.querySelectorAll('.sc-list-item');
  const newProducts = [];

  productElements.forEach(item => {
    const titleEl = item.querySelector('.a-truncate-cut')
    const priceEl = item.querySelector('.sc-apex-cart-price')
    const asinMatch = item.innerHTML.match(/\/dp\/([A-Z0-9]{10})/i);

    console.log("🔍 Title:", titleEl?.textContent);
    console.log("🔍 Price:", priceEl?.textContent);
    console.log("🔍 ASIN:", asinMatch?.[1]);

    if (!titleEl || !priceEl || !asinMatch) return;

    const title = titleEl.textContent.trim();
    const price = parseFloat(priceEl.textContent.replace(/[^\d.]/g, '')) || 0;
    const asin = asinMatch[1];

    const alreadyAdded = existing.some(p => p.asin === asin);
    if (alreadyAdded) return;

    const product = {
      title,
      price,
      asin,
      visited: true,
      sustainabilityScore: Math.floor(Math.random() * 41) + 60
    };

    newProducts.push(product);
  });

  const updated = [...existing, ...newProducts];

  if (newProducts.length > 0) {
    chrome.storage.local.set({ carbonProducts: updated }, () => {
      console.log(`✅ Stored ${updated.length} items in carbonProducts`);
      insertDownloadButton();
      showBanner(`✅ Stored ${newProducts.length} new item(s)`);
    });
  } else {
    console.warn("❗ No new products found.");
    insertDownloadButton();
    showBanner("ℹ️ No new items found or already stored");
  }

  function insertDownloadButton() {
    if (document.getElementById('greenverse-download-btn')) return;

    const btn = document.createElement('button');
    btn.id = 'greenverse-download-btn';
    btn.textContent = '📥 Download Sustainability Report';

    Object.assign(btn.style, {
      position: 'fixed',
      bottom: '20px',
      right: '20px',
      backgroundColor: '#4CAF50',
      color: '#fff',
      padding: '10px 15px',
      fontSize: '14px',
      border: 'none',
      borderRadius: '5px',
      cursor: 'pointer',
      zIndex: 9999
    });

    btn.onclick = () => {
      chrome.storage.local.get('carbonProducts', data => {
        const products = data.carbonProducts;
        
        if (!products || !Array.isArray(products) || products.length === 0) {
          alert("❗ No products found to download.");
          console.warn("❗ No valid data in storage:", products);
          return;
        }

        const jsonString = JSON.stringify(products, null, 2);
        const blob = new Blob([jsonString], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = 'sustainability_report.json';
        a.click();

        URL.revokeObjectURL(url);
        console.log("⬇️ Sustainability report downloaded:", products);
      });
    };

    document.body.appendChild(btn);
  }

  function showBanner(message) {
    const banner = document.createElement('div');
    banner.innerText = message;
    Object.assign(banner.style, {
      position: 'fixed',
      top: '20px',
      right: '20px',
      backgroundColor: '#4CAF50',
      color: '#fff',
      padding: '12px 18px',
      fontSize: '14px',
      fontWeight: 'bold',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
      zIndex: 9999
    });
    document.body.appendChild(banner);
    setTimeout(() => banner.remove(), 4000);
  }
})();
