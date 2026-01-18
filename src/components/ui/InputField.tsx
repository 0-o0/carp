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
          <label className="block text-sm font-semibold text-gray-900">
            {label}
          </label>
        )}
        <input
          ref={ref}
          className={`input-field text-gray-900 placeholder:text-gray-400 ${error ? 'border-red-500 bg-red-50/30' : ''} ${className}`}
          {...props}
        />
        {error && (
          <p className="text-sm text-red-500 animate-shake">{error}</p>
        )}
      </div>
    );
  }
);

InputField.displayName = 'InputField';
