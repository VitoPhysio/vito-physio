import { ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export type WorkspaceMenu = { label: string; items: { label: string; value: string }[] };

export function WorkspaceMenus({ menus, value, onSelect }: { menus: WorkspaceMenu[]; value: string; onSelect: (value: string) => void }) {
  return <nav aria-label="Workspace sections" className="flex flex-wrap gap-2 border-b border-border pb-4 print:hidden">
    {menus.map((menu) => <DropdownMenu key={menu.label}>
      <DropdownMenuTrigger asChild><Button variant={menu.items.some((item) => item.value === value) ? "default" : "outline"}>{menu.label}<ChevronDown className="ml-2 size-4" /></Button></DropdownMenuTrigger>
      <DropdownMenuContent align="start">{menu.items.map((item) => <DropdownMenuItem key={item.value} onSelect={() => onSelect(item.value)} aria-current={item.value === value ? "page" : undefined}>{item.label}</DropdownMenuItem>)}</DropdownMenuContent>
    </DropdownMenu>)}
  </nav>;
}