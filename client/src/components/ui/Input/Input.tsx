import React from 'react';
import './Input.css';

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  /**
   * Icon to display on the left side of the input
   */
  leftIcon?: React.ReactNode;
  /**
   * Additional CSS class names
   */
  className?: string;
}

/**
 * Modern, minimalistic input component with optional icon support
 */
export const Input: React.FC<InputProps> = ({
  leftIcon,
  className = '',
  ...props
}) => {
  const inputClassName = `
    modern-input
    ${leftIcon ? 'modern-input--with-icon' : ''}
    ${className}
  `.trim();

  return (
    <div className="modern-input-wrapper">
      {leftIcon && (
        <span className="modern-input-icon">{leftIcon}</span>
      )}
      <input className={inputClassName} {...props} />
    </div>
  );
};
