import type { createAuth } from "./lib/auth";

export type Bindings = Cloudflare.Env;

export type Auth = ReturnType<typeof createAuth>;

export type Variables = {
  auth: Auth;
  user: {
    id: string;
    name: string;
    email: string;
  } | null;
  session: {
    id: string;
    userId: string;
    expiresAt: Date;
  } | null;
};
