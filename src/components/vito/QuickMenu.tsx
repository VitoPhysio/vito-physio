import type { LucideIcon } from "lucide-react";
import { Bell, BookOpen, FolderOpen, LayoutGrid, LifeBuoy, MessageSquare } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

export type QuickMenuItem = {
  key: string;
  label: string;
  description?: string;
  icon: LucideIcon;
  /** Route path to navigate to. Leave unset while the feature is not built yet. */
  to?: string;
  /** Custom action; takes precedence over `to`. */
  onSelect?: () => void;
};

/** Placeholder entries — set `to` (or `onSelect`) as each feature ships. */
export const DEFAULT_QUICK_MENU_ITEMS: QuickMenuItem[] = [
  { key: "messages", label: "Messages", description: "Conversations with your team", icon: MessageSquare },
  { key: "blogs", label: "Blogs", description: "News and articles", icon: BookOpen },
  { key: "notifications", label: "Notifications", description: "Updates and alerts", icon: Bell },
  { key: "resources", label: "Resources", description: "Guides and documents", icon: FolderOpen },
  { key: "help", label: "Help", description: "Support and FAQs", icon: LifeBuoy },
];

export function QuickMenu({
  items = DEFAULT_QUICK_MENU_ITEMS,
  label = "Quick menu",
  className,
}: {
  items?: QuickMenuItem[];
  label?: string;
  className?: string;
}) {
  const navigate = useNavigate();

  function handleSelect(item: QuickMenuItem) {
    if (item.onSelect) return item.onSelect();
    if (item.to) return navigate({ to: item.to as never });
    toast(`${item.label} is coming soon`);
  }

  return (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger
        aria-label={label}
        title={label}
        className={cn(
          "inline-flex size-9 items-center justify-center rounded-md bg-primary-foreground/10 text-primary-foreground ring-1 ring-primary-foreground/20 transition-all duration-200",
          "hover:bg-primary-foreground/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-foreground/60",
          "data-[state=open]:bg-primary-foreground/25 [&[data-state=open]>svg]:rotate-45",
          className,
        )}
      >
        <LayoutGrid className="size-4 transition-transform duration-200" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={8}
        collisionPadding={12}
        className="w-64 max-w-[calc(100vw-1.5rem)] rounded-xl p-1.5 duration-150"
      >
        <DropdownMenuLabel className="px-2 pb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {label}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {items.map((item) => {
          const Icon = item.icon;
          const ready = Boolean(item.to || item.onSelect);
          return (
            <DropdownMenuItem
              key={item.key}
              onSelect={() => handleSelect(item)}
              className="group cursor-pointer gap-3 rounded-lg px-2 py-2 transition-colors"
            >
              <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-secondary text-primary transition-colors group-focus:bg-primary group-focus:text-primary-foreground">
                <Icon />
              </span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="text-sm font-medium">{item.label}</span>
                {item.description && (
                  <span className="truncate text-xs text-muted-foreground">{item.description}</span>
                )}
              </span>
              {!ready && (
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground">
                  Soon
                </span>
              )}
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
