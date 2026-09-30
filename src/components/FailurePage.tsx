import type { ReactNode } from "react";

export function FailurePage({ code, title, explanation, actions }: { code: number; title: string; explanation: string; actions: ReactNode }) {
  const titleId = `failure-${code}-title`;
  return <section className="page failure-page" aria-labelledby={titleId}>
    <p className="failure-code">{code}</p>
    <h1 className="type-title" id={titleId}>{title}</h1>
    <p className="failure-explanation">{explanation}</p>
    <div className="failure-actions">{actions}</div>
  </section>;
}
