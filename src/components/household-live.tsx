"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useAppData } from "@/components/app-data";
import { useMoney } from "@/components/money-data";
import { useTime } from "@/components/time-data";
import { useToast } from "@/components/toast";
import { LIVE_TABLES, needsReload, newsOf, type LiveChange } from "@/lib/household-live";
import { supabase } from "@/lib/supabase";

/**
 * On the Together plan, what a partner adds shows up here without a refresh, with a short
 * "Mira just added …". Renders nothing. Private rows never arrive: Row Level Security filters them.
 */
export function HouseholdLive() {
  const t = useTranslations("home");
  const toast = useToast();
  const { userId, household, members, plan } = useAppData();
  const { reload: reloadMoney } = useMoney();
  const { reload: reloadTime } = useTime();

  // The latest of these, without resubscribing every time one changes.
  const latest = useRef({ t, toast, members, reloadMoney, reloadTime });
  useEffect(() => {
    latest.current = { t, toast, members, reloadMoney, reloadTime };
  });

  const householdId = household?.id;
  const live = plan === "together" && members.length > 1 && !!householdId && !!userId;

  useEffect(() => {
    if (!live) return;
    const sb = supabase();
    let batch: LiveChange[] = [];
    let timer: ReturnType<typeof setTimeout> | undefined;
    let first = true;

    const flush = () => {
      const changes = batch;
      batch = [];
      const cur = latest.current;
      if (needsReload(changes, userId)) {
        void cur.reloadMoney();
        void cur.reloadTime();
      }
      const news = newsOf(changes, userId);
      const who = news && cur.members.find((m) => m.id === news.owner)?.display_name;
      if (news && who) cur.toast(news.what ? cur.t("rt_added", { name: who, what: news.what }) : cur.t("rt_added_many", { name: who, n: news.n }));
    };

    const channel = sb.channel(`household-${householdId}`);
    for (const table of LIVE_TABLES) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `household_id=eq.${householdId}` }, (p) => {
        batch.push({ table, type: p.eventType as LiveChange["type"], row: (p.eventType === "DELETE" ? p.old : p.new) as Record<string, unknown> | null });
        clearTimeout(timer);
        timer = setTimeout(flush, 900);
      });
    }
    channel.subscribe((status) => {
      if (status !== "SUBSCRIBED") return;
      // After a dropped connection something may have been missed: look again.
      if (!first) {
        void latest.current.reloadMoney();
        void latest.current.reloadTime();
      }
      first = false;
    });

    return () => {
      clearTimeout(timer);
      void sb.removeChannel(channel);
    };
  }, [live, householdId, userId]);

  return null;
}
