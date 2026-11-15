"use client";

import { createContext, useContext } from "react";
import type { QuickAddItem } from "@/lib/nav";

export type ShellUI = {
  openQuickAdd: () => void;
  openCommand: () => void;
  openAtlas: () => void;
  runQuickAdd: (item: QuickAddItem) => void;
};

export const ShellContext = createContext<ShellUI>({
  openQuickAdd: () => {},
  openCommand: () => {},
  openAtlas: () => {},
  runQuickAdd: () => {},
});

export const useShell = () => useContext(ShellContext);
