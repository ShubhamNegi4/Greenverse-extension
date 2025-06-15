import React, { useState, useEffect } from "react";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import { easeQuadInOut } from "d3-ease";
import AnimatedProgressProvider from "./AnimatedProgressProvider";
import "react-circular-progressbar/dist/styles.css";

export default function Progress() {
  const [valueEnd, setValueEnd] = useState(0);

  // Simulate a calculation (e.g., API call or logic)
  useEffect(() => {
    const calculateScore = () => {
      // Simulated async calculation
      setTimeout(() => {
        const score = Math.floor(Math.random() * 100); // Simulated score
        setValueEnd(score);
      }, 1000); // 1-second delay
    };

    calculateScore();
  }, []);

  return (
    <AnimatedProgressProvider
      valueStart={0}
      valueEnd={valueEnd}
      duration={1.4}
      easingFunction={easeQuadInOut}
    >
      {(value) => {
        const roundedValue = Math.round(value);
        return (
          <CircularProgressbar
            value={value}
            text={`${roundedValue}`}
            styles={buildStyles({
              pathColor: "#2ecc71",
              textColor: "#222",
              trailColor: "#d6d6d6",
              pathTransition: "none",
            })}
          />
        );
      }}
    </AnimatedProgressProvider>
  );
}
