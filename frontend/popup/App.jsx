// App.jsx
import React, { useState, useEffect } from 'react';
import Progress from './Progress';
import './App.css';

export default function App() {
  const [strictOrganic, setStrictOrganic] = useState(false);
  const [organicWeight, setOrganicWeight]   = useState(0.7);
  const priceWeight = 1 - organicWeight;

  // user‑prefs
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_PREFS' }, (resp) => {
      if (resp) {
        setStrictOrganic(resp.strictOrganic ?? false);
        const ow = typeof resp.organicWeight === 'number' ? resp.organicWeight : 0.7;
        setOrganicWeight(Math.min(Math.max(ow, 0), 1));
      }
    });
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage({
      type: 'SET_PREFS',
      payload: { strictOrganic, organicWeight, priceWeight },
    });
  }, [strictOrganic, organicWeight]);

  // --- New: orderData loader ---
  const [orderData, setOrderData] = useState(null);

  useEffect(() => {
    fetch(chrome.runtime.getURL('data/order.json'))
      .then((r) => r.json())
      .then(setOrderData)
      .catch((err) => console.error('Could not load order.json', err));
  }, []);

  if (!orderData) {
    return <div style={{ padding: 16 }}>Loading your orders…</div>;
  }

  return (
    <div className="app-container">
      <h1 className="app-title">GreenVerse</h1>
      <p className="app-subtitle">Sustainable shopping assistant</p>
      <hr className="divider" />

      {/* Your settings panel unchanged */}
      <div className="settings-panel">
        <h4 className="settings-title">Settings</h4>
        <label className="settings-label">
          <input
            type="checkbox"
            checked={strictOrganic}
            onChange={(e) => setStrictOrganic(e.target.checked)}
            style={{ marginRight: 6 }}
          />
          Strict organic only
        </label>
        <div style={{ margin: '8px 0' }}>
          <label style={{ display: 'block', marginBottom: 4 }}>
            Organic vs Price weighting:
          </label>
          <input
            type="range"
            min="0"
            max="1"
            step="0.1"
            value={organicWeight}
            onChange={(e) => setOrganicWeight(parseFloat(e.target.value))}
            className="settings-range"
          />
          <div className="settings-info">
            Organic weight: {organicWeight.toFixed(1)}, Price weight: {priceWeight.toFixed(1)}
          </div>
        </div>
        <button className="save-button">Save Settings</button>
      </div>

      {/* New: pass orderData into Progress */}
      <div className="centered-progress">
        <Progress orderData={orderData} />
      </div>

      <h3 className="app-footer">Thanks for prioritizing sustainability 🌍</h3>
    </div>
  );
}
