import posthog from "posthog-js";

const POSTHOG_KEY = import.meta.env.VITE_POSTHOG_KEY as string | undefined;
const POSTHOG_HOST = (import.meta.env.VITE_POSTHOG_HOST as string) || "https://eu.i.posthog.com";

let initialized = false;

export function initPostHog() {
  if (initialized || typeof window === "undefined" || !POSTHOG_KEY) return;

  posthog.init(POSTHOG_KEY, {
    api_host: POSTHOG_HOST,
    autocapture: false,
    capture_pageview: false,
    capture_pageleave: true,
    capture_exceptions: true,
    persistence: "localStorage+cookie",
  });

  initialized = true;
}

export function identifyUser(user: { id: string; name: string; email?: string }) {
  if (!initialized) return;
  posthog.identify(user.id, {
    name: user.name,
    email: user.email,
  });
}

export function resetUser() {
  if (!initialized) return;
  posthog.reset();
}

export function trackPageView(path: string) {
  if (!initialized) return;
  posthog.capture("$pageview", { $current_url: window.location.origin + path });
}

export function trackEvent(event: string, properties?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.capture(event, properties);
}

export function captureException(error: Error, context?: Record<string, unknown>) {
  if (!initialized) return;
  posthog.captureException(error, context);
}
