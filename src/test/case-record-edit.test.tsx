import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CaseRecordEdit } from "@/components/vito/CaseRecordEdit";

const db = vi.hoisted(() => ({ update: vi.fn(), eq: vi.fn(), select: vi.fn(), single: vi.fn(), from: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { from: db.from } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

function openEditor() {
  render(<QueryClientProvider client={new QueryClient()}><CaseRecordEdit table="clinical_notes" row={{ id: "note-1", injury_id: "case-1", note: "Original" }} injuryId="case-1" /></QueryClientProvider>);
  fireEvent.click(screen.getByRole("button", { name: "Edit" }));
  fireEvent.change(screen.getByLabelText(/Clinical note/), { target: { value: "Corrected" } });
  fireEvent.click(screen.getByRole("button", { name: "Save changes" }));
}

beforeEach(() => {
  vi.clearAllMocks();
  const chain = { update: db.update, eq: db.eq, select: db.select, single: db.single };
  db.from.mockReturnValue(chain);
  db.update.mockReturnValue(chain);
  db.eq.mockReturnValue(chain);
  db.select.mockReturnValue(chain);
});

describe("saved case editing", () => {
  it("keeps corrections available to retry when the existing access rules reject saving", async () => {
    db.single.mockResolvedValue({ data: null, error: new Error("Access denied") });
    openEditor();
    await waitFor(() => expect(screen.getByRole("button", { name: "Save changes" })).toBeEnabled());
    expect(screen.getByLabelText(/Clinical note/)).toHaveValue("Corrected");
  });

  it("updates the original note within its case rather than creating or relinking it", async () => {
    db.single.mockResolvedValue({ data: { id: "note-1" }, error: null });
    openEditor();
    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
    expect(db.from).toHaveBeenCalledWith("clinical_notes");
    expect(db.update).toHaveBeenCalledWith({ note: "Corrected" });
    expect(db.eq.mock.calls).toEqual([["id", "note-1"], ["injury_id", "case-1"]]);
  });
});