//@esl

import { defineTransformer } from "@nuxt/content";
import { parseMarkdown } from "@nuxtjs/mdc/runtime";

import { getPlaygroundExample } from "../utils/playground";

export interface ParsedStep {
	id: number;
	content: string;
	highlightLines: Array<number>;
}

export interface LessonData {
	title: string;
	description: string;
	code: string;
	steps: Array<ParsedStep>;
}

const lessonTransformer = defineTransformer({
	name: "lesson-transformer",
	extensions: ["md", ".md"],
	parse: async (rawContent, options) => {
		const parsedContent = await parseMarkdown(rawContent.body, options);

		return {
			...parsedContent,
			id: rawContent.id,
			rawContent: rawContent.body,
		};
	},
	// The transform hook runs after parsing, before rendering
	transform(document) {
		const meta = document.data as Record<string, unknown>;
		const raw = (document.rawContent ?? "---") as string;

		// Only transform if it looks like a lesson
		if (!raw.includes("---") && !raw.includes("===")) {
			return { ...document, ...meta };
		}

		const chapters = raw.split(/^===$/m);
		const mappedChapters = chapters.map((chapterRaw) => {
			const sections = chapterRaw.split(/^---$/m);
			const header = sections[0]!.trim();

			const codeMatch = /```[^\n]*\n([\s\S]*?)```/.exec(header);
			const code = codeMatch ? codeMatch[1]!.trim() : "";

			if (!codeMatch || codeMatch.length > 2) return { ...document, ...meta };

			// Opt-in "Run in playground" button, e.g. ```sparql playground=kulturpool
			const fenceInfo = /```([^\n]*)\n/.exec(header)?.[1] ?? "";
			const playground = getPlaygroundExample(fenceInfo);

			const introText = header.replace(/```[^\n]*\n[\s\S]*?```/, "");

			const steps: Array<ParsedStep> = [];

			sections.slice(1).forEach((section, idx) => {
				const highlightLines: Array<number> = [];

				// extract highlight comment via regex
				// eslint-disable-next-line regexp/no-super-linear-backtracking
				const highlightMatch = /<!--\s*highlight:\s*([0-9\-, ]*)\s*-->/.exec(section);

				if (highlightMatch?.[1]) {
					highlightMatch[1]
						.split(",")
						.map((r) => r.trim())
						.forEach((r) => {
							const [start, end] = r.split("-").map((n) => parseInt(n, 10));

							if (start && !Number.isNaN(start)) {
								if (end && !Number.isNaN(end)) {
									for (let i = start; i <= end; i++) {
										highlightLines.push(i - 1);
									}
								} else {
									highlightLines.push(start - 1);
								}
							}
						});
				}

				const content = section.replace(/<!--\s*highlight:.*-->/, "").trim();

				steps.push({
					id: idx + 1,
					content,
					highlightLines,
				});
			});
			// Attach structured lesson
			const lesson = {
				code,
				steps,
				intro: introText,
				playground,
			};
			return lesson;
		});

		return { ...document, ...meta, chapters: mappedChapters };
	},
});

export default lessonTransformer;
