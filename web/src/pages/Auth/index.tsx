import { useEffect } from "preact/hooks";
import { useLocation } from "preact-iso";
import { useModel } from "@preact/signals";
import { AuthModel } from "../../models/auth";
import { AuthForm } from "../../components/AuthForm";
import { PageLoader } from "../../components/ui/Layout";

export function Auth() {
  const { route } = useLocation();
  const auth = useModel(AuthModel);

  useEffect(() => {
    auth.checkSession();
  }, []);

  // Redirect to chat if already authenticated
  useEffect(() => {
    if (!auth.loading.value && auth.authenticated.value) {
      route("/chat");
    }
  }, [auth.loading.value, auth.authenticated.value]);

  if (auth.loading.value) {
    return <PageLoader />;
  }

  if (auth.authenticated.value) {
    return <PageLoader />;
  }

  return <AuthForm onSuccess={() => route("/chat")} />;
}
