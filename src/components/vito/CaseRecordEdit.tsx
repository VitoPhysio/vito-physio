import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Pencil } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { SimpleForm } from "./SimpleForm";
import { CASE_EDIT_FIELDS, caseEditInitial, caseEditPayload, type EditableCaseTable } from "@/lib/case-editing";

export function CaseRecordEdit({ table, row, injuryId }: { table: EditableCaseTable; row: Record<string, unknown>; injuryId: string }) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const id = row["id"];
  if (typeof id !== "string") return null;
  return <>
    <Button size="sm" variant="outline" onClick={() => setOpen(true)} className="print:hidden"><Pencil className="mr-1 size-3.5" />Edit</Button>
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader><DialogTitle>Edit {table === "injuries" ? "case opening information" : table.replaceAll("_", " ")}</DialogTitle></DialogHeader>
        <SimpleForm key={id} fields={CASE_EDIT_FIELDS[table]} initial={caseEditInitial(table, row)} resetOnSuccess={false} submitLabel="Save changes" onSubmit={async (values) => {
          try {
            const result = table === "injuries"
              ? await supabase.from("injuries").update(caseEditPayload("injuries", values)).eq("id", id).select("id").single()
              : await supabase.from(table).update(caseEditPayload(table, values)).eq("id", id).eq("injury_id", injuryId).select("id").single();
            if (result.error) throw result.error;
            await Promise.all([qc.invalidateQueries({ queryKey: ["case-record", injuryId] }), qc.invalidateQueries({ queryKey: ["cases"] }), qc.invalidateQueries({ queryKey: ["dashboard"] })]);
            setOpen(false);
            toast.success("Changes saved.");
          } catch (error) { toast.error(error instanceof Error ? error.message : "Changes could not be saved."); }
        }} />
      </DialogContent>
    </Dialog>
  </>;
}