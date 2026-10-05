<script lang="ts" setup>
import { QueryEngine } from "@comunica/query-sparql";
import {
	ChevronDownIcon,
	DatabaseIcon,
	LoaderCircleIcon,
	PlayIcon,
	PlusIcon,
	TagsIcon,
	TriangleAlertIcon,
} from "lucide-vue-next";

useSeoMeta({
	title: "Playground",
	description: "Run SPARQL queries against any endpoint, powered by Comunica.",
});

type SourceMode = "endpoint" | "rdf";

const route = useRoute();
const router = useRouter();

const { data: exampleEntries } = await useAsyncData("playground-examples", () => {
	return queryCollection("examples").order("stem", "ASC").all();
});
const examples = computed(() => {
	return (exampleEntries.value ?? []).map((entry) => {
		return { ...entry, id: getExampleId(entry.stem) };
	});
});
type Example = (typeof examples.value)[number];

const commonPrefixes = [
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

const mediaTypes = [
	{ label: "Turtle", value: "text/turtle", highlight: "turtle" },
	{ label: "N-Triples", value: "application/n-triples", highlight: "turtle" },
	{ label: "TriG", value: "application/trig", highlight: "turtle" },
	{ label: "N-Quads", value: "application/n-quads", highlight: "turtle" },
	{ label: "JSON-LD", value: "application/ld+json", highlight: "json" },
	{ label: "RDF/XML", value: "application/rdf+xml", highlight: "xml" },
] as const;

const sourceMode = ref<SourceMode>("endpoint");
const source = ref("https://sparql.kulturpool.at/query");
const rdfData = ref("");
const rdfMediaType = ref("text/turtle");
const prefixes = ref("");
const query = ref("");

const isRdfCollapsed = ref(true);
const isPrefixesCollapsed = ref(false);

/** Appends every common prefix that isn't declared yet, so repeat clicks are a no-op. */
function addCommonPrefixes() {
	const declared = new Set(
		[...prefixes.value.matchAll(/^\s*PREFIX\s+([^\s:]*):/gimu)].map((match) => {
			return match[1];
		}),
	);
	const missing = commonPrefixes.filter((entry) => {
		return !declared.has(entry.prefix);
	});
	if (missing.length === 0) return;

	const lines = missing.map((entry) => {
		return `PREFIX ${entry.prefix}: <${entry.iri}>`;
	});
	const existing = prefixes.value.replace(/\s+$/u, "");
	prefixes.value = existing ? `${existing}\n${lines.join("\n")}` : lines.join("\n");
	isPrefixesCollapsed.value = false;
}
const isLoadingExample = ref(false);
const exampleDataCache = new Map<string, string>();

const rdfHighlightLang = computed(() => {
	return (
		mediaTypes.find((type) => {
			return type.value === rdfMediaType.value;
		})?.highlight ?? "turtle"
	);
});

const isRunning = ref(false);
const errorMessage = ref<string | null>(null);
const elapsed = ref<number | null>(null);

type ResultKind = "bindings" | "boolean" | "quads";

type ProjectedVariable = { value: string } | { variable: { value: string } };
const resultKind = ref<ResultKind | null>(null);
const columns = ref<Array<string>>([]);
const rows = ref<Array<Record<string, string>>>([]);
const booleanResult = ref<boolean | null>(null);
const quads = ref<Array<{ subject: string; predicate: string; object: string }>>([]);

function resetResults() {
	errorMessage.value = null;
	resultKind.value = null;
	columns.value = [];
	rows.value = [];
	booleanResult.value = null;
	quads.value = [];
	elapsed.value = null;
}

async function runQuery() {
	if (isRunning.value) return;
	if (!query.value.trim()) {
		errorMessage.value = "Please provide a query.";
		return;
	}
	if (sourceMode.value === "endpoint" && !source.value.trim()) {
		errorMessage.value = "Please provide an endpoint URL.";
		return;
	}
	if (sourceMode.value === "rdf" && !rdfData.value.trim()) {
		errorMessage.value = "Please provide some RDF data to query.";
		return;
	}

	resetResults();
	isRunning.value = true;
	const startedAt = performance.now();

	try {
		const comunica = new QueryEngine();
		const sources =
			sourceMode.value === "rdf"
				? [
						{
							type: "serialized" as const,
							value: rdfData.value,
							mediaType: rdfMediaType.value,
							baseIRI: "http://example.org/",
						},
					]
				: [{ type: "sparql" as const, value: source.value.trim() }];
		const fullQuery = [prefixes.value.trim(), query.value.trim()]
			.filter((part) => {
				return part.length > 0;
			})
			.join("\n\n");
		const result = await comunica.query(fullQuery, { sources });

		switch (result.resultType) {
			case "bindings": {
				// Take the columns from the query's projected variables, not from the
				// bindings. Deriving them from the rows reorders the columns (the first
				// row's iteration order wins, so `SELECT ?city ?name` can render as
				// `name | city`) and silently drops any variable that never gets bound,
				// such as an OPTIONAL that matches nothing.
				const metadata = await result.metadata();
				const columnOrder = (metadata.variables as Array<ProjectedVariable>).map((entry) => {
					return "variable" in entry ? entry.variable.value : entry.value;
				});

				const stream = await result.execute();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const bindings: Array<any> = await stream.toArray();
				const parsedRows = bindings.map((binding) => {
					const row: Record<string, string> = {};
					for (const [variable, term] of binding) {
						row[variable.value] = term.value;
					}
					return row;
				});
				columns.value = columnOrder;
				rows.value = parsedRows;
				resultKind.value = "bindings";
				break;
			}
			case "boolean": {
				booleanResult.value = await result.execute();
				resultKind.value = "boolean";
				break;
			}
			case "quads": {
				const stream = await result.execute();
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				const collected: Array<any> = await stream.toArray();
				quads.value = collected.map((quad) => {
					return {
						subject: quad.subject.value,
						predicate: quad.predicate.value,
						object: quad.object.value,
					};
				});
				resultKind.value = "quads";
				break;
			}
			default: {
				errorMessage.value = "The query executed but returned no displayable results.";
			}
		}
	} catch (error) {
		errorMessage.value = error instanceof Error ? error.message : String(error);
	} finally {
		elapsed.value = Math.round(performance.now() - startedAt);
		// eslint-disable-next-line require-atomic-updates -- guarded against re-entry via isRunning
		isRunning.value = false;
	}
}

async function loadExample(example: Example) {
	sourceMode.value = example.mode;
	if (example.mode === "endpoint") {
		source.value = example.source ?? "";
	} else {
		rdfMediaType.value = example.mediaType ?? "text/turtle";
		isRdfCollapsed.value = false;

		if (example.dataUrl) {
			const cached = exampleDataCache.get(example.dataUrl);
			if (cached !== undefined) {
				rdfData.value = cached;
			} else {
				isLoadingExample.value = true;
				try {
					const text = await $fetch<string>(example.dataUrl, { responseType: "text" });
					exampleDataCache.set(example.dataUrl, text);
					rdfData.value = text;
				} finally {
					isLoadingExample.value = false;
				}
			}
		}
	}
	prefixes.value = example.prefixes ?? "";
	query.value = example.query;
	resetResults();
}

function selectExample(example: Example) {
	void router.replace({ query: { example: example.id } });
	void loadExample(example);
}

/**
 * Initialises the editors from the URL: `?example=<id>` picks the data source (and default
 * query), `?query=<sparql>` overrides the query, e.g. when coming from a chapter.
 */
async function loadFromRoute() {
	const exampleId = route.query.example;
	const linkedQuery = route.query.query;
	const example =
		examples.value.find((entry) => {
			return entry.id === exampleId;
		}) ?? examples.value[0];

	if (example) await loadExample(example);
	// Keep the (possibly large) data out of the way on first load; the query is the focus.
	isRdfCollapsed.value = true;
	if (typeof linkedQuery === "string" && linkedQuery.trim()) {
		const split = splitPrefixes(linkedQuery);
		prefixes.value = split.prefixes;
		query.value = split.query;
	}
}

void loadFromRoute();

function onKeydown(event: KeyboardEvent) {
	if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
		event.preventDefault();
		void runQuery();
	}
}
</script>

<template>
	<MainContent>
		<div class="mx-auto max-w-5xl">
			<div class="mb-10">
				<h1 class="mb-3 text-4xl font-bold text-neutral-950 md:text-5xl dark:text-white">
					Playground
				</h1>
				<p class="text-lg text-neutral-600 md:text-xl dark:text-slate-400">
					Run your own SPARQL queries against a remote endpoint or over an RDF document you paste in
					yourself.
				</p>
			</div>

			<!-- Examples -->
			<div class="mb-6 flex flex-wrap items-center gap-3">
				<span
					class="font-mono text-xs tracking-widest text-neutral-500 uppercase dark:text-slate-500"
					>Examples</span
				>
				<button
					v-for="example in examples"
					:key="example.id"
					class="rounded-full border border-neutral-200 bg-neutral-100 px-4 py-1.5 text-sm text-neutral-700 transition-colors hover:border-primary/50 hover:text-neutral-950 disabled:cursor-not-allowed disabled:opacity-50 dark:border-white/10 dark:bg-surface-dark/50 dark:text-slate-300 dark:hover:text-white"
					:disabled="isLoadingExample"
					type="button"
					@click="selectExample(example)"
				>
					{{ example.label }}
				</button>
			</div>

			<!-- Source mode -->
			<div class="mb-6">
				<span
					class="mb-2 block font-mono text-xs tracking-widest text-neutral-500 uppercase dark:text-slate-500"
				>
					Data source
				</span>
				<div
					class="inline-flex rounded-lg border border-neutral-200 bg-neutral-100 p-1 dark:border-white/10 dark:bg-surface-dark/50"
				>
					<button
						class="rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
						:class="
							sourceMode === 'endpoint'
								? 'bg-primary text-background-dark'
								: 'text-neutral-600 hover:text-neutral-950 dark:text-slate-400 dark:hover:text-white'
						"
						type="button"
						@click="sourceMode = 'endpoint'"
					>
						SPARQL endpoint
					</button>
					<button
						class="rounded-md px-4 py-1.5 text-sm font-medium transition-colors"
						:class="
							sourceMode === 'rdf'
								? 'bg-primary text-background-dark'
								: 'text-neutral-600 hover:text-neutral-950 dark:text-slate-400 dark:hover:text-white'
						"
						type="button"
						@click="sourceMode = 'rdf'"
					>
						RDF data
					</button>
				</div>
			</div>

			<!-- Endpoint -->
			<label v-if="sourceMode === 'endpoint'" class="mb-6 block">
				<span
					class="mb-2 flex items-center gap-2 font-mono text-xs tracking-widest text-neutral-500 uppercase dark:text-slate-500"
				>
					<DatabaseIcon class="size-3.5" />
					Endpoint
				</span>
				<input
					v-model="source"
					class="w-full rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-3 font-mono text-sm text-neutral-800 transition-colors outline-none placeholder:text-neutral-400 focus:border-primary/50 dark:border-white/10 dark:bg-[#151928] dark:text-slate-200 dark:placeholder:text-slate-600"
					placeholder="https://sparql.kulturpool.at/query"
					spellcheck="false"
					type="url"
				/>
			</label>

			<!-- Inline RDF data -->
			<div v-else class="mb-6">
				<div class="mb-2 flex items-center justify-between gap-4">
					<button
						:aria-expanded="!isRdfCollapsed"
						class="flex items-center gap-2 font-mono text-xs tracking-widest text-neutral-500 uppercase transition-colors hover:text-neutral-950 dark:text-slate-500 dark:hover:text-white"
						type="button"
						@click="isRdfCollapsed = !isRdfCollapsed"
					>
						<ChevronDownIcon
							class="size-3.5 transition-transform"
							:class="isRdfCollapsed ? '-rotate-90' : ''"
						/>
						<DatabaseIcon class="size-3.5" />
						RDF data
					</button>
					<label v-show="!isRdfCollapsed" class="flex items-center gap-2">
						<span
							class="font-mono text-xs tracking-widest text-neutral-500 uppercase dark:text-slate-500"
							>Format</span
						>
						<select
							v-model="rdfMediaType"
							class="rounded-lg border border-neutral-200 bg-neutral-100 px-3 py-1.5 text-sm text-neutral-800 outline-none focus:border-primary/50 dark:border-white/10 dark:bg-surface-dark dark:text-slate-200"
						>
							<option v-for="type in mediaTypes" :key="type.value" :value="type.value">
								{{ type.label }}
							</option>
						</select>
					</label>
				</div>
				<div v-show="!isRdfCollapsed">
					<div
						class="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-2xl ring-1 shadow-neutral-950/10 ring-neutral-950/5 dark:border-white/10 dark:bg-[#151928] dark:shadow-black/50 dark:ring-white/5"
					>
						<div
							class="flex items-center justify-between border-b border-neutral-200 bg-neutral-100 px-4 py-3 dark:border-white/5 dark:bg-[#1a1f30]"
						>
							<div class="flex items-center gap-2">
								<div class="size-3 rounded-full border border-red-500/50 bg-red-500/20"></div>
								<div class="size-3 rounded-full border border-yellow-500/50 bg-yellow-500/20"></div>
								<div class="size-3 rounded-full border border-green-500/50 bg-green-500/20"></div>
							</div>
							<div class="font-mono text-xs text-neutral-500 dark:text-slate-500">data</div>
						</div>
						<div
							v-if="isLoadingExample"
							class="flex min-h-48 items-center gap-2 p-6 text-sm text-neutral-600 dark:text-slate-400"
						>
							<LoaderCircleIcon class="size-4 animate-spin" />
							Loading example data…
						</div>
						<CodeHighlighter
							v-else
							v-model:code="rdfData"
							class="max-h-[50vh] min-h-48 py-4"
							editable
							:language="rdfHighlightLang"
						/>
					</div>
					<p class="mt-2 font-mono text-xs text-neutral-500 dark:text-slate-500">
						Queried locally in your browser — no request leaves the page.
					</p>
				</div>
			</div>

			<!-- Prefixes -->
			<div class="mb-6">
				<div class="mb-2 flex items-center justify-between gap-4">
					<button
						:aria-expanded="!isPrefixesCollapsed"
						class="flex items-center gap-2 font-mono text-xs tracking-widest text-neutral-500 uppercase transition-colors hover:text-neutral-950 dark:text-slate-500 dark:hover:text-white"
						type="button"
						@click="isPrefixesCollapsed = !isPrefixesCollapsed"
					>
						<ChevronDownIcon
							class="size-3.5 transition-transform"
							:class="isPrefixesCollapsed ? '-rotate-90' : ''"
						/>
						<TagsIcon class="size-3.5" />
						Prefixes
					</button>
					<button
						class="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-100 px-4 py-1.5 text-sm text-neutral-700 transition-colors hover:border-primary/50 hover:text-neutral-950 dark:border-white/10 dark:bg-surface-dark/50 dark:text-slate-300 dark:hover:text-white"
						type="button"
						@click="addCommonPrefixes"
					>
						<PlusIcon class="size-3.5" />
						Add common prefixes
					</button>
				</div>
				<div
					v-show="!isPrefixesCollapsed"
					class="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-2xl ring-1 shadow-neutral-950/10 ring-neutral-950/5 dark:border-white/10 dark:bg-[#151928] dark:shadow-black/50 dark:ring-white/5"
				>
					<div
						class="flex items-center justify-between border-b border-neutral-200 bg-neutral-100 px-4 py-3 dark:border-white/5 dark:bg-[#1a1f30]"
					>
						<div class="flex items-center gap-2">
							<div class="size-3 rounded-full border border-red-500/50 bg-red-500/20"></div>
							<div class="size-3 rounded-full border border-yellow-500/50 bg-yellow-500/20"></div>
							<div class="size-3 rounded-full border border-green-500/50 bg-green-500/20"></div>
						</div>
						<div class="font-mono text-xs text-neutral-500 dark:text-slate-500">
							prefixes.sparql
						</div>
					</div>
					<CodeHighlighter
						v-model:code="prefixes"
						class="max-h-[40vh] min-h-24 py-4"
						editable
						language="sparql"
						@keydown="onKeydown"
					/>
				</div>
			</div>

			<!-- Query editor -->
			<div
				class="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-2xl ring-1 shadow-neutral-950/10 ring-neutral-950/5 dark:border-white/10 dark:bg-[#151928] dark:shadow-black/50 dark:ring-white/5"
			>
				<div
					class="flex items-center justify-between border-b border-neutral-200 bg-neutral-100 px-4 py-3 dark:border-white/5 dark:bg-[#1a1f30]"
				>
					<div class="flex items-center gap-2">
						<div class="size-3 rounded-full border border-red-500/50 bg-red-500/20"></div>
						<div class="size-3 rounded-full border border-yellow-500/50 bg-yellow-500/20"></div>
						<div class="size-3 rounded-full border border-green-500/50 bg-green-500/20"></div>
					</div>
					<div class="font-mono text-xs text-neutral-500 dark:text-slate-500">query.sparql</div>
				</div>
				<CodeHighlighter
					v-model:code="query"
					class="max-h-[60vh] min-h-64 py-4"
					editable
					language="sparql"
					@keydown="onKeydown"
				/>
			</div>

			<!-- Actions -->
			<div class="mt-4 flex flex-wrap items-center gap-4">
				<button
					class="inline-flex items-center gap-2 rounded-lg bg-primary px-6 py-3 font-bold text-background-dark transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
					:disabled="isRunning"
					type="button"
					@click="runQuery"
				>
					<LoaderCircleIcon v-if="isRunning" class="size-4 animate-spin" />
					<PlayIcon v-else class="size-4" />
					{{ isRunning ? "Running…" : "Run query" }}
				</button>
				<span class="font-mono text-xs text-neutral-500 dark:text-slate-500">
					<kbd
						class="rounded-sm border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 dark:border-white/10 dark:bg-surface-dark"
						>Ctrl</kbd
					>
					+
					<kbd
						class="rounded-sm border border-neutral-200 bg-neutral-100 px-1.5 py-0.5 dark:border-white/10 dark:bg-surface-dark"
						>Enter</kbd
					>
					to run
				</span>
				<span
					v-if="elapsed !== null && !isRunning"
					class="font-mono text-xs text-neutral-500 dark:text-slate-500"
				>
					{{ elapsed }} ms
				</span>
			</div>

			<!-- Error -->
			<div
				v-if="errorMessage"
				class="mt-8 flex items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-5 text-sm text-red-800 dark:text-red-200"
			>
				<TriangleAlertIcon class="mt-0.5 size-5 shrink-0 text-red-600 dark:text-red-400" />
				<div>
					<p class="mb-1 font-semibold text-red-700 dark:text-red-300">Query failed</p>
					<p class="font-mono wrap-break-word whitespace-pre-wrap">{{ errorMessage }}</p>
				</div>
			</div>

			<!-- Results -->
			<div v-if="resultKind && !errorMessage" class="mt-8">
				<h2
					class="mb-4 font-mono text-xs tracking-widest text-neutral-500 uppercase dark:text-slate-500"
				>
					Results
				</h2>

				<!-- SELECT -->
				<div
					v-if="resultKind === 'bindings'"
					class="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-surface-dark/50"
				>
					<div v-if="rows.length === 0" class="p-6 text-neutral-600 dark:text-slate-400">
						The query returned no rows.
					</div>
					<div v-else class="overflow-x-auto">
						<table class="w-full border-collapse text-left text-sm">
							<thead>
								<tr
									class="border-b border-neutral-200 bg-neutral-100 dark:border-white/10 dark:bg-[#1a1f30]"
								>
									<th
										v-for="column in columns"
										:key="column"
										class="px-4 py-3 font-mono text-xs tracking-wider text-amber-600 dark:text-primary"
									>
										{{ column }}
									</th>
								</tr>
							</thead>
							<tbody>
								<tr
									v-for="(row, index) in rows"
									:key="index"
									class="border-b border-neutral-950/5 transition-colors last:border-0 hover:bg-neutral-950/5 dark:border-white/5 dark:hover:bg-white/5"
								>
									<td
										v-for="column in columns"
										:key="column"
										class="max-w-md truncate px-4 py-3 font-mono text-neutral-700 dark:text-slate-300"
										:title="row[column] ?? ''"
									>
										<a
											v-if="row[column]?.startsWith('http')"
											:href="row[column] ?? ''"
											target="_blank"
											>{{ row[column] ?? "" }}</a
										>
										<span v-else>{{ row[column] ?? "" }}</span>
									</td>
								</tr>
							</tbody>
						</table>
					</div>
					<div
						v-if="rows.length > 0"
						class="border-t border-neutral-200 px-4 py-2 font-mono text-xs text-neutral-500 dark:border-white/10 dark:text-slate-500"
					>
						{{ rows.length }} row{{ rows.length === 1 ? "" : "s" }}
					</div>
				</div>

				<!-- ASK -->
				<div
					v-else-if="resultKind === 'boolean'"
					class="rounded-xl border border-neutral-200 bg-neutral-50 p-6 dark:border-white/10 dark:bg-surface-dark/50"
				>
					<span
						class="inline-flex items-center gap-2 rounded-lg px-4 py-2 font-mono text-lg font-bold"
						:class="
							booleanResult
								? 'bg-green-500/15 text-green-700 dark:text-green-300'
								: 'bg-red-500/15 text-red-700 dark:text-red-300'
						"
					>
						{{ booleanResult }}
					</span>
				</div>

				<!-- CONSTRUCT / DESCRIBE -->
				<div
					v-else-if="resultKind === 'quads'"
					class="overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 dark:border-white/10 dark:bg-surface-dark/50"
				>
					<div v-if="quads.length === 0" class="p-6 text-neutral-600 dark:text-slate-400">
						The query returned no triples.
					</div>
					<div v-else class="overflow-x-auto">
						<table class="w-full border-collapse text-left text-sm">
							<thead>
								<tr
									class="border-b border-neutral-200 bg-neutral-100 dark:border-white/10 dark:bg-[#1a1f30]"
								>
									<th
										class="px-4 py-3 font-mono text-xs tracking-wider text-amber-600 dark:text-primary"
									>
										subject
									</th>
									<th
										class="px-4 py-3 font-mono text-xs tracking-wider text-amber-600 dark:text-primary"
									>
										predicate
									</th>
									<th
										class="px-4 py-3 font-mono text-xs tracking-wider text-amber-600 dark:text-primary"
									>
										object
									</th>
								</tr>
							</thead>
							<tbody>
								<tr
									v-for="(quad, index) in quads"
									:key="index"
									class="border-b border-neutral-950/5 transition-colors last:border-0 hover:bg-neutral-950/5 dark:border-white/5 dark:hover:bg-white/5"
								>
									<td
										class="max-w-xs truncate px-4 py-3 font-mono text-neutral-700 dark:text-slate-300"
										:title="quad.subject"
									>
										{{ quad.subject }}
									</td>
									<td
										class="max-w-xs truncate px-4 py-3 font-mono text-neutral-700 dark:text-slate-300"
										:title="quad.predicate"
									>
										{{ quad.predicate }}
									</td>
									<td
										class="max-w-xs truncate px-4 py-3 font-mono text-neutral-700 dark:text-slate-300"
										:title="quad.object"
									>
										{{ quad.object }}
									</td>
								</tr>
							</tbody>
						</table>
					</div>
					<div
						v-if="quads.length > 0"
						class="border-t border-neutral-200 px-4 py-2 font-mono text-xs text-neutral-500 dark:border-white/10 dark:text-slate-500"
					>
						{{ quads.length }} triple{{ quads.length === 1 ? "" : "s" }}
					</div>
				</div>
			</div>
			<p class="float-right text-sm text-neutral-600 dark:text-slate-400">
				Query engine powered by
				<a
					class="text-amber-600 underline decoration-amber-600/40 underline-offset-4 transition-colors hover:decoration-amber-600 dark:text-primary dark:decoration-primary/40 dark:hover:decoration-primary"
					href="https://comunica.dev/"
					rel="noreferrer"
					target="_blank"
					>Comunica</a
				>.
			</p>
		</div>
	</MainContent>
</template>
