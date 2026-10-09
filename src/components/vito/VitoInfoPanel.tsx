import { ChevronDown, Mail, Moon, Phone, Sun } from "lucide-react";
import { useEffect, useState } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import logo from "@/assets/vito-logo.png";
import { applyTheme, getStoredTheme, type ThemeMode } from "@/lib/theme";
import { cn } from "@/lib/utils";

const ABOUT = [
  "Vito Physio was born from a gap that too many young athletes in Uganda know well. After a match or a hard training session, an injury often meets little more than rest and hope. Records are thin or missing. Recovery is left to chance. Return to sport is guessed rather than guided. The result is familiar: lingering pain, re-injury, lost places on the team, and talent that quietly fades.",
  "The idea grew from people who had lived that cycle. They had competed in school sport, seen teammates struggle after demanding seasons, and in some cases carried the effects of poorly managed injuries themselves. They saw that the problem was not a lack of care in principle, but the absence of a clear pathway that stayed with the athlete from the moment of injury until a safe return to play.",
  "Vito Physio set out to close that gap. It brings together a practical digital system for recording and following injuries with mobile physiotherapy delivered at the school, using portable professional equipment. The work is designed for secondary schools in places such as Kampala, Mukono and Wakiso, where sport is intense and structured support is still rare. Coaches and teachers gain simple tools. Athletes gain a recovery plan. Schools gain a way to protect their teams without building a full clinic.",
  "The vision is straightforward: every athlete should be able to move from injury to return with clarity, care and dignity. That is the story Vito Physio continues to build.",
];

export function VitoInfoPanel({
  triggerClassName,
  imageClassName,
  label = "Open Vito Physio information",
}: {
  triggerClassName?: string;
  imageClassName?: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const [aboutOpen, setAboutOpen] = useState(false);
  const [contactsOpen, setContactsOpen] = useState(false);
  const [theme, setTheme] = useState<ThemeMode>("light");

  useEffect(() => {
    const initial = getStoredTheme();
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggleTheme() {
    const next: ThemeMode = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          aria-label={label}
          title={label}
          className={cn(
            "shrink-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-background/60",
            triggerClassName,
          )}
        >
          <img
            src={logo}
            alt="VITO Physio"
            className={cn("size-10 rounded-lg bg-card object-contain p-0.5", imageClassName)}
          />
        </button>
      </SheetTrigger>
      <SheetContent
        side="right"
        className="h-screen w-[min(92vw,760px)] max-w-none overflow-y-auto border-l border-primary/20 bg-background p-0 text-foreground shadow-2xl sm:w-[min(78vw,760px)] [&>button]:text-white"
      >
        <div className="relative min-h-full overflow-hidden bg-background px-6 py-8 sm:px-10 sm:py-10">
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 top-0 h-56 bg-brand-gradient opacity-95"
          />
          <SheetHeader className="relative pr-10 text-left">
            <div className="flex items-center justify-between gap-4">
              <img
                src={logo}
                alt="VITO Physio logo"
                className="size-20 rounded-2xl bg-brand-gradient object-contain p-1 shadow-glow sm:size-24"
              />
            </div>
            <SheetTitle className="mt-6 text-3xl font-black tracking-tight text-white sm:text-4xl">
              From Injury to Return
            </SheetTitle>
            <SheetDescription className="mt-2 text-base font-semibold text-white/90">
              Connected sports physiotherapy care for athletes, schools, academies and clubs.
            </SheetDescription>
          </SheetHeader>

          <div className="relative mt-8 space-y-3 border-t border-primary/15 pt-7">
            <section className="overflow-hidden rounded-2xl border border-primary/15 bg-background">
              <button
                type="button"
                aria-expanded={aboutOpen}
                aria-controls="vito-about-panel"
                onClick={() => setAboutOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
              >
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                  About Vito Physio
                </span>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-primary transition-transform duration-300",
                    aboutOpen && "rotate-180",
                  )}
                />
              </button>
              <div
                id="vito-about-panel"
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                  aboutOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="space-y-5 border-t border-primary/10 px-5 py-5 text-sm leading-7 text-muted-foreground sm:px-6 sm:text-base">
                    {ABOUT.map((paragraph) => (
                      <p key={paragraph}>{paragraph}</p>
                    ))}
                  </div>
                </div>
              </div>
            </section>

            <section className="overflow-hidden rounded-2xl border border-primary/15 bg-background">
              <button
                type="button"
                aria-expanded={contactsOpen}
                aria-controls="vito-contacts-panel"
                onClick={() => setContactsOpen((current) => !current)}
                className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left transition hover:bg-primary/5 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-ring"
              >
                <span className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                  Contact Vito Physio
                </span>
                <ChevronDown
                  className={cn(
                    "size-5 shrink-0 text-primary transition-transform duration-300",
                    contactsOpen && "rotate-180",
                  )}
                />
              </button>
              <div
                id="vito-contacts-panel"
                className={cn(
                  "grid transition-[grid-template-rows,opacity] duration-300 ease-out",
                  contactsOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                )}
              >
                <div className="min-h-0 overflow-hidden">
                  <div className="grid gap-3 border-t border-primary/10 px-5 py-5 text-sm sm:grid-cols-2 sm:px-6">
                    <a
                      href="https://wa.me/256774234739"
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-3 rounded-xl border bg-background px-3 py-3 font-semibold transition hover:border-accent/60 hover:text-primary"
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-accent/15 text-accent">
                        W
                      </span>
                      WhatsApp +256 774 234 739
                    </a>
                    <a
                      href="tel:+256709120930"
                      className="flex items-center gap-3 rounded-xl border bg-background px-3 py-3 font-semibold transition hover:border-accent/60 hover:text-primary"
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
                        <Phone className="size-4" />
                      </span>
                      Phone +256 709 120 930
                    </a>
                    <a
                      href="mailto:vitophysio256@gmail.com"
                      className="flex items-center gap-3 rounded-xl border bg-background px-3 py-3 font-semibold transition hover:border-accent/60 hover:text-primary sm:col-span-2"
                    >
                      <span className="grid size-9 place-items-center rounded-full bg-primary/10 text-primary">
                        <Mail className="size-4" />
                      </span>
                      vitophysio256@gmail.com
                    </a>
                  </div>
                </div>
              </div>
            </section>

            <div className="flex items-center justify-between gap-4 rounded-2xl border border-primary/15 bg-background p-4">
              <div>
                <p className="font-bold">Appearance</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Switch between light and dark mode.
                </p>
              </div>
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} mode`}
                className="inline-flex shrink-0 items-center gap-2 rounded-full border border-primary/20 bg-background px-4 py-2 text-sm font-semibold text-primary transition hover:border-accent hover:text-accent focus:outline-none focus:ring-2 focus:ring-ring"
              >
                {theme === "dark" ? <Sun className="size-4" /> : <Moon className="size-4" />}
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
