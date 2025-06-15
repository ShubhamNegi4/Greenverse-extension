export async function loadAllData() {
  const [categories, skuOverrides, bundles, alternatives] = await Promise.all([
    loadJSON('categories.json'),
    loadJSON('sku_footprints.json'),
    loadJSON('bundles.json'),
    loadJSON('alternatives.json'),
  ]);
  return { categories, skuOverrides, bundles, alternatives };
}
