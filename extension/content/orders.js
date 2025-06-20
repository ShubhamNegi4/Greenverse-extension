// content/orders.js

(async () => {
  const shippedSelector = '.a-box-group'; // Amazon uses this for each order block
  const orders = Array.from(document.querySelectorAll(shippedSelector));
  const unshipped = [];

  for (const order of orders) {
    const status = order.innerText.toLowerCase();
    if (status.includes("not yet shipped")) {
      const titleEl = order.querySelector('.a-col-right .a-row a');
      const title = titleEl?.innerText?.trim() || "Unknown Product";
      const productId = title.toLowerCase().replace(/\s+/g, '-');

      const sustainabilityScore = Math.floor(Math.random() * 40 + 60); // temporary random score
      unshipped.push({
        id: productId,
        title,
        sustainabilityScore,
        visited: false
      });
    }
  }

  // Deduplicate by ID
  const previous = JSON.parse(localStorage.getItem("unshippedProducts") || "[]");
  const merged = [...previous];

  for (const product of unshipped) {
    if (!merged.some(p => p.id === product.id)) {
      merged.push(product);
    } else {
      // Set visited to true for existing products
      const existing = merged.find(p => p.id === product.id);
      existing.visited = true;
    }
  }

  localStorage.setItem("unshippedProducts", JSON.stringify(merged, null, 2));

  // Optional: Download as file
  const blob = new Blob([JSON.stringify(merged, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = "yet_to_be_shipped.json";
  a.click();
  URL.revokeObjectURL(url);

  alert("✅ JSON file generated for unshipped orders!");
})();
