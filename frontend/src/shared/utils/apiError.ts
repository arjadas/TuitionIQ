import { AxiosError } from "axios";

type ApiErrorBody = Record<string, unknown>;

type ApiErrorExtensions = Record<string, unknown>;

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getApiErrorBody(error: unknown): ApiErrorBody | null {
  if (!(error instanceof AxiosError)) {
    return null;
  }

  const data = error.response?.data;
  if (!isObject(data)) {
    return null;
  }

  return data;
}

export function getApiErrorCode(error: unknown): string | undefined {
  const body = getApiErrorBody(error);
  if (!body) {
    return undefined;
  }

  if (typeof body.code === "string") {
    return body.code;
  }

  const extensions = body.extensions;
  if (!isObject(extensions)) {
    return undefined;
  }

  const extensionCode = (extensions as ApiErrorExtensions).code;
  return typeof extensionCode === "string" ? extensionCode : undefined;
}

export function getApiErrorMessage(error: unknown): string | undefined {
  const body = getApiErrorBody(error);
  if (!body) {
    return undefined;
  }

  if (typeof body.detail === "string" && body.detail.trim().length > 0) {
    return body.detail;
  }

  if (typeof body.title === "string" && body.title.trim().length > 0) {
    return body.title;
  }

  if (typeof body.message === "string" && body.message.trim().length > 0) {
    return body.message;
  }

  return undefined;
}
