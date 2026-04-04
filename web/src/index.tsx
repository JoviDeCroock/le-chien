import { render } from "preact";
import {
  LocationProvider,
  Router,
  Route,
  hydrate,
  prerender as ssr,
  lazy,
  useLocation,
} from "preact-iso";
import { useEffect, useErrorBoundary } from "preact/hooks";
import { initPostHog, trackPageView, captureException } from "./lib/posthog";

import "./style.css";

const Landing = lazy(() => import("./pages/Landing/index").then((module) => module.Landing));
const Chat = lazy(() => import("./pages/Chat/index").then((module) => module.Chat));
const Auth = lazy(() => import("./pages/Auth/index").then((module) => module.Auth));
const Billing = lazy(() => import("./pages/Billing/index").then((module) => module.Billing));
const NotFound = lazy(() => import("./pages/_404").then((module) => module.NotFound));

function PageViewTracker() {
  const { path } = useLocation();
  useEffect(() => {
    trackPageView(path);
  }, [path]);
  return null;
}

function AppContent() {
  const [error, resetError] = useErrorBoundary((err) => {
    captureException(err instanceof Error ? err : new Error(String(err)), { source: "boundary" });
  });

  if (error) {
    return (
      <div class="bg-neutral-950 min-h-screen flex items-center justify-center">
        <div class="bg-neutral-900 border border-neutral-700 rounded-lg p-8 max-w-md text-center">
          <h1 class="text-white text-lg font-semibold mb-2">Something went wrong</h1>
          <p class="text-neutral-400 text-sm mb-4">An unexpected error occurred.</p>
          <button
            onClick={resetError}
            class="bg-violet-600 hover:bg-violet-500 text-white px-4 py-2 rounded-lg text-sm transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div class="bg-neutral-950 min-h-screen">
      <PageViewTracker />
      <main>
        <Router>
          <Route path="/" component={Landing} />
          <Route path="/chat" component={Chat} />
          <Route path="/auth" component={Auth} />
          <Route path="/billing" component={Billing} />
          <Route default component={NotFound} />
        </Router>
      </main>
    </div>
  );
}

export function App() {
  return (
    <LocationProvider>
      <AppContent />
    </LocationProvider>
  );
}

if (typeof window !== "undefined") {
  initPostHog();
  const appElement = document.getElementById("app");
  if (!appElement) {
    throw new Error("App element not found");
  }

  if (location.pathname === "/") {
    hydrate(<App />, appElement);
  } else {
    appElement.innerHTML = "";
    render(<App />, appElement);
  }
}

export async function prerender(data: Record<string, unknown>) {
  return await ssr(<App {...data} />);
}
