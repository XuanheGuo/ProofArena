import type { VerificationActor, VerificationRequest, VerificationResult, VerificationTaskDto, VerificationTaskStatus, VerificationVerdict } from "../domain/types";

export interface CreateTaskInput {
  actor: VerificationActor;
  request: VerificationRequest;
  provider: string;
  environment: string;
  sourceHash: string;
  sourceSize: number;
}

export interface VerificationRepository {
  authorize(actor: VerificationActor, request: VerificationRequest): Promise<void>;
  countRecent(userId: string, sinceIso: string): Promise<number>;
  countRunning(userId: string): Promise<number>;
  recoverStale(beforeIso: string): Promise<void>;
  findCache(sourceHash: string): Promise<VerificationTaskDto | null>;
  findActive(sourceHash: string): Promise<VerificationTaskDto | null>;
  create(input: CreateTaskInput): Promise<VerificationTaskDto>;
  createCached(input: CreateTaskInput, source: VerificationTaskDto): Promise<VerificationTaskDto>;
  markRunning(id: string): Promise<void>;
  finish(id: string, status: VerificationTaskStatus, result: VerificationResult): Promise<VerificationTaskDto>;
  getById(id: string, actor: VerificationActor): Promise<VerificationTaskDto | null>;
  list(actor: VerificationActor, filters?: {
    userId?: string; problemId?: string; engine?: string; provider?: string;
    status?: VerificationTaskStatus; verdict?: VerificationVerdict; limit?: number;
  }): Promise<VerificationTaskDto[]>;
}
