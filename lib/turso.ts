type TursoValue =
  | { type: "null" }
  | { type: "integer"; value: string }
  | { type: "text"; value: string };

type TursoResult = {
  cols: { name: string }[];
  rows: TursoValue[][];
};

type TursoResponse = {
  results: (
    | { type: "ok"; response: { type: "execute"; result: TursoResult } }
    | { type: "error"; error: { message: string } }
  )[];
};

// Local development only: a file:-backed libsql database (no server, no Docker).
// Gated to file: URLs, so production (libsql:// over HTTP) uses the unchanged
// fetch path below. @libsql/client is imported lazily so it never loads in prod.
let _fileClient: import("@libsql/client").Client | null = null;
let _fileUrl: string | null = null;

async function localFileExecute(
  dbUrl: string,
  sql: string,
  args: (string | number | null)[],
): Promise<TursoResult> {
  if (!_fileClient || _fileUrl !== dbUrl) {
    const { createClient } = await import("@libsql/client");
    _fileClient = createClient({ url: dbUrl });
    _fileUrl = dbUrl;
  }
  const rs = await _fileClient.execute({ sql, args });
  const cols = rs.columns.map((name) => ({ name }));
  const rows: TursoValue[][] = rs.rows.map((row) =>
    rs.columns.map((_c, i): TursoValue => {
      const v = (row as unknown as unknown[])[i];
      if (v === null || v === undefined) return { type: "null" };
      if (typeof v === "bigint") return { type: "integer", value: v.toString() };
      if (typeof v === "number") {
        return Number.isInteger(v)
          ? { type: "integer", value: String(v) }
          : { type: "text", value: String(v) };
      }
      return { type: "text", value: String(v) };
    }),
  );
  return { cols, rows };
}

export async function tursoExecute(
  dbUrl: string,
  token: string,
  sql: string,
  args: (string | number | null)[] = [],
): Promise<TursoResult> {
  if (dbUrl.startsWith("file:")) return localFileExecute(dbUrl, sql, args);
  const url = dbUrl.replace(/^libsql:\/\//, "https://") + "/v2/pipeline";
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      requests: [
        {
          type: "execute",
          stmt: {
            sql,
            args: args.map((v) =>
              v === null
                ? { type: "null" }
                : typeof v === "number"
                  ? { type: "integer", value: String(v) }
                  : { type: "text", value: String(v) },
            ),
          },
        },
        { type: "close" },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Turso error: ${res.status}`);
  const data = (await res.json()) as TursoResponse;
  const first = data.results[0];
  if (first.type === "error") throw new Error(first.error.message);
  return first.response.result;
}
