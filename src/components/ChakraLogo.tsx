import React from 'react';

interface ChakraLogoProps {
  className?: string;
  variant?: 'navy' | 'white';
  color?: string;
  size?: number | string;
}

/**
 * Ashoka-Chakra-inspired 16-spoke wheel motif in brand navy (#12355B) or light white (#FFFFFF).
 * Used consistently across the navbar (both public & authenticated headers), login screen, and footer.
 */
export const ChakraLogo: React.FC<ChakraLogoProps> = ({
  className = 'w-8 h-8',
  variant = 'navy',
  color,
  size,
}) => {
  const strokeAndFill = color || (variant === 'white' ? '#FFFFFF' : '#12355B');

  return (
    <svg
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className={`inline-block flex-shrink-0 ${className}`}
      style={size ? { width: size, height: size } : undefined}
    >
      <circle cx="50" cy="50" r="42" fill="none" stroke={strokeAndFill} strokeWidth="4" />
      <circle cx="50" cy="50" r="6" fill={strokeAndFill} />
      <g stroke={strokeAndFill} strokeWidth="2.5">
        <line x1="50" y1="10" x2="50" y2="90" />
        <line x1="10" y1="50" x2="90" y2="50" />
        <line x1="19.3" y1="19.3" x2="80.7" y2="80.7" />
        <line x1="80.7" y1="19.3" x2="19.3" y2="80.7" />
        <line x1="34.5" y1="12.8" x2="65.5" y2="87.2" />
        <line x1="65.5" y1="12.8" x2="34.5" y2="87.2" />
        <line x1="12.8" y1="34.5" x2="87.2" y2="65.5" />
        <line x1="12.8" y1="65.5" x2="87.2" y2="34.5" />
      </g>
    </svg>
  );
};

export const ChakraIcon = ChakraLogo;
export const Logo = ChakraLogo;
export default ChakraLogo;
