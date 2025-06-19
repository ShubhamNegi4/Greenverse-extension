import React, { useState, useEffect } from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import { easeQuadInOut } from "d3-ease";
import AnimatedProgressProvider from "./AnimatedProgressProvider";
import "react-circular-progressbar/dist/styles.css";
import "./Progress.css";
import orderData from "../../data/order.json"; // ✅ new structure

export default function Progress() {
  const [orders, setOrders] = useState(orderData.orders);
  const [baseScore, setBaseScore] = useState(orderData.score); // Root level score
  const [newScore, setNewScore] = useState(0); // Score from newly checked orders
  const [valueEnd, setValueEnd] = useState(orderData.score);
  const [vouchers, setVouchers] = useState(Math.floor(orderData.score / 100));

  // Allocates score for unchecked orders and marks them as checked
  const allocateAllScores = () => {
    let addedScore = 0;

    const updatedOrders = orders.map(order => {
      if (!order.ischecked) {
        let score = 0;
        if (order.sustainable >= 85) score = 20;
        else if (order.sustainable > 75) score = 15;
        else if (order.sustainable > 30) score = 10;
        addedScore += score;
        return { ...order, ischecked: true, score };
      }
      return order;
    });

    setOrders(updatedOrders);
    setNewScore(prev => prev + addedScore);
    setBaseScore(prev => prev + addedScore);
  };

  // Recalculate progress
  useEffect(() => {
    const total = baseScore;
    setValueEnd(Math.round(total));
    setVouchers(Math.floor(total / 100));
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
                pathColor: "#2ecc71",
                textColor: "#ffffff",
                trailColor: "#444444",
                pathTransition: "none"
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
