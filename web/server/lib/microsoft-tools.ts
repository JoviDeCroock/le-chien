import { tool } from "ai";
import { z } from "zod";
import { graphFetch } from "./microsoft";

const MAX_CONTENT_LENGTH = 12_000;

export function createMicrosoftTools(accessToken: string) {
  return {
    microsoft_search_files: tool({
      description:
        "Search the user's OneDrive and SharePoint files. Returns file names, URLs, and text snippets. Use this when someone asks about their documents, files, or shared content.",
      inputSchema: z.object({
        query: z.string().describe("Search query for files"),
        count: z.number().optional().default(5).describe("Number of results to return (max 10)"),
      }),
      execute: async ({ query, count }) => {
        const size = Math.min(count, 10);

        const res = await graphFetch("https://graph.microsoft.com/v1.0/search/query", accessToken, {
          method: "POST",
          body: JSON.stringify({
            requests: [
              {
                entityTypes: ["driveItem"],
                query: { queryString: query },
                from: 0,
                size,
              },
            ],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          if (res.status === 401) {
            return {
              error:
                "Microsoft 365 connection expired. Ask the user to reconnect in the Integrations page.",
            };
          }
          if (res.status === 403) {
            return {
              error:
                "Your organization hasn't granted file search access. Ask your IT admin to approve the app.",
            };
          }
          return { error: `Search failed: ${res.status} ${text}` };
        }

        const data = (await res.json()) as {
          value: Array<{
            hitsContainers?: Array<{
              hits?: Array<{
                resource: {
                  name?: string;
                  webUrl?: string;
                  lastModifiedDateTime?: string;
                  size?: number;
                  id?: string;
                  parentReference?: { driveId?: string };
                };
                summary?: string;
              }>;
              total?: number;
            }>;
          }>;
        };

        const hits = data.value?.[0]?.hitsContainers?.[0]?.hits ?? [];
        const results = hits.map((hit) => ({
          name: hit.resource.name ?? "Unknown",
          webUrl: hit.resource.webUrl ?? "",
          lastModified: hit.resource.lastModifiedDateTime ?? "",
          size: hit.resource.size ?? 0,
          snippet: hit.summary ?? "",
          fileId: hit.resource.id ?? "",
          driveId: hit.resource.parentReference?.driveId ?? "",
        }));

        return {
          query,
          resultCount: results.length,
          totalAvailable: data.value?.[0]?.hitsContainers?.[0]?.total ?? 0,
          results,
        };
      },
    }),

    microsoft_read_file: tool({
      description:
        "Read the text content of a file from OneDrive or SharePoint. Use a fileId and driveId from search results. Works best with text-based files (documents, code, markdown, etc.).",
      inputSchema: z.object({
        fileId: z.string().describe("The file/driveItem ID from search results"),
        driveId: z.string().describe("The drive ID from search results"),
      }),
      execute: async ({ fileId, driveId }) => {
        // First get file metadata
        const metaRes = await graphFetch(
          `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}`,
          accessToken,
        );

        if (!metaRes.ok) {
          if (metaRes.status === 401) {
            return {
              error:
                "Microsoft 365 connection expired. Ask the user to reconnect in the Integrations page.",
            };
          }
          if (metaRes.status === 404) {
            return { error: "File not found. It may have been moved or deleted." };
          }
          return { error: `Failed to fetch file metadata: ${metaRes.status}` };
        }

        const meta = (await metaRes.json()) as {
          name: string;
          size: number;
          file?: { mimeType?: string };
        };

        // Fetch the file content
        const contentRes = await graphFetch(
          `https://graph.microsoft.com/v1.0/drives/${driveId}/items/${fileId}/content`,
          accessToken,
        );

        if (!contentRes.ok) {
          if (contentRes.status === 403) {
            return { error: "You don't have permission to read this file." };
          }
          return { error: `Failed to fetch file content: ${contentRes.status}` };
        }

        let content: string;
        const mimeType = meta.file?.mimeType ?? contentRes.headers.get("content-type") ?? "unknown";

        // For binary formats, note that we can't extract text
        if (
          mimeType.includes("image/") ||
          mimeType.includes("video/") ||
          mimeType.includes("audio/") ||
          mimeType.includes("zip") ||
          mimeType.includes("octet-stream")
        ) {
          return {
            name: meta.name,
            mimeType,
            size: meta.size,
            content: "[Binary file — content cannot be displayed as text]",
          };
        }

        content = await contentRes.text();

        if (content.length > MAX_CONTENT_LENGTH) {
          content = content.slice(0, MAX_CONTENT_LENGTH) + "\n...[truncated]";
        }

        return {
          name: meta.name,
          mimeType,
          size: meta.size,
          content,
        };
      },
    }),

    microsoft_search_teams: tool({
      description:
        "Search Teams messages and chat conversations. Returns message summaries, senders, and channel/team info. Use this when someone asks about team discussions, decisions, or conversations.",
      inputSchema: z.object({
        query: z.string().describe("Search query for Teams messages"),
        count: z.number().optional().default(5).describe("Number of results to return (max 10)"),
      }),
      execute: async ({ query, count }) => {
        const size = Math.min(count, 10);

        const res = await graphFetch("https://graph.microsoft.com/v1.0/search/query", accessToken, {
          method: "POST",
          body: JSON.stringify({
            requests: [
              {
                entityTypes: ["chatMessage"],
                query: { queryString: query },
                from: 0,
                size,
              },
            ],
          }),
        });

        if (!res.ok) {
          const text = await res.text();
          if (res.status === 401) {
            return {
              error:
                "Microsoft 365 connection expired. Ask the user to reconnect in the Integrations page.",
            };
          }
          if (res.status === 403) {
            return {
              error:
                "Your organization hasn't granted Teams message access. Ask your IT admin to approve the app.",
            };
          }
          return { error: `Search failed: ${res.status} ${text}` };
        }

        const data = (await res.json()) as {
          value: Array<{
            hitsContainers?: Array<{
              hits?: Array<{
                resource: {
                  summary?: string;
                  from?: { emailAddress?: { name?: string; address?: string } };
                  channelIdentity?: { channelId?: string; teamId?: string };
                  chatId?: string;
                  createdDateTime?: string;
                  webUrl?: string;
                  body?: { content?: string };
                };
                summary?: string;
              }>;
              total?: number;
            }>;
          }>;
        };

        const hits = data.value?.[0]?.hitsContainers?.[0]?.hits ?? [];
        const results = hits.map((hit) => ({
          summary: hit.summary ?? hit.resource.body?.content?.slice(0, 200) ?? "",
          from: hit.resource.from?.emailAddress?.name ?? "Unknown",
          fromEmail: hit.resource.from?.emailAddress?.address ?? "",
          channelId: hit.resource.channelIdentity?.channelId ?? "",
          teamId: hit.resource.channelIdentity?.teamId ?? "",
          chatId: hit.resource.chatId ?? "",
          createdDateTime: hit.resource.createdDateTime ?? "",
          webUrl: hit.resource.webUrl ?? "",
        }));

        return {
          query,
          resultCount: results.length,
          totalAvailable: data.value?.[0]?.hitsContainers?.[0]?.total ?? 0,
          results,
        };
      },
    }),
  };
}
