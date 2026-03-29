import { useModel } from "@preact/signals";
import { AuthFormModel } from "../models/auth-form";
import { Button } from "./ui/Button";
import { Input, Label, LabelText } from "./ui/Input";
import { Alert } from "./ui/Alert";
import { TabToggle } from "./ui/TabToggle";
import { Card } from "./ui/Layout";

interface AuthFormProps {
  onSuccess?: () => void;
  compact?: boolean;
}

const TABS = [
  { id: "signin", label: "Sign In" },
  { id: "signup", label: "Sign Up" },
];

export function AuthForm({ onSuccess, compact = false }: AuthFormProps) {
  const form = useModel(AuthFormModel);

  async function handleSignIn(e: Event) {
    e.preventDefault();
    const ok = await form.signIn();
    if (ok) onSuccess?.();
  }

  async function handleSignUp(e: Event) {
    e.preventDefault();
    const ok = await form.signUp();
    if (ok) onSuccess?.();
  }

  return (
    <div class={compact ? "w-full" : "min-h-screen flex flex-col items-center justify-center px-4"}>
      <div class="w-full max-w-md mx-auto">
        {!compact && (
          <a
            href="/"
            class="block text-white text-base font-bold tracking-tight mb-8 hover:text-neutral-300 transition-colors"
          >
            le&nbsp;chien
          </a>
        )}
        <TabToggle
          tabs={TABS}
          active={form.tab.value}
          onSelect={(id) => form.switchTab(id as "signin" | "signup")}
          class="mb-6"
        />

        <Card>
          <h1 class="text-xl font-semibold text-white mb-6">
            {form.tab.value === "signin" ? "Welcome back" : "Create your account"}
          </h1>

          {form.tab.value === "signin" ? (
            <form onSubmit={handleSignIn} class="flex flex-col gap-4">
              <Label>
                <LabelText>Email</LabelText>
                <Input
                  type="email"
                  required
                  value={form.email.value}
                  onInput={(e) => (form.email.value = (e.target as HTMLInputElement).value)}
                  placeholder="you@example.com"
                />
              </Label>
              <Label>
                <LabelText>Password</LabelText>
                <Input
                  type="password"
                  required
                  value={form.password.value}
                  onInput={(e) => (form.password.value = (e.target as HTMLInputElement).value)}
                  placeholder="••••••••"
                />
              </Label>
              {form.error.value && <Alert variant="inline-error">{form.error.value}</Alert>}
              <Button type="submit" disabled={form.loading.value} class="mt-2 py-2.5">
                {form.loading.value ? "Signing in…" : "Sign In"}
              </Button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} class="flex flex-col gap-4">
              <Label>
                <LabelText>Name</LabelText>
                <Input
                  type="text"
                  required
                  value={form.name.value}
                  onInput={(e) => (form.name.value = (e.target as HTMLInputElement).value)}
                  placeholder="Your name"
                />
              </Label>
              <Label>
                <LabelText>Email</LabelText>
                <Input
                  type="email"
                  required
                  value={form.email.value}
                  onInput={(e) => (form.email.value = (e.target as HTMLInputElement).value)}
                  placeholder="you@example.com"
                />
              </Label>
              <Label>
                <LabelText>Password</LabelText>
                <Input
                  type="password"
                  required
                  value={form.password.value}
                  onInput={(e) => (form.password.value = (e.target as HTMLInputElement).value)}
                  placeholder="••••••••"
                />
              </Label>
              {form.error.value && <Alert variant="inline-error">{form.error.value}</Alert>}
              <Button type="submit" disabled={form.loading.value} class="mt-2 py-2.5">
                {form.loading.value ? "Creating account…" : "Sign Up"}
              </Button>
            </form>
          )}
        </Card>
      </div>
    </div>
  );
}
