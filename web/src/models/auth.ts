import { signal, computed, createModel } from "@preact/signals";
import { authClient } from "../lib/auth";
import { identifyUser, resetUser, trackEvent } from "../lib/posthog";

export const AuthModel = createModel(() => {
  const loading = signal(true);
  const user = signal<{ id: string; name: string; email?: string } | null>(null);
  const authenticated = computed(() => user.value !== null);

  const checkSession = async () => {
    loading.value = true;
    try {
      const res = await authClient.getSession();
      const sessionUser = res.data?.user ?? null;
      user.value = sessionUser;
      if (sessionUser) {
        identifyUser(sessionUser);
      }
    } catch {
      user.value = null;
    } finally {
      loading.value = false;
    }
  };

  const signOut = async () => {
    trackEvent("user_signed_out");
    await authClient.signOut();
    user.value = null;
    resetUser();
  };

  return { loading, user, authenticated, checkSession, signOut };
});
