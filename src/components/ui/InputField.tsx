'use client';

import { InputHTMLAttributes, forwardRef } from 'react';

interface InputFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const InputField = forwardRef<HTMLInputElement, InputFieldProps>(
  ({ label, error, className = '', ...props }, ref) => {
    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-semibold text-foreground">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`input-field placeholder:text-slate-500 ${error ? 'border-red-500 bg-red-500/10' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-400 animate-shake">{error}</p>
        )}
      </div>
    );
  }
);

InputField.displayName = 'InputField';
