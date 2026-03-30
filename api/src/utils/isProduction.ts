export const isProduction = (env: Cloudflare.Env): boolean => {
  return (env.LOCAL as string) !== "true";
};
