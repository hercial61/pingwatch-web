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

export async function tursoExecute(
  dbUrl: string,
  token: string,
  sql: string,
  args: (string | number | null)[] = [],
): Promise<TursoResult> {
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
