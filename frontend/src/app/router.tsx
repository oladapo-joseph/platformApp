import type { ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router";

import { meQuery } from "@/api/auth";
import { historyQuery, previousSnapshotQuery, snapshotQuery, statusQuery, topStoriesQuery } from "@/api/market";
import { watchlistOverviewQuery, watchlistQuery } from "@/api/watchlist";
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
  void queryClient.prefetchQuery(statusQuery); // public
  void session.then((me) => {
    if (!me) return;
    void queryClient.prefetchQuery(historyQuery(20));
    void queryClient.prefetchQuery(topStoriesQuery(q.get("sector")));
    // the previous trading day: on a first load index.html's boot script has already asked for it
    // (off /market/status), so this, after the snapshot, only adds it for in-app navigation
    void queryClient
      .fetchQuery(snapshotQuery())
      .then((s) => queryClient.prefetchQuery(previousSnapshotQuery(s.trade_date)))
      .catch(() => undefined);
  });
}

function watchlist(q: URLSearchParams, session: Promise<unknown>) {
  const period = q.get("period");
  void session.then(
    (me) =>
      me &&
      queryClient.prefetchQuery(
        watchlistOverviewQuery(
          period === "1W" || period === "3M" || period === "YTD" ? period : "1M",
          q.get("strategy") ?? undefined,
        ),
      ),
  );
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
        // the session check, then the watchlist every ☆ reads
        ...prefetch((_q, session) => {
          void session.then((me) => me && queryClient.prefetchQuery(watchlistQuery));
        }),
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/app/market" replace /> },
              { path: "market", lazy: page(() => import("@/features/market/MarketPage")), ...prefetch(marketToday) },
              { path: "stocks", lazy: page(() => import("@/features/stock/StockPage")) },
              { path: "stocks/:symbol", lazy: page(() => import("@/features/stock/StockPage")) },
              { path: "news", lazy: page(() => import("@/features/news/NewsPage")) },
              {
                path: "watchlist",
                lazy: page(() => import("@/features/watchlist/WatchlistPage")),
                ...prefetch(watchlist),
              },
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
