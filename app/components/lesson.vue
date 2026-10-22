<script lang="ts" setup>
import { VueMarkdownIt } from "@f3ve/vue-markdown-it";
import type { QueriesCollectionItem } from "@nuxt/content";
import { PlayIcon } from "lucide-vue-next";

import CodeHighlighter from "@/components/code-highlighter.vue";
import ScrollSection from "@/components/scroll-section.vue";

const props = defineProps<{
	lessonData: QueriesCollectionItem["chapters"][0];
	isLast: boolean;
}>();
const t = useTranslations();
const progress = computed(() => {
	if (!props.lessonData || !props.lessonData.steps || props.lessonData.steps.length === 0)
		return 100;
	const activeIndex = props.lessonData.steps.findIndex((step) => step.id === activeStepId.value);
	return (100 * (activeIndex + 1)) / props.lessonData.steps.length;
});

const activeStep = computed(() => {
	if (!props.lessonData || !props.lessonData.steps) return { highlightLines: null };
	return props.lessonData.steps.find((step) => step.id === activeStepId.value);
});
const activeStepId = ref(1);

/** Only set when the code fence opts in via `playground` (see `getPlaygroundExample`). */
const playgroundLink = computed(() => {
	const { code, playground, defaultPrefixes } = props.lessonData;
	if (!code || playground == null) return undefined;
	return getPlaygroundLink(code, playground, defaultPrefixes);
});
const handleStepVisible = (id: number) => {
	activeStepId.value = id;
};

function jumpToStep(lineIndex: number) {
	const firstMatchingStep = props.lessonData.steps
		?.filter((step) => step.highlightLines.includes(lineIndex) && step.id !== activeStepId.value)
		.toSorted((a, b) => a.highlightLines.length - b.highlightLines.length)[0];
	if (firstMatchingStep)
		document
			.querySelector(`[data-step-id="${firstMatchingStep.id}"]`)
			?.scrollIntoView({ block: "center", behavior: "smooth" });
}
</script>

<template>
	<template v-if="lessonData && lessonData.code && lessonData.steps">
		<div
			class="mx-auto max-w-3xl py-12 text-lg leading-relaxed text-neutral-600 md:py-20 md:text-justify md:text-xl dark:text-slate-400"
		>
			<VueMarkdownIt :source="lessonData.intro ?? ''" />
		</div>
		<div class="grid grid-cols-1 items-start gap-12 lg:grid-cols-2 lg:gap-24">
			<div
				class="hidden self-start lg:sticky lg:top-32 lg:flex lg:max-h-[calc(100vh-10rem)] lg:flex-col"
			>
				<div class="mb-6 flex items-center gap-4">
					<span
						class="font-mono text-xs tracking-widest text-neutral-500 uppercase dark:text-slate-500"
						>Progress</span
					>
					<div class="h-1 flex-1 overflow-hidden rounded-full bg-neutral-950/10 dark:bg-white/10">
						<div
							class="h-full bg-primary transition-all duration-500 ease-out"
							:style="{ width: `${progress}%` }"
						/>
					</div>
					<span class="font-mono text-xs text-amber-600 dark:text-primary"
						>{{ Math.round(progress) }}%</span
					>
				</div>

				<div
					class="flex min-h-0 flex-col overflow-hidden rounded-xl border border-neutral-200 bg-neutral-50 shadow-2xl ring-1 shadow-neutral-950/10 ring-neutral-950/5 dark:border-white/10 dark:bg-[#151928] dark:shadow-black/50 dark:ring-white/5"
				>
					<div
						class="flex items-center justify-between border-b border-neutral-200 bg-neutral-100 px-4 py-3 dark:border-white/5 dark:bg-[#1a1f30]"
					>
						<div class="flex items-center gap-2">
							<div class="size-3 rounded-full border border-red-500/50 bg-red-500/20"></div>
							<div class="size-3 rounded-full border border-yellow-500/50 bg-yellow-500/20"></div>
							<div class="size-3 rounded-full border border-green-500/50 bg-green-500/20"></div>
						</div>
						<div class="flex items-center gap-4">
							<NuxtLink
								v-if="playgroundLink"
								class="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700 transition-colors hover:border-primary/50 hover:text-neutral-950 dark:border-white/10 dark:bg-surface-dark/50 dark:text-slate-300 dark:hover:text-white"
								:to="playgroundLink"
							>
								<PlayIcon class="size-3" />
								{{ t("Playground.run-in-playground") }}
							</NuxtLink>
							<div class="font-mono text-xs text-neutral-500 dark:text-slate-500">query.sparql</div>
						</div>
					</div>
					<div v-if="lessonData.code" class="min-h-0 overflow-auto py-4">
						<CodeHighlighter
							:active-lines="activeStep?.highlightLines ?? []"
							:code="lessonData.code"
							@click-line="jumpToStep"
						/>
					</div>
				</div>
			</div>
			<!-- Mobile View -->
			<div class="sticky top-0 z-40 -mx-4 mb-8 min-w-0 shadow-2xl sm:mx-0 lg:hidden">
				<div v-if="lessonData.code" class="relative">
					<div
						class="max-h-[30vh] overflow-auto border-b border-neutral-200 bg-neutral-50 p-4 pl-0 dark:border-white/10 dark:bg-[#151928]"
					>
						<CodeHighlighter
							:active-lines="activeStep?.highlightLines ?? []"
							:code="lessonData.code"
						/>
					</div>
					<NuxtLink
						v-if="playgroundLink"
						aria-label="Run in playground"
						class="absolute top-3 right-5 z-10 inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs text-neutral-700 shadow-md transition-colors hover:border-primary/50 hover:text-neutral-950 dark:border-white/10 dark:bg-surface-dark dark:text-slate-300 dark:hover:text-white"
						:to="playgroundLink"
					>
						<PlayIcon class="size-3" />
						{{ t("Playground.run") }}
					</NuxtLink>
				</div>
				<div
					class="h-1 bg-primary transition-all duration-300"
					:style="{ width: `${progress}%` }"
				></div>
			</div>

			<div v-if="lessonData.steps" class="relative min-w-0">
				<div
					class="absolute top-0 bottom-0 left-8 w-px bg-neutral-950/5 lg:hidden dark:bg-white/5"
				></div>

				<ScrollSection
					v-for="(step, index) in lessonData.steps"
					:id="step.id"
					:key="step.id"
					:content="step.content"
					:is-active="activeStepId === step.id"
					:is-last="props.isLast && index === lessonData.steps.length - 1"
					@visible="handleStepVisible"
				/>
			</div>
		</div>
	</template>
</template>

<style>
@reference "../styles/index.css";

.vue-md-it-wrapper h1 {
	@apply text-3xl sm:text-4xl md:text-5xl font-bold mb-6 text-neutral-950 leading-tight dark:text-white;
}

:not(.prose) > .vue-md-it-wrapper h2 {
	@apply text-2xl md:text-3xl font-bold my-6 text-neutral-950 leading-tight dark:text-white;
}

:not(.prose) > .vue-md-it-wrapper strong,
.vue-md-it-wrapper a {
	@apply text-neutral-950 dark:text-white;
}

blockquote {
	@apply text-left p-4 sm:p-6 border border-primary/50 bg-surface-light opacity-100 text-neutral-950 text-base my-4 sm:m-4 dark:bg-surface-dark dark:text-white;
}

.vue-md-it-wrapper p code {
	@apply text-amber-600 dark:text-primary;
}

:where(code):not(:where([class~="not-prose"], [class~="not-prose"] *))::before,
:where(code):not(:where([class~="not-prose"], [class~="not-prose"] *))::after,
.vue-md-it-wrapper p code ::after,
.vue-md-it-wrapper p code ::before {
	content: none;
}
</style>
