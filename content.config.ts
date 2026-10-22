import { defineCollection, defineContentConfig, z } from "@nuxt/content";

export default defineContentConfig({
	collections: {
		content: defineCollection({
			type: "page",
			source: "*.md",
		}),
		queries: defineCollection({
			type: "page",
			source: "queries/*.md",
			schema: z
				.object({
					chapters: z.array(
						z.object({
							steps: z
								.array(
									z.object({
										id: z.number(),
										content: z.string(),
										highlightLines: z.array(z.number()),
									}),
								)
								.optional(),
							code: z.string().optional(),
							intro: z.string().optional(),
							playground: z.string().optional(),
							defaultPrefixes: z.boolean().optional(),
						}),
					),
					title: z.string().nullable(),
					description: z.string().nullable(),
					rawbody: z.string(),
				})
				.passthrough(),
		}),
		examples: defineCollection({
			type: "data",
			source: "examples/*.yml",
			schema: z.object({
				label: z.string(),
				mode: z.enum(["endpoint", "rdf"]),
				/** SPARQL endpoint URL, for `mode: endpoint`. */
				source: z.string().optional(),
				/** URL of an RDF document to load, for `mode: rdf`. */
				dataUrl: z.string().optional(),
				mediaType: z.string().optional(),
				prefixes: z.string().optional(),
				query: z.string(),
			}),
		}),
	},
});
