'use client';

import styles from "./ThemeToggle.module.css";
import { useThemeMode } from "@/components/Providers";

const ThemeToggle = () => {
  const { mode, toggleMode } = useThemeMode();

  return (
    <button
      type="button"
      onClick={toggleMode}
      className={styles.toggle}
      aria-label="Toggle light and dark mode"
    >
      <span className={styles.icon} aria-hidden="true">
        {mode === "dark" ? "🌙" : "☀️"}
      </span>
      <span className={styles.label}>{mode === "dark" ? "dark" : "light"}</span>
    </button>
  );
};

export default ThemeToggle;
