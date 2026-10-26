export const CASE_STATUSES = ["new", "assessed", "in rehab", "modified training", "return to play", "recovered", "referred"];
export type CaseSort = "newest" | "alphabetical";
type CaseSummary = { id: string; status: string; created_at: string; athletes?: { first_name?: string; surname?: string } | null };

export function groupCases<T extends CaseSummary>(cases: readonly T[], sort: CaseSort) {
  const sorted = [...cases].sort((a, b) => {
    if (sort === "alphabetical") {
      const name = (row: T) => `${row.athletes?.first_name ?? ""} ${row.athletes?.surname ?? ""}`.trim();
      const result = name(a).localeCompare(name(b), undefined, { sensitivity: "base" });
      if (result) return result;
    }
    return b.created_at.localeCompare(a.created_at) || a.id.localeCompare(b.id);
  });
  const statuses = [...CASE_STATUSES, ...new Set(sorted.map((row) => row.status).filter((status) => !CASE_STATUSES.includes(status)))];
  return statuses.map((status) => ({ status, cases: sorted.filter((row) => row.status === status) })).filter((group) => group.cases.length);
}