import type { ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router";

import { AppShell } from "@/components/layout/AppShell";

import { RequireAdmin, RequireUser, SignedOutOnly } from "./guards";
import { NotFound, RouteError } from "./RouteError";

/** Each screen is its own chunk, so the first load stays small (P3 criterion 3). */
const page = (load: () => Promise<{ default: ComponentType }>) => async () => ({ Component: (await load()).default });

export const router = createBrowserRouter([
  {
    errorElement: <RouteError />,
    // shown while the first lazily loaded screen arrives
    hydrateFallbackElement: <div aria-busy className="min-h-dvh bg-canvas" />,
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
        children: [
          {
            element: <AppShell />,
            children: [
              { index: true, element: <Navigate to="/app/market" replace /> },
              { path: "market", lazy: page(() => import("@/features/market/MarketPage")) },
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
