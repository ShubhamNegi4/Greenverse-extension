import React, { useState } from 'react';
import Progress from './Progress';
import DashboardView from './DashboardView';
import ProductView from './ProductView';

export default function App() {
  const [isDashboard, setIsDashboard] = useState(true);

  return (
    <div style={{
  width: '300px',
  padding: '16px',
  boxSizing: 'border-box',
  fontFamily: 'Arial, sans-serif',
  background: '#000000',
  overflowY: 'auto'
}}>
  <h1 style={{ fontSize: '1.25rem', color: '#2E7D32' }}>GreenVerse</h1>
  <p style={{ color: '#ccc' }}>Sustainable shopping assistant</p>
  <hr style={{ borderColor: '#ccc' }} />

  <button onClick={() => setIsDashboard(prev => !prev)} style={{ marginBottom: '12px',background:'#008000' }}>
    {isDashboard ? 'Go to Product View' : 'Go to Dashboard'}
  </button>

  <div style={{ background: '#fff', padding: '12px', borderRadius: '8px' }}>
    {isDashboard ? <DashboardView /> : <ProductView />}
  </div>

  <div style={{ width: "100px", margin: "1rem auto" }}>
    <Progress />
  </div>

  {/* ✅ Always shown */}
  <h3 style={{ color: '#2E7D32', textAlign: 'center' }}>
    Thanks for prioritizing sustainability 🌍
  </h3>
</div>

  );
}
