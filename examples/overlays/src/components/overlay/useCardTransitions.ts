import { useMemo, useRef } from "react";
import type { RankKey } from "@/lib/overlay";
import type { AnimatedCard, LeaderboardEntry } from "./types";

const RANKS: RankKey[] = ["rank1", "rank2", "rank3"];

interface CardTransitionOptions {
  leaders: LeaderboardEntry[];
  placeholdersActive?: boolean;
}

type PreviousCard = { index: number; count: number };

export const useCardTransitions = ({
  leaders,
  placeholdersActive,
}: CardTransitionOptions) => {
  const previousRef = useRef<Map<string, PreviousCard>>(new Map());

  const slots = useMemo(() => {
    const previous = previousRef.current;
    const next = new Map<string, PreviousCard>();

    const maxCount = leaders.length
      ? Math.max(...leaders.map((entry) => entry.count || 0), 1)
      : 1;

    const mapped = RANKS.map((rank, index) => {
      const entry = leaders[index];
      if (!entry) return null;

      const key = entry.username.toLowerCase();
      const before = previous.get(key);
      let state: AnimatedCard["state"] = placeholdersActive ? "stable" : "enter";

      if (before) {
        if (before.index !== index) {
          state = before.index > index ? "promoted" : "demoted";
        } else if (entry.count !== before.count) {
          state = "update";
        } else {
          state = "stable";
        }
      }

      next.set(key, { index, count: entry.count });

      const progress = maxCount ? entry.count / maxCount : 0;

      const card: AnimatedCard = {
        id: `${rank}-${key}`,
        entry,
        rank,
        placeholder: Boolean(placeholdersActive),
        progress,
        state,
        countKey: `${entry.username}-${entry.count}`,
      };

      return card;
    }).filter(Boolean) as AnimatedCard[];

    previousRef.current = next;
    return mapped;
  }, [leaders, placeholdersActive]);

  return slots;
};
