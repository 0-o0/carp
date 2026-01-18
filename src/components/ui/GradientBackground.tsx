'use client';

import { ReactNode } from 'react';

interface GradientBackgroundProps {
  children: ReactNode;
  className?: string;
}

export function GradientBackground({ children, className = '' }: GradientBackgroundProps) {
  return (
    <div className={`gradient-bg ${className}`}>
      {children}
    </div>
  );
}
