import type { ComponentProps } from 'react';

/** Mutations keep native button semantics and the shared action appearance. */
export function ActionButton({ variant = 'secondary', className = '', type = 'button', ...props }:
  ComponentProps<'button'> & { variant?: 'primary' | 'secondary' | 'quiet' }) {
  return <button {...props} type={type} className={`rdd-page-action rdd-page-action--${variant} ${className}`.trim()} />;
}
