/**
 * Zod validation — PRD §19.4 ("validated DTO").
 *
 * The schema in `packages/contracts` is the single source: the NestJS input
 * type, the OpenAPI document and the generated client all derive from it, so a
 * DTO cannot drift from the client that calls it.
 *
 * Field errors come back in the §19.3 envelope shape, keyed by path, because a
 * form needs to attach each message to its input (§23.5 "server field errors").
 */

import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { z, ZodError, type ZodTypeAny } from "zod";
import { validationFailed, type FieldError } from "@nesto/contracts";

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodTypeAny) {}

  transform(value: unknown, _metadata: ArgumentMetadata): unknown {
    const result = this.schema.safeParse(value);
    if (result.success) return result.data;
    throw validationFailed(toFieldErrors(result.error));
  }
}

export function toFieldErrors(error: ZodError): FieldError[] {
  return error.issues.map((issue) => ({
    path: issue.path.join("."),
    code: issue.code,
    message: issue.message,
  }));
}

export function parseOrThrow<T extends ZodTypeAny>(schema: T, value: unknown): z.infer<T> {
  const result = schema.safeParse(value);
  if (!result.success) throw validationFailed(toFieldErrors(result.error));
  return result.data;
}
