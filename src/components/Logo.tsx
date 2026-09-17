import React from 'react';

interface LogoProps {
  size?: number;
  showText?: boolean;
  className?: string;
  textSize?: string;
}

export default function Logo({ 
  size = 32, 
  showText = false, 
  className = '', 
  textSize = 'text-base font-bold' 
}: LogoProps) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <svg 
        width={size} 
        height={size} 
        viewBox="0 0 512 512" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg"
        className="shrink-0 transition-transform duration-200 hover:scale-105 select-none rounded-full shadow-sm shadow-blue-500/20"
      >
        {/* Vibrant Blue Circle */}
        <circle cx="256" cy="256" r="256" fill="#1884f7" />
        
        {/* Outer Globe Ring */}
        <circle cx="256" cy="256" r="162" fill="none" stroke="#ffffff" strokeWidth="20" />
        
        {/* Equator */}
        <line x1="94" y1="256" x2="418" y2="256" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" />
        
        {/* Prime Meridian */}
        <line x1="256" y1="94" x2="256" y2="418" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" />
        
        {/* Longitude Ellipse */}
        <ellipse cx="256" cy="256" rx="84" ry="162" fill="none" stroke="#ffffff" strokeWidth="20" />
        
        {/* Latitude Curved Arcs */}
        <path d="M125 178 Q256 220 387 178" fill="none" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" />
        <path d="M125 334 Q256 292 387 334" fill="none" stroke="#ffffff" strokeWidth="20" strokeLinecap="round" />
      </svg>
      {showText && (
        <span className={`tracking-tight text-zinc-900 dark:text-white ${textSize}`}>
          NextGen CMS
        </span>
      )}
    </div>
  );
}

