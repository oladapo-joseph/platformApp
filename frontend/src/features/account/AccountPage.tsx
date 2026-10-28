/** Account: built in P3d. Until then the route exists so navigation and guards can be tested. */
import { UserRound } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/feedback";

export default function AccountPage() {
  return (
    <>
      <PageHeader title="Account" />
      <Card>
        <EmptyState icon={UserRound} title="Coming in P3d">
          Your name, email, password and theme, and signing out everywhere.
        </EmptyState>
      </Card>
    </>
  );
}
