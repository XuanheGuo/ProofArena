import { createServiceClient } from "@/lib/supabase-server";
import { LeanEngine } from "./engines/lean/lean-engine";
import { AxleProvider } from "./providers/axle/axle-provider";
import { SupabaseVerificationRepository } from "./repositories/supabase-verification-repository";
import { getVerificationConfig } from "./service/config";
import { VerificationService } from "./service/verification-service";

export * from "./domain/types";
export * from "./domain/errors";
export * from "./domain/policies";

export function createVerificationService() {
  const config = getVerificationConfig();
  const repository = new SupabaseVerificationRepository(createServiceClient());
  const provider = config.leanProvider === "axle" ? new AxleProvider({
    apiKey: config.axleApiKey, baseUrl: config.axleBaseUrl, timeoutSeconds: config.timeoutSeconds, defaultEnvironment: config.defaultEnvironment,
  }) : undefined;
  return new VerificationService(repository, config, provider ? new LeanEngine(provider) : undefined);
}

export function createAxleProvider() {
  const config = getVerificationConfig();
  return new AxleProvider({ apiKey: config.axleApiKey, baseUrl: config.axleBaseUrl, timeoutSeconds: config.timeoutSeconds, defaultEnvironment: config.defaultEnvironment });
}
