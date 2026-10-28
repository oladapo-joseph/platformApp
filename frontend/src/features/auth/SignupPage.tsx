/** Self-serve sign-up is off while EquityLensNG is invite-only (ADR-013): point to the request form. */
import { Link } from "react-router";

import { AuthLayout, textLink } from "@/components/layout/AuthLayout";
import { buttonClass } from "@/components/ui/buttonClass";

export default function SignupPage() {
  return (
    <AuthLayout
      title="EquityLensNG is invite-only for now"
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className={textLink}>
            Sign in
          </Link>
        </>
      }
    >
      <p className="text-sm text-fg-2">
        Tell us a little about yourself and the team will email you when a place opens.
      </p>
      <Link to="/request-invite" className={buttonClass("primary", "lg", "mt-6 w-full")}>
        Request an invite
      </Link>
    </AuthLayout>
  );
}
