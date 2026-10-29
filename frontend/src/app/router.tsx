import type { ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router";

import { meQuery } from "@/api/auth";
import { historyQuery, previousSnapshotQuery, snapshotQuery, statusQuery, topStoriesQuery } from "@/api/market";
import { AppShell } from "@/components/layout/AppShell";
import { Logo } from "@/components/ui/Logo";

import { RequireAdmin, RequireUser, SignedOutOnly } from "./guards";
import { queryClient } from "./queryClient";
import { NotFound, RouteError } from "./RouteError";

/** Each screen is its own chunk, so the first load stays small (P3 criterion 3). */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

// Prefetch (P3 criterion 3): a screen's first requests start as soon as its URL matches, alongside
// its code, instead of one after another as components mount. Loaders never wait on them, and the
// hooks read the same cache. Private data waits for the session check, so a signed-out visitor
// only sends /auth/me (and public requests).
const signedIn = () => queryClient.ensureQueryData(meQuery).catch(() => null);
const prefetch = (load: (q: URLSearchParams, session: Promise<unknown>) => void) => ({
  loader: ({ request }: { request: Request }) => {
    load(new URL(request.url).searchParams, signedIn());
    return null;
  },
  shouldRevalidate: () => false, // only on entering the screen, not on every filter change
});

function marketToday(q: URLSearchParams, session: Promise<unknown>) {
  if (q.get("start")) return; // a period: the range request is cheap and doesn't chain
  // public, and it names the latest session, so the session before it needn't wait for the snapshot
  const status = queryClient.fetchQuery(statusQuery).catch(() => null);
  void session.then((me) => {
    if (!me) return;
    void queryClient.prefetchQuery(snapshotQuery());
    void queryClient.prefetchQuery(historyQuery(20));
    void queryClient.prefetchQuery(topStoriesQuery(q.get("sector")));
    void status.then((s) => {
      if (s?.latest_trade_date) void queryClient.prefetchQuery(previousSnapshotQuery(s.latest_trade_date));
    });
  });
}

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    // shown while the first lazily loaded screen arrives: the same frame index.html paints
    hydrateFallbackElement: (
      <div aria-busy className="boot">
        <Logo variant="mark" className="[&_img]:size-14" />
        <span className="sr-only">Loading EquityLensNG</span>
      </div>
    ),
    children: [
      { path: "/", lazy: page(() => import("@/features/landing/LandingPage")) },
      { path: "/terms", lazy: page(() => import("@/features/landing/TermsPage")) },
      {
        element: <SignedOutOnly />,
        children: [
          { path: "/login", lazy: page(() => import("@/features/auth/LoginPage")) },
          { path: "/forgot", lazy: page(() => import("@/features/auth/ForgotPage")) },
          { path: "/request-invite", lazy: page(() => import("@/features/auth/RequestInvitePage")) },
          { path: "/signup", lazy: page(() => import("@/features/auth/SignupPage")) },
        ],
      },
      // token links work whether or not someone is signed in
      { path: "/reset", lazy: page(() => import("@/features/auth/ResetPage")) },
      { path: "/verify", lazy: page(() => import("@/features/auth/VerifyPage")) },
      { path: "/invite", lazy: page(() => import("@/features/auth/InvitePage")) },
      {
        path: "/app",
        element: <RequireUser />,
        ...prefetch(() => undefined), // starts the session check
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/app/market" replace /> },
              { path: "market", lazy: page(() => import("@/features/market/MarketPage")), ...prefetch(marketToday) },
              { path: "stocks", lazy: page(() => import("@/features/stock/StockPage")) },
              { path: "stocks/:symbol", lazy: page(() => import("@/features/stock/StockPage")) },
              { path: "news", lazy: page(() => import("@/features/news/NewsPage")) },
              { path: "watchlist", lazy: page(() => import("@/features/watchlist/WatchlistPage")) },
              { path: "account", lazy: page(() => import("@/features/account/AccountPage")) },
              {
                element: <RequireAdmin />,
                children: [{ path: "admin", lazy: page(() => import("@/features/admin/AdminPage")) }],
              },
              { path: "*", element: <NotFound /> },
            ],
          },
        ],
      },
      { path: "*", element: <NotFound /> },
    ],
  },
]);
