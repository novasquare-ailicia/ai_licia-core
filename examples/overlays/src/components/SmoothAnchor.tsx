'use client';

import { ButtonHTMLAttributes, ReactNode } from "react";

interface SmoothAnchorProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "type" | "onClick"> {
  targetId: string;
  className?: string;
  children: ReactNode;
  onNavigate?: () => void;
  offset?: number;
}

const DEFAULT_OFFSET = 96;

export const smoothScrollTo = (targetId: string, offset?: number) => {
  if (typeof document === "undefined" || typeof window === "undefined") return;
  const element = document.getElementById(targetId);
  if (!element) return;

  const header = document.querySelector("header");
  const headerHeight =
    offset ?? header?.getBoundingClientRect().height ?? DEFAULT_OFFSET;

  const targetTop = element.getBoundingClientRect().top + window.scrollY;
  const scrollTarget = Math.max(targetTop - headerHeight, 0);

  window.scrollTo({ top: scrollTarget, behavior: "smooth" });
};

const SmoothAnchor = ({
  targetId,
  className,
  children,
  onNavigate,
  offset,
  ...buttonProps
}: SmoothAnchorProps) => {
  const handleClick = () => {
    smoothScrollTo(targetId, offset);
    onNavigate?.();
  };

  return (
    <button
      type="button"
      className={className}
      onClick={handleClick}
      {...buttonProps}
    >
      {children}
    </button>
  );
};

export default SmoothAnchor;
