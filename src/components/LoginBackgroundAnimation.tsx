import React from 'react';

export const LoginBackgroundAnimation: React.FC = () => {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
      {/* 1. Flat saffron horizontal band near the top (6-14% breathing opacity) */}
      <div
        className="absolute top-0 left-0 right-0 h-44 sm:h-56 bg-[#FF9933] animate-breathe-band opacity-10"
        aria-hidden="true"
      />

      {/* 2. Flat green horizontal band near the bottom (6-14% breathing opacity) */}
      <div
        className="absolute bottom-0 left-0 right-0 h-44 sm:h-56 bg-[#138808] animate-breathe-band opacity-10"
        aria-hidden="true"
      />

      {/* 3. Faint large Ashoka-Chakra-style outline motif in back right corner */}
      <div
        className="absolute -right-24 -top-24 sm:-right-28 sm:-top-28 w-96 h-96 sm:w-[520px] sm:h-[520px] animate-rotate-chakra opacity-[0.07]"
        aria-hidden="true"
      >
        <svg
          viewBox="0 0 200 200"
          className="w-full h-full stroke-[#12355B] fill-none"
          strokeWidth="1.5"
        >
          {/* Outer circle rings */}
          <circle cx="100" cy="100" r="95" />
          <circle cx="100" cy="100" r="90" strokeWidth="0.8" />
          <circle cx="100" cy="100" r="22" strokeWidth="1.2" />
          <circle cx="100" cy="100" r="10" fill="#12355B" />

          {/* 24 Spokes */}
          {Array.from({ length: 24 }).map((_, i) => {
            const angle = (i * 360) / 24;
            return (
              <line
                key={i}
                x1="100"
                y1="100"
                x2="100"
                y2="10"
                transform={`rotate(${angle} 100 100)`}
                strokeWidth="1.2"
              />
            );
          })}
        </svg>
      </div>
    </div>
  );
};
