import { LocationProvider, Router, Route, hydrate, prerender as ssr, lazy } from "preact-iso";

import "./style.css";

const Landing = lazy(() => import("./pages/Landing/index").then((module) => module.Landing));
const Chat = lazy(() => import("./pages/Chat/index").then((module) => module.Chat));
const Auth = lazy(() => import("./pages/Auth/index").then((module) => module.Auth));
const NotFound = lazy(() => import("./pages/_404").then((module) => module.NotFound));

function AppContent() {
  return (
    <div class="bg-neutral-950 min-h-screen">
      <main>
        <Router>
          <Route path="/" component={Landing} />
          <Route path="/chat" component={Chat} />
          <Route path="/auth" component={Auth} />
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
  const appElement = document.getElementById("app");
  if (!appElement) {
    throw new Error("App element not found");
  }
  hydrate(<App />, appElement);
}

export async function prerender(data: Record<string, unknown>) {
  return await ssr(<App {...data} />);
}
