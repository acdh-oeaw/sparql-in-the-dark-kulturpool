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

/**
 * Reads the `prefixes=default` flag from a code fence's info string, e.g.
 * ```` ```sparql playground=kulturpool prefixes=default ````. If set, the playground declares the
 * common prefixes for the query, so the chapter can show the query without its prologue.
 */
export function hasDefaultPrefixes(fenceInfo: string): boolean {
	return /(?:^|\s)prefixes=default(?=\s|$)/u.test(fenceInfo);
}

/** Builds a link that opens the playground with the given query, optionally on an example's data source. */
export function getPlaygroundLink(
	query: string,
	example?: string,
	defaultPrefixes = false,
): RouteLocationRaw {
	// An empty id (bare `playground` flag) means the playground's default data source.
	return {
		path: "/playground",
		query: {
			example: example === "" ? undefined : example,
			prefixes: defaultPrefixes ? "default" : undefined,
			query,
		},
	};
}

export const commonPrefixes = [
	{ prefix: "rdf", iri: "http://www.w3.org/1999/02/22-rdf-syntax-ns#" },
	{ prefix: "rdfs", iri: "http://www.w3.org/2000/01/rdf-schema#" },
	{ prefix: "edm", iri: "http://www.europeana.eu/schemas/edm/" },
	{ prefix: "dc", iri: "http://purl.org/dc/elements/1.1/" },
	{ prefix: "dcterms", iri: "http://purl.org/dc/terms/" },
	{ prefix: "gnd", iri: "https://d-nb.info/gnd/" },
	{ prefix: "ore", iri: "http://www.openarchives.org/ore/terms/" },
	{ prefix: "skos", iri: "http://www.w3.org/2004/02/skos/core#" },
	{ prefix: "id", iri: "https://id.kulturpool.at/" },
] as const;

/** Appends every common prefix that isn't declared in `prefixes` yet. */
export function withCommonPrefixes(prefixes: string): string {
	const declared = new Set(
		[...prefixes.matchAll(/^\s*PREFIX\s+([^\s:]*):/gimu)].map((match) => {
			return match[1];
		}),
	);
	const lines = commonPrefixes
		.filter((entry) => {
			return !declared.has(entry.prefix);
		})
		.map((entry) => {
			return `PREFIX ${entry.prefix}: <${entry.iri}>`;
		});
	if (lines.length === 0) return prefixes;

	const existing = prefixes.replace(/\s+$/u, "");
	return existing ? `${existing}\n${lines.join("\n")}` : lines.join("\n");
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
