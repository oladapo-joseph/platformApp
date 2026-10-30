/**
 * App shell (docs/06 §4): < 768 top bar + bottom nav · 768–1023 icon rail · ≥ 1024 240 px sidebar.
 * Skip link, landmarks, aria-current on the active page. Also owns the session-ended redirect
 * (US-1.9) and the legacy "add your email" banner (US-1.7).
 */
import { useQueryClient } from "@tanstack/react-query";
import { CandlestickChart, Newspaper, Shield, Star, UserRound, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useMatches, useNavigate } from "react-router";

import { useAdminSummary } from "@/api/admin";
import { meKey, useMe } from "@/api/auth";
import { onSessionEnded } from "@/api/client";
import { useMarketStatus } from "@/api/market";
import { SymbolSearch } from "@/components/search/SymbolSearch";
import { Banner } from "@/components/ui/feedback";
import { Logo } from "@/components/ui/Logo";
import { FreshnessStamp } from "@/components/ui/market";
import { Toaster } from "@/components/ui/Toaster";
import { pageView, routeTemplate, startTracking } from "@/lib/analytics";
import { cn } from "@/lib/cn";
import { applyTheme, savedTheme, type ThemeChoice } from "@/lib/theme";

import { UserMenu } from "./UserMenu";

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  adminOnly?: boolean;
  /** Things waiting for a decision (the Admin item: new requests and suspicious sign-ins) */
  badge?: number;
  /** The badge is red only for something that may be wrong (suspicious sign-ins); new requests are brand */
  alarm?: boolean;
}

const NAV: NavItem[] = [
  { to: "/app/market", label: "Market", icon: CandlestickChart },
  { to: "/app/news", label: "News", icon: Newspaper },
  { to: "/app/watchlist", label: "Watchlist", icon: Star },
  { to: "/app/account", label: "Account", icon: UserRound },
  { to: "/app/admin", label: "Admin", icon: Shield, adminOnly: true },
];

function useSessionEndedRedirect() {
  const navigate = useNavigate();
  const location = useLocation();
  const qc = useQueryClient();
  useEffect(
    () =>
      onSessionEnded(() => {
        qc.clear();
        qc.setQueryData(meKey, null);
        const next = encodeURIComponent(location.pathname + location.search);
        void navigate(`/login?next=${next}&reason=expired`, { replace: true });
      }),
    [navigate, location, qc],
  );
}

function SideNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Main"
      className="sticky top-0 hidden h-dvh shrink-0 flex-col gap-1.5 border-r border-line-subtle bg-nav p-3 md:flex md:w-(--layout-sidebar-w-collapsed) lg:w-(--layout-sidebar-w) lg:p-4"
    >
      <Link to="/app/market" className="mb-5 flex h-10 items-center justify-center rounded-md lg:justify-start lg:px-2">
        <span className="lg:hidden">
          <Logo variant="mark" />
        </span>
        <span className="hidden lg:block">
          <Logo />
        </span>
      </Link>
      {items.map(({ to, label, icon: Icon, badge, alarm }) => (
        <NavLink
          key={to}
          to={to}
          title={label}
          className={({ isActive }) =>
            cn(
              "flex h-11 items-center justify-center gap-3 rounded-xl text-sm font-medium transition-colors duration-(--duration-instant) lg:justify-start lg:px-3",
              isActive
                ? "bg-selected text-fg shadow-[inset_0_0_0_1px_var(--color-brand-glow),0_0_24px_var(--color-brand-glow)] [&_svg]:text-brand"
                : "text-fg-2 hover:bg-hover hover:text-fg",
            )
          }
        >
          <span className="relative">
            <Icon aria-hidden className="size-5 shrink-0" />
            {!!badge && (
              <span
                aria-hidden
                className={cn(
                  "absolute -top-1 -right-1 size-2 rounded-full lg:hidden",
                  alarm ? "bg-danger" : "bg-brand",
                )}
              />
            )}
          </span>
          <span className="sr-only lg:not-sr-only">{label}</span>
          {!!badge && (
            <span
              className={cn(
                "num ml-auto rounded-full px-1.5 text-xs font-semibold max-lg:sr-only",
                alarm ? "bg-danger-subtle text-danger" : "bg-brand-subtle text-brand",
              )}
            >
              {badge}
              <span className="sr-only"> waiting</span>
            </span>
          )}
        </NavLink>
      ))}
      <MarketPulse />
    </nav>
  );
}

/** Sidebar footer: whether NGX is trading right now (desktop only; the top bar has the data stamp). */
function MarketPulse() {
  const { data } = useMarketStatus();
  if (!data) return null;
  const open = data.is_trading_hours;
  return (
    <div className="mt-auto hidden rounded-lg bg-surface p-3.5 shadow-elev-1 lg:block">
      <p className="text-xs text-fg-muted">NGX market</p>
      <p className="mt-1 flex items-center gap-2 text-sm font-medium text-fg">
        <span
          aria-hidden
          className={cn("size-2 rounded-full", open ? "bg-brand shadow-[0_0_10px_var(--color-brand)]" : "bg-warning")}
        />
        {open ? "Open · 10:00–14:30 WAT" : "Closed"}
      </p>
    </div>
  );
}

function BottomNav({ items }: { items: NavItem[] }) {
  return (
    <nav
      aria-label="Main"
      className="fixed inset-x-0 bottom-0 z-(--z-sticky) grid h-(--layout-bottomnav-h) grid-cols-4 border-t border-line-subtle bg-nav/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
    >
      {items.slice(0, 4).map(({ to, label, icon: Icon }) => (
        <NavLink
          key={to}
          to={to}
          className={({ isActive }) =>
            cn(
              "group flex flex-col items-center justify-center gap-1 text-xs font-medium",
              isActive ? "text-fg [&_svg]:text-brand" : "text-fg-muted hover:text-fg",
            )
          }
        >
          {({ isActive }) => (
            <>
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors duration-(--duration-instant)",
                  isActive && "bg-selected",
                )}
              >
                <Icon aria-hidden className="size-5" />
              </span>
              {label}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
}

function TopBar() {
  return (
    <header className="sticky top-0 z-(--z-sticky) flex h-(--layout-topbar-h) items-center gap-3 border-b border-line-subtle bg-canvas/80 px-4 backdrop-blur-md md:px-6 lg:px-8">
      <Link to="/app/market" className="md:hidden" aria-label="EquityLensNG home">
        <Logo variant="mark" />
      </Link>
      <SymbolSearch />
      <div className="ml-auto flex min-w-0 items-center gap-3">
        <FreshnessStamp className="min-w-0 truncate" />
        <UserMenu />
      </div>
    </header>
  );
}

const DISMISS_KEY = "el-email-banner-dismissed";

/** US-1.7: info style, non-blocking, back each session until an email is confirmed. */
function AddEmailBanner() {
  const { data: me } = useMe();
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });
  if (!me?.needs_email || dismissed) return null;
  const dismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* fine: it just returns on the next page load */
    }
  };
  return (
    <Banner
      tone="info"
      title={me.pending_email ? `Confirm ${me.pending_email}` : "Add your email to secure your account"}
      action={
        <button type="button" onClick={dismiss} className="text-sm font-medium text-fg-2 hover:text-fg">
          Not now
        </button>
      }
      className="mb-6"
    >
      {me.pending_email ? (
        "We sent a confirmation link. Open it to finish."
      ) : (
        <>
          So you can reset your password if you forget it.{" "}
          <Link to="/app/account#email" className="font-medium text-fg underline underline-offset-2">
            Add email
          </Link>
        </>
      )}
    </Banner>
  );
}

/** Usage analytics (US-7.8): on while signed in unless the account turned it off; a page view per screen. */
function useUsageTracking(user: string | undefined, allowed: boolean | undefined) {
  const matches = useMatches();
  const last = matches[matches.length - 1];
  const path = last ? routeTemplate(last.pathname, last.params) : null;
  const symbol = last?.params.symbol?.toUpperCase();
  useEffect(() => (user ? startTracking(user, allowed !== false) : undefined), [user, allowed]);
  useEffect(() => {
    if (user && path) pageView(path, symbol ? { symbol } : {});
  }, [user, allowed, path, symbol]);
}

/** The account's theme wins over this browser's, so a choice made on another device follows (US-6.2). */
function useAccountTheme(theme: ThemeChoice | undefined) {
  useEffect(() => {
    if (theme && theme !== savedTheme()) applyTheme(theme);
  }, [theme]);
}

export function AppShell() {
  const { data: me } = useMe();
  useSessionEndedRedirect();
  useAccountTheme(me?.theme);
  useUsageTracking(me?.id, me?.usage_analytics);
  const isAdmin = me?.role === "admin";
  const { data: summary } = useAdminSummary(isAdmin);
  const waiting = (summary?.access_requests ?? 0) + (summary?.suspicious ?? 0);
  const alarm = (summary?.suspicious ?? 0) > 0;
  const items = NAV.filter((i) => !i.adminOnly || isAdmin).map((i) =>
    i.adminOnly ? { ...i, badge: waiting, alarm } : i,
  );
  return (
    <div className="flex min-h-dvh">
      <a
        href="#main"
        className="sr-only z-(--z-toast) rounded-md bg-brand px-4 py-2 text-on-brand focus:not-sr-only focus:fixed focus:top-2 focus:left-2"
      >
        Skip to content
      </a>
      <SideNav items={items} />
      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar />
        <main
          id="main"
          tabIndex={-1}
          className="mx-auto w-full max-w-(--layout-content-max) flex-1 px-4 py-6 pb-[calc(var(--layout-bottomnav-h)+24px)] md:px-6 md:pb-8 lg:px-8"
        >
          <AddEmailBanner />
          <Outlet />
        </main>
      </div>
      <BottomNav items={items} />
      <Toaster />
    </div>
  );
}
