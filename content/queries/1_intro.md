# Introduction to SPARQL Queries
Welcome! This lesson guides you through the fundamental structure of a SPARQL query, using the knowledge graph of [Kulturpool](https://kulturpool.at). Scroll down to see how the query is built, piece by piece.

A knowledge graph stores its data as **triples**: statements of the form *subject – predicate – object*, e.g. "this object – has the title – *Sonja Knips*". Subjects and predicates are IRIs (web addresses that identify things), objects are either IRIs or literals (text, numbers, dates).

SPARQL is the query language for such graphs. The Kulturpool graph can be queried at the endpoint `https://sparql.kulturpool.at/query`, or in the user interface at [sparql.kulturpool.at](https://sparql.kulturpool.at/).

```sparql playground=kulturpool
# Find works by Gustav Klimt in the Belvedere

PREFIX edm: <http://www.europeana.eu/schemas/edm/>
PREFIX dc: <http://purl.org/dc/elements/1.1/>
PREFIX dcterms: <http://purl.org/dc/terms/>

SELECT ?title ?created
WHERE {
  ?aggregation edm:dataProvider "Österreichische Galerie Belvedere" ;
               edm:aggregatedCHO ?cho .

  ?cho dc:creator "Gustav Klimt" ;
       dc:title ?title ;
       dcterms:created ?created .

  # Skip the pages of sketchbooks
  FILTER(!STRSTARTS(?title, "Seite"))
}
ORDER BY ?created
LIMIT 10
```

---

## Introduction
This is our very first SPARQL query. It asks Kulturpool for works by Gustav Klimt that are held by the Belvedere in Vienna. Let's take a closer look!

---
<!-- highlight: 1, 16 -->
## Comments
Lines starting with `#` are comments. They are ignored when the query runs and help readers understand what the query does.

---
<!-- highlight: 3-5 -->
## The `PREFIX` Declaration
Prefixes are shortcuts. They let us abbreviate long IRIs to make our queries cleaner and more readable.

Kulturpool describes its objects in the [Europeana Data Model (EDM)](https://pro.europeana.eu/page/edm-documentation), which reuses well-known vocabularies. Here, `edm:` stands for EDM itself, and `dc:` and `dcterms:` for the [Dublin Core](https://www.dublincore.org/specifications/dublin-core/dcmi-terms/) vocabularies. With these declarations, `dc:title` is short for `<http://purl.org/dc/elements/1.1/title>`.

---
<!-- highlight: 7 -->
## The `SELECT` Clause
The `SELECT` clause specifies which variables you want to see in your results.

A variable in SPARQL starts with a `?`. In this case, we are asking for the title of each work and the date it was created.

---
<!-- highlight: 8, 18 -->
## The `WHERE` Clause
This is the heart of the query. The `WHERE` clause contains the graph patterns that are matched against the data.

Everything inside the curly braces `{}` defines the shape of the data we're looking for.

---
<!-- highlight: 9 -->
## Triple Patterns
Inside `WHERE`, we write **triple patterns**: `subject predicate object`, just like the triples in the graph, but with variables in some positions.

This pattern finds every `?aggregation` whose data provider (`edm:dataProvider`) is the literal `"Österreichische Galerie Belvedere"`. The variable can match anything; the literal has to match exactly.

In Kulturpool, an *aggregation* holds the information about who provides an object, where it can be viewed and under which rights.

---
<!-- highlight: 9-10 -->
## Several Patterns, One Subject
A semicolon `;` continues with the same subject, so the second line reads `?aggregation edm:aggregatedCHO ?cho`.

`edm:aggregatedCHO` points from the aggregation to the object it describes, the *cultural heritage object* (CHO).

---
<!-- highlight: 10, 12 -->
## Connecting Patterns
The variable `?cho` occurs in both groups of patterns. Since a variable has to stand for the same thing everywhere in a query, the two groups are joined: we only get objects that belong to an aggregation of the Belvedere.

---
<!-- highlight: 12-14 -->
## Describing the Object
These patterns describe the CHO itself: its creator (`dc:creator`) has to be `"Gustav Klimt"`, and its title (`dc:title`) and creation date (`dcterms:created`) are bound to the variables we selected.

Note that the Belvedere gives creators as plain text. Other institutions use IRIs from the [GND](https://www.dnb.de/gnd) instead, as the next chapter shows.

---
<!-- highlight: 16-17 -->
## Filtering Results
We use the `FILTER` clause to refine our results. Only solutions for which the condition is true are kept.

Klimt's sketchbooks are digitized page by page, with titles such as `Seite 83`. `STRSTARTS` checks whether the title starts with `"Seite"`, and `!` negates the result, so these pages are left out.

---
<!-- highlight: 19 -->
## Ordering Results
`ORDER BY` sorts the results, here by creation date, oldest first. Use `ORDER BY DESC(?created)` for the reverse order.

The dates are text such as `1897/1898`, so they are sorted alphabetically; for four-digit years that is the same as chronologically.

---
<!-- highlight: 20 -->
## Limiting Results
Finally, `LIMIT` restricts the number of results returned.

This is especially useful when testing queries on a large graph like Kulturpool's.
