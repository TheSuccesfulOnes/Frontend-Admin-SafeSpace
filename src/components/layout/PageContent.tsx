import type { ReactNode } from "react";
import { PageFooter } from "./PageFooter";

type PageContentProps = {
  children: ReactNode;
  className?: string;
};

export function PageContent({ children, className }: PageContentProps) {
  const sectionClassName = ["page-content", className]
    .filter(Boolean)
    .join(" ");

  return (
    <section className={sectionClassName}>
      <div className="page-content-body">{children}</div>
      <PageFooter />
    </section>
  );
}
