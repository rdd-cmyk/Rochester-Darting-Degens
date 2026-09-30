import Link from 'next/link';
import type { ComponentProps } from 'react';

/** Navigation actions share appearance while retaining Link semantics. */
export function ActionLink({ variant = 'secondary', className = '', ...props }:
  ComponentProps<typeof Link> & { variant?: 'primary' | 'secondary' | 'quiet' }) {
  return <Link {...props} className={`rdd-page-action rdd-page-action--${variant} ${className}`.trim()} />;
}
