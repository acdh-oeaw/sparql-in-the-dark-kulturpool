import type { RouteLocationRaw } from "vue-router";

/** Strips the ordering prefix from an example file name, e.g. `examples/1_kulturpool` → `kulturpool`. */
export function getExampleId(stem: string): string {
	const name = stem.split("/").pop() ?? stem;
	return name.replace(/^\d+_/u, "");
}

/**
 * Reads the opt-in `playground` flag from a code fence's info string (the text after the backticks,
 * e.g. ```` ```sparql playground=kulturpool ````). Returns the example id whose data source to
 * use, an empty string for a bare `playground` (default data source), or `undefined` if absent.
 */
export function getPlaygroundExample(fenceInfo: string): string | undefined {
	const match = /(?:^|\s)playground(?:=([\w-]+))?(?=\s|$)/u.exec(fenceInfo);
	if (!match) return undefined;
	return match[1] ?? "";
}

/** Builds a link that opens the playground with the given query, optionally on an example's data source. */
export function getPlaygroundLink(query: string, example?: string): RouteLocationRaw {
	// An empty id (bare `playground` flag) means the playground's default data source.
	return { path: "/playground", query: { example: example === "" ? undefined : example, query } };
}

const prologueDeclaration = /^\s*(?:PREFIX|BASE)\s/iu;
const prologueFiller = /^\s*(?:#.*)?$/u;

/**
 * Moves the PREFIX/BASE declarations of a query's prologue into a separate string, so they can be
 * shown in the playground's prefixes editor. Comments in the prologue stay with the query.
 */
export function splitPrefixes(fullQuery: string): { prefixes: string; query: string } {
	const lines = fullQuery.split(/\r?\n/u);
	const prefixes: Array<string> = [];
	const rest: Array<string> = [];
	let isInPrologue = true;

	for (const line of lines) {
		if (isInPrologue && prologueDeclaration.test(line)) {
			prefixes.push(line.trim());
		} else {
			if (!prologueFiller.test(line)) isInPrologue = false;
			rest.push(line);
		}
	}

	return {
		prefixes: prefixes.join("\n"),
		query: rest
			.join("\n")
			.replace(/\n{3,}/gu, "\n\n")
			.trim(),
	};
}
