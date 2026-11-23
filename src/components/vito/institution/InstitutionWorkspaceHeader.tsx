import { ArrowLeftRight, Check, Plus, ShieldCheck, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { PhotoAvatar } from "@/components/vito/Photo";
import { INSTITUTION_ROLE_LABEL, INSTITUTION_TYPE_LABEL, type InstitutionRole } from "@/lib/institution";

type InstitutionIdentity = {
  id: string;
  name: string;
  logo_path: string | null;
  school_type: string;
  district: string | null;
  location: string | null;
  role: string;
  verification_status: string;
};

export function InstitutionWorkspaceHeader({ institution, institutions, onSwitch, onAdd }: {
  institution: InstitutionIdentity;
  institutions: { id: string; name: string }[];
  onSwitch: (id: string) => void;
  onAdd: () => void;
}) {
  const verified = institution.verification_status === "verified";
  const status = verified ? "Verified institution" : "Institution verification pending";
  const StatusIcon = verified ? ShieldCheck : ShieldAlert;

  return (
    <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border pb-5">
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
        <PhotoAvatar path={institution.logo_path} name={institution.name} className="size-10 sm:size-12" />
        <div className="min-w-0 space-y-1.5">
          <h1 className="text-xl font-bold leading-snug [overflow-wrap:anywhere] sm:text-2xl">{institution.name}</h1>
          <p className="text-xs leading-relaxed text-muted-foreground [overflow-wrap:anywhere]">
            {INSTITUTION_TYPE_LABEL[institution.school_type] ?? institution.school_type}
            {institution.district || institution.location ? ` · ${institution.district || institution.location}` : ""}
          </p>
          <div className="flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
            <span className="min-w-0 [overflow-wrap:anywhere]">{INSTITUTION_ROLE_LABEL[institution.role as InstitutionRole] ?? institution.role}</span>
            <span title={status} aria-label={status} className="shrink-0 pt-0.5">
              <StatusIcon className="size-3.5" />
            </span>
          </div>
        </div>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="shrink-0" aria-label="Switch institution" title="Switch institution">
            <ArrowLeftRight className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-72 max-w-[calc(100vw-2rem)]">
          <DropdownMenuLabel>My institutions</DropdownMenuLabel>
          {institutions.map((item) => (
            <DropdownMenuItem key={item.id} onSelect={() => onSwitch(item.id)} aria-current={item.id === institution.id ? "true" : undefined} className="items-start py-2">
              <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{item.name}</span>
              {item.id === institution.id && <Check className="mt-0.5 shrink-0 text-primary" />}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem onSelect={onAdd}><Plus />Join or register another</DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  );
}
