type TursoValue = { type: "null" } | { type: "integer"; value: string } | { type: "text"; value: string };
type TursoResult = { cols: { name: string }[]; rows: TursoValue[][] };

export function mapRows<T = Record<string, string | number | null>>(result: TursoResult): T[] {
	return result.rows.map((row) => {
		const obj: Record<string, string | number | null> = {};
		for (let i = 0; i < result.cols.length; i++) {
			const v = row[i];
			if (!v || v.type === "null") {
				obj[result.cols[i].name] = null;
			} else if (v.type === "integer") {
				obj[result.cols[i].name] = Number(v.value);
			} else {
				obj[result.cols[i].name] = v.value;
			}
		}
		return obj as T;
	});
}
