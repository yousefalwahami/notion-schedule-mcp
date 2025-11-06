import { Composio } from "@composio/core";

export const composio = new Composio({
  apiKey: process.env.COMPOSIO_API_KEY!,
  baseURL: process.env.COMPOSIO_BASE_URL || "https://backend.composio.dev",
});
