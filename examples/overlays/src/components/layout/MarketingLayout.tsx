import { ReactNode, Suspense } from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

const MarketingLayout = ({ children }: { children: ReactNode }) => (
  <div className="site-shell">
    <Suspense fallback={null}>
      <SiteHeader />
    </Suspense>
    <main className="site-main">{children}</main>
    <SiteFooter />
  </div>
);

export default MarketingLayout;
