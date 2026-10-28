/** Watchlist: built in P4. Until then the route exists so navigation and guards can be tested. */
import { Star } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/feedback";

export default function WatchlistPage() {
  return (
    <>
      <PageHeader title="Watchlist" />
      <Card>
        <EmptyState icon={Star} title="Coming in P4">
          The stocks you follow, with their latest moves and news.
        </EmptyState>
      </Card>
    </>
  );
}
