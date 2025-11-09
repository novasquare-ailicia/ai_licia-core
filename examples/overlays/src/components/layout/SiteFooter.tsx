import Image from "next/image";
import Link from "next/link";
import SmoothAnchor from "@/components/SmoothAnchor";
import styles from "./SiteFooter.module.css";

const SiteFooter = () => (
  <footer className={`${styles.footer} site-footer`}>
    <div className={styles.footerTop}>
      <div className={styles.footerBrand}>
        <Image src="/logo-icon-purple.svg" alt="ai_licia icon" width={32} height={32} />
        <span>Powered by ai_licia®</span>
      </div>
      <div className={styles.footerLinks}>
        <SmoothAnchor targetId="gallery" className={styles.footerAnchor}>
          Overlay gallery
        </SmoothAnchor>
        <SmoothAnchor targetId="benefits" className={styles.footerAnchor}>
          Benefits
        </SmoothAnchor>
        <Link href="/configure">Configurator</Link>
        <Link
          href="https://docs.getailicia.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Docs & API
        </Link>
      </div>
    </div>
    <div className={styles.footerBottom}>
      <span>© {new Date().getFullYear()} ai_licia®. All rights reserved.</span>
      <span>
        Built for high-engagement streams · <span className={styles.highlight}>AI overlay toolkit</span>
      </span>
    </div>
  </footer>
);

export default SiteFooter;
