import React, { useEffect, useState } from "react";

export default function AnimatedProgressProvider({
  valueStart,
  valueEnd,
  duration,
  easingFunction,
  children
}) {
  const [value, setValue] = useState(valueStart);

  useEffect(() => {
    let start = performance.now();

    function animate(now) {
      const elapsed = (now - start) / 1000;
      const progress = Math.min(elapsed / duration, 1);
      const eased = easingFunction(progress);
      setValue(valueStart + (valueEnd - valueStart) * eased);

      if (progress < 1) {
        requestAnimationFrame(animate);
      }
    }

    requestAnimationFrame(animate);
  }, [valueStart, valueEnd, duration, easingFunction]);

  return children(value);
}
