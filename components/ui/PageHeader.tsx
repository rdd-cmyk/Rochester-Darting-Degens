import type { ReactNode } from 'react';

/** Opt-in heading family: adopting one page must not restyle older headers. */
export function PageHeader({
  title, eyebrow, description, actions, identity,
  size = 'compact',
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  identity?: ReactNode;
  size?: 'compact' | 'standard' | 'feature';
}) {
  return (
    <header className={`rdd-title-header rdd-title-header--${size}`}>
      <div className="rdd-title-header-copy">
        {eyebrow && <p className="rdd-title-eyebrow">{eyebrow}</p>}
        <h1>{title}<span className="rdd-title-period" aria-hidden="true">.</span></h1>
        {description && <p className="rdd-title-description">{description}</p>}
        {actions && <div className="rdd-title-actions">{actions}</div>}
      </div>
      {identity && <div className="rdd-title-identity">{identity}</div>}
    </header>
  );
}
