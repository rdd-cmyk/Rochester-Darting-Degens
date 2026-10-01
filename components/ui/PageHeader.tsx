import type { ReactNode } from 'react';

/** Every route shares this title rhythm; domain artwork belongs below it. */
export function PageHeader({
  title, eyebrow, description, actions, identity,
}: {
  title: string;
  eyebrow?: string;
  description?: ReactNode;
  actions?: ReactNode;
  identity?: ReactNode;
}) {
  return (
    <>
    <header className="rdd-title-header">
      <div className="rdd-title-header-copy">
        <div className="rdd-title-eyebrow-slot">
          {eyebrow && <p className="rdd-title-eyebrow">{eyebrow}</p>}
        </div>
        <h1>{title}<span className="rdd-title-period" aria-hidden="true">.</span></h1>
        <div className="rdd-title-description-slot">
          {description && <p className="rdd-title-description">{description}</p>}
        </div>
      </div>
      {identity && <div className="rdd-title-identity">{identity}</div>}
    </header>
    {actions && <div className="rdd-title-actions">{actions}</div>}
    </>
  );
}
