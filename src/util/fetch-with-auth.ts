import { Auth } from "home-assistant-js-websocket";
import { Upload } from "./upload";

export const fetchWithAuth = async (
  auth: Auth,
  input: RequestInfo,
  init: RequestInit = {}
) => {
  if (auth.expired) {
    await auth.refreshAccessToken();
  }
  init.credentials = "same-origin";
  if (!init.headers) {
    init.headers = {};
  }
  // @ts-ignore
  init.headers.authorization = `Bearer ${auth.accessToken}`;
  return fetch(input, init);
};

export const uploadWithAuth = async (
  auth: Auth,
  url: string,
  data: FormData
) => {
  if (auth.expired) {
    await auth.refreshAccessToken();
  }
  const headers: Record<string, string> = {};
  headers.authorization = `Bearer ${auth.accessToken}`;
  return new Upload(url, data, headers);
};
