import { useEffect, useState } from "react";
import type { FieldValues, Path, UseFormSetError } from "react-hook-form";
import { z } from "zod";

import { ApiError } from "@/api/client";

/**
 * Email links carry their token in the fragment (#token=…), which browsers never send to a
 * server. Read it once, then drop it from the address bar and history (docs/12 §6).
 */
export function useHashToken(): string | null {
  const [token] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("token"));
  useEffect(() => {
    if (window.location.hash.includes("token=")) {
      window.history.replaceState(window.history.state, "", window.location.pathname + window.location.search);
    }
  }, []);
  return token;
}

export const MIN_PASSWORD = 10;

/** Same rule as the server (≥ 10, ≤ 128); the common-password and name checks stay server-side. */
export const newPassword = z
  .string()
  .min(MIN_PASSWORD, `Use at least ${MIN_PASSWORD} characters.`)
  .max(128, "Use at most 128 characters.");

export const email = z.email("Enter a valid email address.").max(254);

/** A hint that updates as you type (US-1.3). Length is what matters most; no composition rules. */
export function passwordHint(value: string): string {
  if (!value) return `At least ${MIN_PASSWORD} characters. A short phrase of unrelated words works well.`;
  if (value.length < MIN_PASSWORD) return `${value.length} of ${MIN_PASSWORD} characters`;
  if (value.length < 14) return "Long enough. A few more characters make it stronger.";
  return "Good length.";
}

/**
 * Put a server error where it belongs: on its field when the API names one, else as a
 * form-level message. Returns the message for the form-level summary.
 */
export function applyServerError<T extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<T>,
  fields: readonly Path<T>[],
  fieldMap: Record<string, Path<T>> = {},
): string | null {
  if (!(error instanceof ApiError)) return error instanceof Error ? error.message : "Something went wrong.";
  const target = error.field ? (fieldMap[error.field] ?? (error.field as Path<T>)) : undefined;
  if (target && fields.includes(target)) {
    setError(target, { type: "server", message: error.detail }, { shouldFocus: true });
    return null;
  }
  return error.detail;
}
