import React, { useState, useEffect } from 'react';
import Progress from './Progress';
import './App.css';

export default function App() {
  const [strictOrganic, setStrictOrganic] = useState(false);
  const [organicWeight, setOrganicWeight] = useState(0.7);
  const priceWeight = 1 - organicWeight;

  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_PREFS' }, (resp) => {
      if (resp) {
        setStrictOrganic(resp.strictOrganic || false);
        const ow = typeof resp.organicWeight === 'number' ? resp.organicWeight : 0.7;
        setOrganicWeight(Math.min(Math.max(ow, 0), 1));
      }
    });
  }, []);

  useEffect(() => {
    chrome.runtime.sendMessage({
      type: 'SET_PREFS',
      payload: {
        strictOrganic,
        organicWeight,
        priceWeight,
      },
    });
  }, [strictOrganic, organicWeight]);

  const SettingsPanel = () => (
    <div className="settings-panel">
      <h4 className="settings-title">Settings</h4>
      <label className="settings-label">
        <input
          type="checkbox"
          checked={strictOrganic}
          onChange={(e) => setStrictOrganic(e.target.checked)}
          style={{ marginRight: '6px' }}
        />
        Strict organic only
      </label>
      <div style={{ marginBottom: '8px' }}>
        <label style={{ display: 'block', marginBottom: '4px' }}>
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
      <button className="save-button" onClick={() => {}}>
        Save Settings
      </button>
    </div>
  );

  return (
    <div className="app-container">
      <h1 className="app-title">GreenVerse</h1>
      <p className="app-subtitle">Sustainable shopping assistant</p>
      <hr className="divider" />
      <SettingsPanel />
      <div className="centered-progress">
        <Progress />
      </div>
      <h3 className="app-footer">Thanks for prioritizing sustainability 🌍</h3>
    </div>
  );
}
