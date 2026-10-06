import { useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";
import {
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  ShieldCheck,
} from "lucide-react";
import { Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { EditablePhoto, PhotoAvatar } from "@/components/vito/Photo";
import { DEFAULT_QUICK_MENU_ITEMS, type QuickMenuItem } from "@/components/vito/QuickMenu";
import logo from "@/assets/vito-logo.png";

const STAFF = ["super_admin", "vito_admin", "clinical_professional", "clinical_supervisor"];
const ADMIN = ["super_admin", "vito_admin"];

/** Top bar shown on every signed-in page: logo · search · profile photo · menu. */
export function AppHeader({ user }: { user: User }) {
  const navigate = useNavigate();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const queryClient = useQueryClient();
  const { data, refetch } = useQuery({
    queryKey: ["app-header", user.id],
    queryFn: async () => {
      const [{ data: profile }, { data: roles }] = await Promise.all([
        supabase.from("profiles").select("full_name, avatar_path").eq("id", user.id).maybeSingle(),
        supabase.from("user_roles").select("role").eq("user_id", user.id),
      ]);
      const role = roles?.[0]?.role ?? "athlete";
      return { name: profile?.full_name ?? user.email ?? "", avatar: profile?.avatar_path ?? null, role };
    },
  });

  const items = useMemo<QuickMenuItem[]>(() => {
    const role = data?.role ?? "athlete";
    const nav: QuickMenuItem[] = [
      { key: "dashboard", label: "Dashboard", description: "Your overview", icon: LayoutDashboard, to: "/dashboard" },
    ];
    if (STAFF.includes(role)) nav.push({ key: "cases", label: "Case workspace", description: "Schools, athletes and cases", icon: ClipboardList, to: "/cases" });
    if (ADMIN.includes(role)) nav.push({ key: "admin", label: "Accounts & approvals", description: "Manage user access", icon: ShieldCheck, to: "/admin" });
    return [...nav, ...DEFAULT_QUICK_MENU_ITEMS];
  }, [data?.role]);

  function go(item: QuickMenuItem) {
    if (item.onSelect) return item.onSelect();
    if (item.to) return navigate({ to: item.to as never });
    toast(`${item.label} is coming soon`);
  }

  async function signOut() {
    await supabase.auth.signOut();
    navigate({ to: "/" });
  }

  return (
    <header className="sticky top-0 z-40 bg-foreground text-background shadow-sm print:hidden">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:gap-5 sm:px-5">
        <Link to="/dashboard" aria-label="VITO Physio home" className="shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/60">
          <img src={logo} alt="VITO Physio" className="size-10 rounded-lg bg-white object-contain p-0.5" />
        </Link>

        <HeaderSearch items={items} onPick={go} />

        <div className="ml-auto flex shrink-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            aria-label="Profile and settings"
            title={data?.name}
            className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/60"
          >
            <PhotoAvatar path={data?.avatar} name={data?.name} className="size-10 border-2 border-background/20 text-sm" />
          </button>

          <DropdownMenu modal={false}>
            <DropdownMenuTrigger
              aria-label="Open menu"
              className="inline-flex size-10 items-center justify-center rounded-md text-background/80 transition-colors hover:bg-background/10 hover:text-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/60 data-[state=open]:bg-background/15"
            >
              <Menu className="size-7" strokeWidth={2.25} />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={10} collisionPadding={12} className="w-64 max-w-[calc(100vw-1.5rem)] rounded-xl p-1.5">
              <DropdownMenuLabel className="flex items-center gap-2 px-2 py-2">
                <PhotoAvatar path={data?.avatar} name={data?.name} className="size-8" />
                <span className="min-w-0">
                  <span className="block truncate text-sm font-semibold">{data?.name}</span>
                  <span className="block truncate text-xs font-normal text-muted-foreground">{user.email}</span>
                </span>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              {items.map((item) => (
                <MenuRow key={item.key} icon={item.icon} label={item.label} soon={!item.to && !item.onSelect} onSelect={() => go(item)} />
              ))}
              <DropdownMenuSeparator />
              <MenuRow icon={Settings} label="Settings" onSelect={() => setSettingsOpen(true)} />
              <MenuRow icon={LogOut} label="Sign out" onSelect={signOut} />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription>Manage your profile and account.</DialogDescription>
          </DialogHeader>
          <div className="space-y-5">
            <EditablePhoto path={data?.avatar ?? null} name={data?.name ?? null} target="profile" targetId={user.id} onUpdated={() => { refetch(); queryClient.invalidateQueries({ queryKey: ["dashboard", user.id] }); }} label="Change profile picture" />
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
              <dt className="text-muted-foreground">Name</dt><dd className="font-medium">{data?.name}</dd>
              <dt className="text-muted-foreground">Email</dt><dd className="truncate font-medium">{user.email}</dd>
            </dl>
            <Button variant="outline" className="w-full" onClick={signOut}><LogOut className="mr-1 size-4" />Sign out</Button>
          </div>
        </DialogContent>
      </Dialog>
    </header>
  );
}

function MenuRow({ icon: Icon, label, soon, onSelect }: { icon: LucideIcon; label: string; soon?: boolean; onSelect: () => void }) {
  return (
    <DropdownMenuItem onSelect={onSelect} className="cursor-pointer gap-3 rounded-lg px-2 py-2">
      <Icon className="size-4 text-primary" />
      <span className="flex-1 text-sm">{label}</span>
      {soon && <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">Soon</span>}
    </DropdownMenuItem>
  );
}

/** Quick-jump search across the destinations available to the signed-in user. */
function HeaderSearch({ items, onPick }: { items: QuickMenuItem[]; onPick: (item: QuickMenuItem) => void }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const q = query.trim().toLowerCase();
  const matches = q
    ? items.filter((i) => `${i.label} ${i.description ?? ""}`.toLowerCase().includes(q))
    : items;

  function pick(item: QuickMenuItem) {
    setQuery("");
    setOpen(false);
    inputRef.current?.blur();
    onPick(item);
  }

  return (
    <form
      role="search"
      className="relative min-w-0 flex-1 sm:max-w-md"
      onSubmit={(e) => { e.preventDefault(); if (matches[0]) pick(matches[0]); }}
    >
      <Search className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-background/60" />
      <input
        ref={inputRef}
        type="search"
        value={query}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(e) => { if (e.key === "Escape") { setOpen(false); inputRef.current?.blur(); } }}
        placeholder="Search VitoPhysio…"
        aria-label="Search VitoPhysio"
        className="h-10 w-full rounded-lg border border-background/10 bg-background/10 pl-10 pr-3 text-sm text-background placeholder:text-background/60 focus:border-background/30 focus:bg-background/15 focus:outline-none"
      />
      {open && (
        <ul className="absolute left-0 right-0 top-full z-50 mt-2 max-h-80 overflow-auto rounded-xl border bg-popover p-1.5 text-popover-foreground shadow-lg">
          {matches.length ? matches.map((item) => {
            const Icon = item.icon;
            return (
              <li key={item.key}>
                <button
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => pick(item)}
                  className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left text-sm hover:bg-accent/10"
                >
                  <Icon className="size-4 shrink-0 text-primary" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium">{item.label}</span>
                    {item.description && <span className="block truncate text-xs text-muted-foreground">{item.description}</span>}
                  </span>
                </button>
              </li>
            );
          }) : <li className="px-3 py-2 text-sm text-muted-foreground">No results for “{query}”</li>}
        </ul>
      )}
    </form>
  );
}
