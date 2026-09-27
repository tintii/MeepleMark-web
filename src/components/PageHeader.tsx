import type { ReactNode } from "react";
import { Link } from "react-router-dom";

export function PageHeader({
  title,
  subtitle,
  parent,
  actions,
}: {
  title: string;
  subtitle?: ReactNode;
  parent?: { to: string; label: string };
  actions?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {parent && (
          <Link className="parent-link" to={parent.to}>
            <span aria-hidden="true">‹</span> {parent.label}
          </Link>
        )}
        <h1 className="type-title" tabIndex={-1}>{title}</h1>
        {subtitle && <div className="type-caption page-subtitle">{subtitle}</div>}
      </div>
      {actions && <div className="page-header-actions">{actions}</div>}
    </header>
  );
}

export function GroupedSection({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <section className="grouped-section">
      {title && <h2 className="section-heading">{title}</h2>}
      <div className="grouped-section-body">{children}</div>
    </section>
  );
}

