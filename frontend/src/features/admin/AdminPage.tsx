/** Admin: built in P4. Until then the route exists so navigation and guards can be tested. */
import { Shield } from "lucide-react";

import { PageHeader } from "@/components/layout/PageHeader";
import { Card, EmptyState } from "@/components/ui/feedback";

export default function AdminPage() {
  return (
    <>
      <PageHeader title="Admin" />
      <Card>
        <EmptyState icon={Shield} title="Coming in P4">
          Invites, access requests, users and data health.
        </EmptyState>
      </Card>
    </>
  );
}
