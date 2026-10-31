import React from 'react';
import { BRAND_ASSETS, BRAND_INFO } from '../config/branding';

interface BrandLogoProps {
  /** Logo variant: transparent wordmark, white-backed wordmark, or compact square emblem */
  variant?: 'transparent' | 'white' | 'emblem';
  /** Size scale */
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  /** Whether to render the tagline and system subtitle underneath */
  showSubtitle?: boolean;
  /** Optional custom class for the outer wrapper */
  className?: string;
  /** Optional custom class for the image element */
  imageClassName?: string;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  variant = 'transparent',
  size = 'lg',
  showSubtitle = true,
  className = '',
  imageClassName = '',
}) => {
  const getAssetPath = () => {
    switch (variant) {
      case 'white':
        return BRAND_ASSETS.logoWhite;
      case 'emblem':
        return BRAND_ASSETS.emblem192;
      case 'transparent':
      default:
        return BRAND_ASSETS.logoTransparent;
    }
  };

  const getImageDimensions = () => {
    if (variant === 'emblem') {
      switch (size) {
        case 'xs':
          return 'h-6 w-6';
        case 'sm':
          return 'h-8 w-8';
        case 'md':
          return 'h-10 w-10';
        case 'xl':
          return 'h-20 w-20';
        case 'lg':
        default:
          return 'h-14 w-14';
      }
    }

    // Full wordmark logo proportions
    switch (size) {
      case 'xs':
        return 'h-6 sm:h-7 w-auto max-w-[140px]';
      case 'sm':
        return 'h-8 sm:h-9 w-auto max-w-[180px]';
      case 'md':
        return 'h-11 sm:h-12 w-auto max-w-[220px]';
      case 'xl':
        return 'h-20 sm:h-24 md:h-28 w-auto max-w-[380px]';
      case 'lg':
      default:
        return 'h-14 sm:h-16 md:h-20 w-auto max-w-[300px] sm:max-w-[340px]';
    }
  };

  return (
    <div className={`flex flex-col items-center text-center select-none ${className}`}>
      {/* Official Davejoe Interiors Brand Asset */}
      <div className="flex items-center justify-center">
        <img
          src={getAssetPath()}
          alt={BRAND_INFO.fullTitle}
          className={`${getImageDimensions()} object-contain transition-transform duration-200 ${imageClassName}`}
          loading="eager"
          decoding="async"
        />
      </div>

      {showSubtitle && (
        <>
          <h1 className="text-[20px] sm:text-[24px] font-bold text-slate-900 tracking-tight mt-3 sm:mt-3.5 leading-tight">
            {BRAND_INFO.productName}
          </h1>

          <p className="text-[12.5px] sm:text-[13.5px] text-slate-500 font-normal leading-relaxed max-w-[390px] sm:max-w-[430px] mt-1.5 px-2">
            One centralized system for managing people,
            <br className="hidden sm:inline" /> projects, operations and performance.
          </p>
        </>
      )}
    </div>
  );
};
