// The numbers on the "How it was built" screen. Update them when the project changes:
// they are counted by hand from the repository, not measured at run time.
export const BUILT_STATS = {
  rounds: 8,
  tests: 196, // 171 unit + 25 end-to-end, 2026-11-14
  screens: 32,
};

export const ROUNDS = ["A", "B", "C", "D", "E", "F", "G", "H"] as const;
export const DECISIONS = ["dec_1", "dec_2", "dec_3", "dec_4"] as const;
