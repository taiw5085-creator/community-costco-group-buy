"use client";

import { useEffect, useState } from "react";
import { formatDeadline, isClosed } from "@/lib/calculations";

export function useCountdown(closeAt: string) {
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  return {
    now,
    isClosed: isClosed(closeAt, now),
    countdown: formatDeadline(closeAt, now),
    closeLabel: formatDeadline(closeAt, now)
  };
}
