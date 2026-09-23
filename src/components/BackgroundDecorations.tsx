import React from 'react';
import backgroundImage from '../images/davejoe_page_bg_1790182406922.jpg';

export const BackgroundDecorations: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden select-none -z-10 bg-[#f7faf9]"
      aria-hidden="true"
    >
      {/* Background image requested by user */}
      <img
        src={backgroundImage}
        alt="Davejoe Management Tool Background"
        className="absolute inset-0 w-full h-full object-cover object-center pointer-events-none"
        referrerPolicy="no-referrer"
      />
    </div>
  );
};
