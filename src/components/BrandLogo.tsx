import React from 'react';

export const BrandLogo: React.FC = () => {
  return (
    <div className="flex flex-col items-center text-center select-none">
      {/* Brand Wordmark Lockup */}
      <div className="relative inline-flex items-baseline justify-center">
        {/* Dave in deep charcoal */}
        <span className="text-[42px] sm:text-[48px] font-extrabold text-[#0F172A] tracking-[-0.03em] leading-none">
          Dave
        </span>

        {/* joe in brand green with integrated architectural roof mark */}
        <div className="relative inline-flex items-baseline">
          {/* Architectural roof mark positioned above 'joe' */}
          <div className="absolute -top-[23px] sm:-top-[26px] left-1/2 -translate-x-[48%] pointer-events-none">
            <svg
              width="50"
              height="28"
              viewBox="0 0 54 30"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="w-[44px] h-[24px] sm:w-[50px] sm:h-[28px]"
            >
              {/* Chimney on right slope */}
              <rect x="36" y="5" width="4.5" height="9" fill="#18B892" rx="0.5" />
              {/* Roof main pitched gable */}
              <path
                d="M3 21.5L27 3L51 21.5"
                stroke="#18B892"
                strokeWidth="4.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* 4-pane window under the gable */}
              <rect x="22" y="10.5" width="4" height="4" fill="#18B892" rx="0.5" />
              <rect x="28" y="10.5" width="4" height="4" fill="#18B892" rx="0.5" />
              <rect x="22" y="16.5" width="4" height="4" fill="#18B892" rx="0.5" />
              <rect x="28" y="16.5" width="4" height="4" fill="#18B892" rx="0.5" />
            </svg>
          </div>

          <span className="text-[42px] sm:text-[48px] font-extrabold text-[#18B892] tracking-[-0.03em] leading-none">
            joe
          </span>
        </div>
      </div>

      {/* Management Tool Sub-title */}
      <h1 className="text-[26px] sm:text-[30px] font-extrabold text-[#0F172A] tracking-[-0.025em] mt-1.5 leading-tight">
        Management Tool
      </h1>

      {/* Centralized system statement */}
      <p className="text-[13px] sm:text-[14px] text-slate-500 font-normal leading-relaxed max-w-[390px] sm:max-w-[430px] mt-2">
        One centralized system for managing people,
        <br className="hidden sm:inline" /> projects, operations and performance.
      </p>
    </div>
  );
};
