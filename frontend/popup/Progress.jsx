// Progress.jsx
import React, { useState, useEffect } from 'react';
import { CircularProgressbar, buildStyles } from 'react-circular-progressbar';
import { easeQuadInOut } from 'd3-ease';
import AnimatedProgressProvider from './AnimatedProgressProvider';
import 'react-circular-progressbar/dist/styles.css';
import './Progress.css';

export default function Progress({ orderData }) {
  // now we read directly from the prop, never a missing global
  const [orders,     setOrders]     = useState(orderData.orders);
  const [baseScore,  setBaseScore]  = useState(orderData.score);
  const [newScore,   setNewScore]   = useState(0);
  const [valueEnd,   setValueEnd]   = useState(orderData.score);
  const [vouchers,   setVouchers]   = useState(Math.floor(orderData.score / 100));

  const allocateAllScores = () => {
    let added = 0;
    const updated = orders.map((o) => {
      if (!o.ischecked) {
        let pts = 0;
        if (o.sustainable >= 85) pts = 20;
        else if (o.sustainable > 75) pts = 15;
        else if (o.sustainable > 30) pts = 10;
        added += pts;
        return { ...o, ischecked: true, score: pts };
      }
      return o;
    });
    setOrders(updated);
    setNewScore((n) => n + added);
    setBaseScore((b) => b + added);
  };

  // recalc the animated end & voucher count
  useEffect(() => {
    setValueEnd(Math.round(baseScore));
    setVouchers(Math.floor(baseScore / 100));
  }, [baseScore]);

  return (
    <div className="progress-wrapper">
      <h2 className="progress-title">Eco Score</h2>

      <div className="progress-bar-container">
        <AnimatedProgressProvider
          valueStart={0}
          valueEnd={valueEnd}
          duration={1.4}
          easingFunction={easeQuadInOut}
        >
          {(value) => (
            <CircularProgressbar
              value={value}
              text={`${Math.round(value)}`}
              styles={buildStyles({
                pathColor: '#2ecc71',
                textColor: '#fff',
                trailColor: '#444',
                pathTransition: 'none',
              })}
            />
          )}
        </AnimatedProgressProvider>
      </div>

      <div className="score-info">
        <p>Total Points: {baseScore}</p>
        {vouchers > 0 && (
          <div className="voucher-banner">
            🎉 You've earned {vouchers} voucher(s) of ₹500 each!
          </div>
        )}
      </div>

      <button className="allocate-btn" onClick={allocateAllScores}>
        Allocate Scores
      </button>
    </div>
  );
}
