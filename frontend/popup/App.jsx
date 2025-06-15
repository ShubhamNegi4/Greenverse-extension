import React, { useState, useEffect } from 'react';
import Progress from './Progress';
import DashboardView from './DashboardView';
import ProductView from './ProductView';

export default function App() {
  const [isDashboard, setIsDashboard] = useState(true);

  // Preferences state
  const [strictOrganic, setStrictOrganic] = useState(false);
  const [organicWeight, setOrganicWeight] = useState(0.7);
  // priceWeight is always (1 - organicWeight)
  const priceWeight = 1 - organicWeight;

  // Load stored preferences on mount
  useEffect(() => {
    chrome.runtime.sendMessage({ type: 'GET_PREFS' }, (resp) => {
      if (resp && resp.prefs) {
        setStrictOrganic(resp.prefs.strictOrganic);
        // Ensure weights sum to 1
        const ow = typeof resp.prefs.organicWeight === 'number' ? resp.prefs.organicWeight : 0.7;
        setOrganicWeight(Math.min(Math.max(ow, 0), 1));
      }
    });
  }, []);

  // Save preferences when they change
  const savePrefs = () => {
    chrome.runtime.sendMessage(
      {
        type: 'SET_PREFS',
        payload: {
          strictOrganic,
          organicWeight,
          priceWeight
        }
      },
      () => {
        // Optionally: show a brief confirmation in UI
        console.log('Preferences saved');
      }
    );
  };

  // Whenever strictOrganic or organicWeight changes, persist immediately
  useEffect(() => {
    savePrefs();
  }, [strictOrganic, organicWeight]);

  // Render settings UI: placed at top of DashboardView area
  const SettingsPanel = () => (
    <div style={{
      marginBottom: '16px',
      padding: '8px',
      border: '1px solid #ccc',
      borderRadius: '6px',
      background: '#f9f9f9'
    }}>
      <h4 style={{ margin: '4px 0', color: '#2E7D32' }}>Settings</h4>
      <label style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
        <input
          type="checkbox"
          checked={strictOrganic}
          onChange={e => setStrictOrganic(e.target.checked)}
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
          onChange={e => {
            const ow = parseFloat(e.target.value);
            setOrganicWeight(ow);
            // priceWeight is derived in background when reading prefs
          }}
          style={{ width: '100%' }}
        />
        <div style={{ fontSize: '0.9rem', color: '#555' }}>
          Organic weight: {organicWeight.toFixed(1)}, Price weight: {priceWeight.toFixed(1)}
        </div>
      </div>
      <button
        onClick={savePrefs}
        style={{
          padding: '6px 12px',
          background: '#2E7D32',
          color: '#fff',
          border: 'none',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        Save Settings
      </button>
    </div>
  );

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

      <button
        onClick={() => setIsDashboard(prev => !prev)}
        style={{
          marginBottom: '12px',
          background: '#008000',
          color: '#fff',
          border: 'none',
          padding: '8px 12px',
          borderRadius: '4px',
          cursor: 'pointer'
        }}
      >
        {isDashboard ? 'Go to Product View' : 'Go to Dashboard'}
      </button>

      <div style={{ background: '#fff', padding: '12px', borderRadius: '8px' }}>
        {isDashboard ? (
          <>
            {/* Insert SettingsPanel at top of Dashboard */}
            <SettingsPanel />
            <DashboardView />
          </>
        ) : (
          <ProductView />
        )}
      </div>

      <div style={{ width: "100px", margin: "1rem auto" }}>
        <Progress />
      </div>

      <h3 style={{ color: '#2E7D32', textAlign: 'center' }}>
        Thanks for prioritizing sustainability 🌍
      </h3>
    </div>
  );
}
