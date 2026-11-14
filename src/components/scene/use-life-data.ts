"use client";

import { useTranslations } from "next-intl";
import { useMemo } from "react";
import { useAppData } from "@/components/app-data";
import { useFinance } from "@/components/finance-data";
import { useMoney } from "@/components/money-data";
import { useTime } from "@/components/time-data";
import { buildMap } from "@/lib/life-map";
import { lifeScore } from "@/lib/life-score";
import { eur } from "@/lib/money";
import { useDates } from "@/lib/use-dates";

/** The Life Score and the map built from the household's data. The scene host draws it; the map screen reads it. */
export function useLifeData() {
  const t = useTranslations("home");
  const tt = useTranslations("t");
  const { members, userId, settings } = useAppData();
  const money = useMoney();
  const time = useTime();
  const { debts } = useFinance();
  const dates = useDates();

  const score = useMemo(
    () =>
      lifeScore({
        today: money.today,
        budget: money.budget,
        ef: money.ef,
        goals: money.goals,
        yearlyGoals: time.yearlyGoals,
        events: time.events,
        people: members.map((m) => m.id),
        viewerId: userId,
        priorities: time.priorities,
        learningMinutes: time.learningMinutes,
        gym: time.gym,
        gymGoal: settings?.gym_week_goal ?? 3,
      }),
    [money.today, money.budget, money.ef, money.goals, time.yearlyGoals, time.events, time.priorities, time.learningMinutes, time.gym, members, userId, settings?.gym_week_goal],
  );

  const graph = useMemo(
    () =>
      buildMap({
        score,
        viewerId: userId,
        today: money.today,
        subscriptions: money.recurring.filter((r) => r.is_subscription),
        debts,
        categories: money.categories,
        transactions: money.transactions.filter((x) => x.visibility === "family"),
        goals: money.goals,
        events: time.events,
        learning: time.learningItems,
        gym: time.gym,
        text: {
          hub: (k) => tt(`p_${k}`),
          coreLabel: tt("k_core"),
          score: t("f_score"),
          perMonth: t("f_month"),
          balance: t("f_balance"),
          rate: t("f_rate"),
          spent: t("f_spent"),
          saved: t("f_saved"),
          progress: t("f_progress"),
          when: t("f_when"),
          eur: (n) => eur(n, 0),
          day: dates.day,
        },
      }),
    [score, userId, money.today, money.recurring, money.categories, money.transactions, money.goals, debts, time.events, time.learningItems, time.gym, t, tt, dates],
  );
  return { score, graph };
}
