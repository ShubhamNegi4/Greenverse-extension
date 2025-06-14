import React from 'react';

export default function App() {
  return (
    <div style={{
      width: '300px',
      height: '400px',
      padding: '16px',
      boxSizing: 'border-box',
      fontFamily: 'Arial, sans-serif',
      background: '#f0f0f0'
    }}>
      <h1 style={{ margin: 0, fontSize: '1.25rem', color: '#2E7D32' }}>
        GreenVerse
      </h1>
      <p style={{ marginTop: '8px', fontSize: '0.9rem', color: '#555' }}>
        Sustainable shopping assistant for Amazon.in
      </p>
      <hr style={{ margin: '12px 0', borderColor: '#ccc' }} />
      <div style={{
        padding: '12px',
        background: '#fff',
        borderRadius: '8px',
        textAlign: 'center'
      }}>
        <strong>Score:</strong> <span style={{ color: '#2E7D32', fontSize: '1.5rem' }}>—/100</span>
      </div>
      <button style={{
        marginTop: '16px',
        padding: '8px 16px',
        background: '#2E7D32',
        color: '#fff',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer'
      }}>
        Loading...
      </button>
    </div>
  );
}
