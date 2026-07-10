import type { VerificationRequest } from "../../domain/types";

export interface LeanVerificationRequest extends VerificationRequest {
  engine: "lean";
  environment: string;
  options: { ignoreImports: boolean; mathlibOptions: boolean; timeoutSeconds: number };
}
