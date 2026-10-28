/** News: built in P3d. Until then the route exists so navigation and guards can be tested. */
import { Newspaper } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/feedback";

export default function NewsPage() {
  return (
    <>
      <PageHeader title="News" />
      <Card>
        <EmptyState icon={Newspaper} title="Coming in P3d">
          Every headline, filterable by stock, sector, topic and source.
        </EmptyState>
      </Card>
    </>
  );
}
