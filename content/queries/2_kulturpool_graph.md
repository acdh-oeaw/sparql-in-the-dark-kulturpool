# The Kulturpool Graph

The introduction already used aggregations, objects and their creators. This chapter takes a closer look at how the knowledge graph of [Kulturpool](https://kulturpool.at) is structured.

The graph contains all Kulturpool objects, described in the [Europeana Data Model (EDM)](https://pro.europeana.eu/page/edm-documentation). Two kinds of resources make up every record:

- an **aggregation** of type `ore:Aggregation`, which describes how a data provider delivers the object (who provides it, where it can be viewed, under which rights), and
- a **cultural heritage object** (CHO) of type `edm:ProvidedCHO`, which describes the object itself (title, creator, date, subjects, …).

The aggregation points to its CHO with the predicate `edm:aggregatedCHO`.

A good first step is to look at what is said about the aggregations:

```sparql playground=kulturpool
prefix ore: <http://www.openarchives.org/ore/terms/>

select *
where {
	?aggregation a ore:Aggregation .
	?aggregation ?pAggregation ?oAggregation .
}
limit 100
```

---
<!-- highlight: 5 -->
## Finding Aggregations
The first triple pattern matches every resource that is typed as `ore:Aggregation`, i.e. one aggregation per record in Kulturpool.

Aggregation IRIs follow the pattern `https://id.kulturpool.at/[UUID]/aggregation`.

---
<!-- highlight: 6 -->
## Everything About Them
The second pattern uses variables for both predicate and object, so it matches every triple about the aggregation. Because both patterns share the subject `?aggregation`, they are joined: only triples about aggregations are returned.

Typical predicates are `edm:dataProvider` (the institution), `edm:provider`, `edm:isShownAt` (the object's web page), `edm:isShownBy` (a media file), `edm:object` (a preview image), `edm:rights` and `edm:aggregatedCHO`.

---
<!-- highlight: 3, 8 -->
## Keeping It Small
`select *` returns all variables of the query. Since the graph is very large, `limit` caps the result at 100 rows, which is enough to get a first impression.

===

The same pattern works for the cultural heritage objects:

```sparql playground=kulturpool
prefix edm: <http://www.europeana.eu/schemas/edm/>

select *
where {
	?cho a edm:ProvidedCHO .
	?cho ?pCHO ?oCHO .
}
limit 100
```

---
<!-- highlight: 5 -->
## Provided CHOs
`edm:ProvidedCHO` is the EDM class for the object that is described: a painting, a book, a photograph, a herbarium sheet.

CHO IRIs use the same UUID as their aggregation, but end in `/cho`: `https://id.kulturpool.at/[UUID]/cho`.

---
<!-- highlight: 6 -->
## Descriptive Metadata
Most of the descriptive metadata lives on the CHO, mostly as Dublin Core properties: `dc:title`, `dc:creator`, `dc:description`, `dc:subject`, `dcterms:created`, `dcterms:spatial` and many more.

Note that objects of these triples can be literals or IRIs. A creator, for example, may be given as a plain name or as an IRI from the [GND](https://www.dnb.de/gnd) (`https://d-nb.info/gnd/…`).

===

With both kinds of resources known, they can be joined along `edm:aggregatedCHO`. The following query lists objects together with the institution that provides them:

```sparql playground=kulturpool
prefix edm: <http://www.europeana.eu/schemas/edm/>
prefix dc: <http://purl.org/dc/elements/1.1/>

select ?aggregation ?cho ?title ?provider
where {
	?aggregation edm:aggregatedCHO ?cho ;
				 edm:dataProvider ?provider .
	?cho dc:title ?title .
}
limit 10
```

---
<!-- highlight: 6 -->
## From Aggregation to CHO
`edm:aggregatedCHO` connects each aggregation to the object it describes. Following it is the standard way to get from provider information to object information, and vice versa.

---
<!-- highlight: 6-7 -->
## Predicate-Object Lists
The semicolon continues a triple pattern with the same subject, so the second line reads `?aggregation edm:dataProvider ?provider`.

`edm:dataProvider` holds the name of the institution as a literal, e.g. `Österreichische Nationalbibliothek`.

---
<!-- highlight: 8 -->
## Titles
The title is a property of the CHO, not of the aggregation, so it is matched via `?cho`.

===

Grouping and counting reveals how the data is distributed. This query counts the CHOs per `dc:creator`:

```sparql playground=kulturpool
prefix edm: <http://www.europeana.eu/schemas/edm/>
prefix dc: <http://purl.org/dc/elements/1.1/>

select ?dcCreator (count(?cho) as ?count)
where {
	?cho a edm:ProvidedCHO .
	?cho dc:creator ?dcCreator .
}
group by ?dcCreator
order by desc(?count)
limit 100
```

---
<!-- highlight: 7 -->
## Creators
`dc:creator` is taken as-is from the data providers, so its values are heterogeneous: plain literals (`"anonym"`), GND IRIs, URNs and IRIs local to a provider all occur.

---
<!-- highlight: 4, 9 -->
## Grouping and Counting
The results are grouped by creator and the CHOs of each group are counted with `count`.

---
<!-- highlight: 10-11 -->
## Most Frequent First
`order by desc(?count)` puts the most frequent creators at the top.

The top of the list is a good place to spot data quality issues: placeholders such as `"anonym"` or `"REFLORA provisional entry"` are among the most frequent "creators".

===

Creators given as IRIs are usually not bare identifiers. The records also contain contextual entities that describe them, with a name in `skos:prefLabel`. This makes it possible to count creators by name:

```sparql playground=kulturpool
prefix edm: <http://www.europeana.eu/schemas/edm/>
prefix dc: <http://purl.org/dc/elements/1.1/>
prefix skos: <http://www.w3.org/2004/02/skos/core#>

select ?creator ?name (count(?cho) as ?count)
where {
	?cho a edm:ProvidedCHO ;
		dc:creator ?creator .
	?creator skos:prefLabel ?name .
}
group by ?creator ?name
order by desc(?count)
limit 100
```

---
<!-- highlight: 9 -->
## Contextual Entities
This pattern only matches creators that are IRIs with a `skos:prefLabel`. Literal creators drop out, since a literal can't be the subject of a triple.

The same pattern works for other contextual entities, e.g. the GND subject headings referenced with `dc:subject`.

---
<!-- highlight: 5, 11 -->
## Grouping by Two Variables
The results are grouped by both the creator IRI and its name. A creator with more than one `skos:prefLabel` therefore shows up in several rows, one per label.
