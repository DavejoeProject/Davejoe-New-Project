import React from 'react';

export const LeftSupportingMessage: React.FC = () => {
  return (
    <div className="hidden lg:flex flex-col select-none max-w-[260px] text-left">
      {/* Brand accent bar */}
      <div className="w-7 h-[3px] bg-[#18B892] rounded-full mb-3.5" />

      {/* Primary 3-word mantra */}
      <div className="text-[26px] xl:text-[30px] font-bold text-[#8E9CA8] leading-[1.18] tracking-tight">
        People.
        <br />
        Projects.
        <br />
        Progress.
      </div>

      {/* Secondary description */}
      <p className="text-[13px] text-[#9AA8B4] font-normal leading-relaxed mt-3">
        Building better spaces
        <br />
        through smarter management.
      </p>
    </div>
  );
};

export const UpperRightSupportingMessage: React.FC = () => {
  return (
    <div className="hidden lg:flex flex-col items-start select-none">
      {/* Vertical stacked action pillars */}
      <div className="text-[11px] font-medium tracking-[0.22em] text-[#8E9CA8] flex flex-col gap-1 text-left">
        <span>PLAN</span>
        <span>MANAGE</span>
        <span>EXECUTE</span>
        <span>DELIVER</span>
      </div>

      {/* Brand accent line directly underneath */}
      <div className="w-7 h-[3px] bg-[#18B892] rounded-full mt-3" />
    </div>
  );
};
