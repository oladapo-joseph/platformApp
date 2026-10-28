import { QueryClientProvider } from "@tanstack/react-query";
import { Tooltip } from "radix-ui";
import type { ReactNode } from "react";

import { queryClient } from "./queryClient";

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <Tooltip.Provider delayDuration={300}>{children}</Tooltip.Provider>
    </QueryClientProvider>
  );
}
