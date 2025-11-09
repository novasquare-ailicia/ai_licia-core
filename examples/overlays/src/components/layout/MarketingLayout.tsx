import { ReactNode } from "react";
import SiteHeader from "./SiteHeader";
import SiteFooter from "./SiteFooter";

const MarketingLayout = ({ children }: { children: ReactNode }) => (
  <div className="site-shell">
    <SiteHeader />
    <main className="site-main">{children}</main>
    <SiteFooter />
  </div>
);

export default MarketingLayout;
