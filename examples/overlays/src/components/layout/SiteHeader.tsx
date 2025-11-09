'use client';

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { FocusEvent, useCallback, useState, useEffect, useMemo } from "react";
import { smoothScrollTo } from "@/components/SmoothAnchor";
import styles from "./SiteHeader.module.css";
import ThemeToggle from "./ThemeToggle";

type NavItem =
  | { label: string; type: "anchor"; targetId: string }
  | { label: string; type: "route"; href: string }
  | {
      label: string;
      type: "dropdown";
      items: { label: string; href: string; description?: string }[];
    };

const navItems: NavItem[] = [
  { label: "Overview", type: "anchor", targetId: "hero" },
  { label: "Overlays", type: "anchor", targetId: "gallery" },
  { label: "Benefits", type: "anchor", targetId: "benefits" },
  {
    label: "Configurator",
    type: "dropdown",
    items: [
      { label: "Top chatters overlay", href: "/configure" },
      { label: "Message rate card", href: "/configure/message-rate" },
    ],
  },
];

const isActiveRoute = (pathname: string, href: string) =>
  href === "/" ? pathname === "/" : pathname.startsWith(href);

const SiteHeader = () => {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const anchorParam = useMemo(() => searchParams.get("anchor"), [searchParams]);
  const [menuOpen, setMenuOpen] = useState(false);
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);

  const handleNavClick = useCallback(() => setMenuOpen(false), []);

  const handleAnchorNavigate = useCallback(
    (targetId: string) => {
      if (pathname === "/") {
        smoothScrollTo(targetId);
      } else {
        const params = new URLSearchParams();
        params.set("anchor", targetId);
        router.push(`/?${params.toString()}`, { scroll: false });
      }
      handleNavClick();
    },
    [handleNavClick, pathname, router]
  );

  useEffect(() => {
    if (pathname !== "/" || !anchorParam) return;
    requestAnimationFrame(() => smoothScrollTo(anchorParam));
    router.replace("/", { scroll: false });
  }, [anchorParam, pathname, router]);

  return (
    <header className={styles.header}>
      <div className={styles.branding}>
        <Link href="/" className={styles.logoLink}>
          <Image src="/logo-icon-purple.svg" alt="ai_licia logo" width={32} height={32} />
          <div className={styles.logoWordmark}>
            <span>AI overlays</span>
            <span>powered by ai_licia</span>
          </div>
        </Link>
      </div>
      <nav className={styles.nav} aria-label="Primary navigation">
        {navItems.map((item) => (
          <div key={item.label}>
            {item.type === "anchor" ? (
              <button
                type="button"
                className={styles.navButton}
                onClick={() => handleAnchorNavigate(item.targetId)}
              >
                {item.label}
              </button>
            ) : item.type === "route" ? (
              <Link
                href={item.href}
                aria-current={
                  isActiveRoute(pathname, item.href) ? "page" : undefined
                }
                onClick={handleNavClick}
              >
                {item.label}
              </Link>
            ) : (
              <div
                className={styles.dropdownWrapper}
                onBlur={(event: FocusEvent<HTMLDivElement>) => {
                  if (
                    !event.currentTarget.contains(
                      event.relatedTarget as Node | null
                    )
                  ) {
                    setOpenDropdown(null);
                  }
                }}
              >
                <button
                  type="button"
                  className={`${styles.navButton} ${styles.dropdownTrigger}`}
                  aria-haspopup="true"
                  aria-expanded={openDropdown === item.label}
                  onClick={() =>
                    setOpenDropdown((prev) =>
                      prev === item.label ? null : item.label
                    )
                  }
                  onKeyDown={(event) => {
                    if (event.key === "Escape") {
                      setOpenDropdown(null);
                    }
                  }}
                >
                  {item.label}
                  <span aria-hidden="true">▾</span>
                </button>
                {openDropdown === item.label && (
                  <div className={styles.dropdownMenu} role="menu">
                    {item.items.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={styles.dropdownLink}
                        onClick={() => {
                          handleNavClick();
                          setOpenDropdown(null);
                        }}
                        role="menuitem"
                      >
                        <span>{child.label}</span>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </nav>
      <div className={styles.actions}>
        <ThemeToggle />
        <Link
          href="https://getailicia.com"
          target="_blank"
          rel="noopener noreferrer"
          className={styles.primaryCta}
        >
          Discover ai_licia
        </Link>
        <button
          type="button"
          className={styles.menuButton}
          aria-expanded={menuOpen}
          aria-controls="mobile-nav"
          onClick={() => setMenuOpen((prev) => !prev)}
        >
          Menu
        </button>
      </div>
      {menuOpen && (
        <nav id="mobile-nav" className={styles.mobileNav} aria-label="Mobile navigation">
          {navItems.map((item) =>
            item.type === "anchor" ? (
              <button
                key={item.label}
                type="button"
                className={styles.navButton}
                onClick={() => handleAnchorNavigate(item.targetId)}
              >
                {item.label}
              </button>
            ) : item.type === "route" ? (
              <Link key={item.href} href={item.href} onClick={handleNavClick}>
                {item.label}
              </Link>
            ) : (
              <div key={item.label} className={styles.mobileDropdown}>
                <span className={styles.mobileDropdownLabel}>
                  {item.label}
                </span>
                <div className={styles.mobileDropdownMenu}>
                  {item.items.map((child) => (
                    <Link
                      key={child.href}
                      href={child.href}
                      onClick={handleNavClick}
                    >
                      {child.label}
                    </Link>
                  ))}
                </div>
              </div>
            )
          )}
          <Link
            href="/configure"
            className={styles.primaryCta}
            onClick={handleNavClick}
          >
            Build overlays
          </Link>
        </nav>
      )}
    </header>
  );
};

export default SiteHeader;
