# SPARQL in the Dark ✨🌘 - Hack the Pool edition

**Patterns for Exploring Kulturpool's Knowledge Graphs**

## Introduction
This repository contains a collection of SPARQL queries for exploring Kulturpool.

## Contributing
In order to contribute a chapter, add a markdown file to [content/queries](./content/queries), following the same structure as the existing chapters.

### Chapter files

Each chapter is a single markdown file, e.g. `6_my_chapter.md`. The numeric prefix defines the order in which chapters appear. Start the file with a `# Title` heading and a short introduction, then build the chapter from *lessons*.

A lesson consists of a query followed by a series of explanatory steps. Two separator lines, each on a line of its own, structure the file:

| Syntax | Meaning |
| ------ | ------- |
| `===` | Starts a new lesson. Everything between two `===` lines is one lesson. |
| `---` | Starts a new step within a lesson. |

Each lesson has this layout:

````markdown
Introductory text, shown above the query.

```sparql
select distinct ?class
where {
	?class a rdfs:Class .
}
```

---
<!-- highlight: 3 -->
## Step title
Explanation of the highlighted part of the query.

---
<!-- highlight: 1, 2-3 -->
## Another step
Explanation of another part.

===

Introductory text of the next lesson ...
````

- **Intro and query:** everything before the first `---` of a lesson is the introduction. It must contain exactly one fenced code block, which is the query that the steps walk through. A lesson without a code block is skipped.
- **Steps:** every `---` section after that is one step. Steps are shown one after another, and can contain any markdown (headings, links, blockquotes, inline code). A heading is optional, but recommended.
- **One query per lesson:** if you want to show a second query, start a new lesson with `===` and give it its own introduction.
- **Prefixes:** declare the prefixes a query needs (`prefix rdfs: <...>`) if it should be copy-pasteable. Lines of the prefix declarations count towards the highlighted line numbers.

### Highlighting lines

Add an HTML comment with a `highlight` directive anywhere in a step to highlight lines of the lesson's query while that step is shown:

```markdown
<!-- highlight: 11 -->        a single line
<!-- highlight: 6-8 -->        a range of lines
<!-- highlight: 1, 5-7, 10 --> any combination, separated by commas
```

- Line numbers are **1-based and relative to the code block** of the lesson, counting blank lines and comments. They are not line numbers of the markdown file.
- The comment is removed from the rendered text. Steps without a `highlight` comment highlight nothing.
- Convention: put the comment right below the `---` separator, before the step's heading.

### Running a query in the playground

Add `playground` to the info string of the code fence to show a "Run in playground" button for that query:

````markdown
```sparql playground
```

```sparql playground=dbpedia_dump
```
````

A bare `playground` uses the playground's default data source. `playground=<id>` opens the query with the data source of the matching example in [content/examples](./content/examples), where `<id>` is the example's file name without the number prefix and extension (e.g. `dbpedia_dump` for `4_dbpedia_dump.yml`). Queries without the flag are display-only.

### Adding an example

Examples are the data sources and starter queries offered in the playground; they are also what `playground=<id>` in a chapter refers to (see above). To add one, create a YAML file in [content/examples](./content/examples), e.g. `5_my_example.yml`.

The numeric prefix defines the order in the playground's example list. It is stripped to form the example's id (`5_my_example.yml` → `my_example`).

Every example needs a `label` (the name shown in the playground), a `mode` and a starter `query`. `prefixes` is optional and is shown in the playground's prefixes editor, separate from the query.

There are two modes:

**`mode: endpoint`** queries a remote SPARQL endpoint, given as `source`:

```yaml
label: Cats (Wikidata)
mode: endpoint
source: https://query.wikidata.org/sparql
prefixes: |-
  PREFIX wd: <http://www.wikidata.org/entity/>
  PREFIX wdt: <http://www.wikidata.org/prop/direct/>
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
query: |-
  SELECT ?item ?label WHERE {
    ?item wdt:P31 wd:Q146 ;
          rdfs:label ?label .
    FILTER(LANG(?label) = "en")
  }
  LIMIT 20
```

**`mode: rdf`** loads an RDF document and queries it in the browser. Put the file in [public/data](./public/data) and reference it with `dataUrl` (a path starting with `/data/`). Set `mediaType` to the file's format, e.g. `text/turtle`:

```yaml
label: Austria (DBpedia dump)
mode: rdf
mediaType: text/turtle
dataUrl: /data/sample-data.ttl
prefixes: |-
  PREFIX dbo: <http://dbpedia.org/ontology/>
  PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>
query: |-
  SELECT ?city ?name ?population WHERE {
    ?city a dbo:City ;
          rdfs:label ?name ;
          dbo:populationTotal ?population .
  }
```

| Field | Required | Description |
| ----- | -------- | ----------- |
| `label` | yes | Display name in the playground. |
| `mode` | yes | `endpoint` or `rdf`. |
| `query` | yes | The query shown when the example is selected. |
| `source` | for `endpoint` | URL of the SPARQL endpoint. |
| `dataUrl` | for `rdf` | URL of the RDF document to load. |
| `mediaType` | for `rdf` | Media type of that document, e.g. `text/turtle`. |
| `prefixes` | no | `PREFIX` declarations for the prefixes editor. |

Use `|-` for the multi-line `prefixes` and `query` values, so the text is kept as written without a trailing newline.

## Running locally

### Prerequisites

- [Node.js](https://nodejs.org) 24 (see `engines` in [package.json](./package.json))
- [pnpm](https://pnpm.io) 10; the easiest way to get the right version is [Corepack](https://nodejs.org/api/corepack.html), which ships with Node.js: `corepack enable`

The project only supports pnpm; installing with npm or yarn is rejected.

### Setup

```sh
# install dependencies
pnpm install

# create your local environment file
cp .env.local.example .env.local
```

The scripts read their environment variables from `.env.local`. The defaults in `.env.local.example` work for local development; `NUXT_PUBLIC_APP_BASE_URL` has to be set, since `nuxt.config.ts` reads it.

### Development

```sh
pnpm run dev
```

This starts the dev server at <http://localhost:3000>. Changes to chapters in `content/queries` and examples in `content/examples` are picked up while the server is running, so you can preview a new chapter or example right away.

### Production build

```sh
pnpm run build     # build the app
pnpm run start     # preview the build
pnpm run generate  # alternatively, generate a static site
```

The GitHub Pages deployment (see [.github/workflows/deploy.yml](./.github/workflows/deploy.yml)) builds with `nuxt build --preset github_pages`.

### Checks

Before opening a pull request, run:

```sh
pnpm run lint:check    # eslint and stylelint
pnpm run format:check  # prettier (use format:fix to apply)
pnpm run types:check   # typescript
```

A pre-commit hook runs the linters and Prettier on staged files; it is installed automatically by `pnpm install`.
