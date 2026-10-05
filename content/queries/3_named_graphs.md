# Datasets and Named Graphs

A SPARQL query runs against a dataset that consists of a default graph and any number of named graphs (see [RDF Datasets](https://www.w3.org/TR/sparql12-query/#rdfDataset) in the SPARQL 1.2 specification). Kulturpool uses named graphs on two levels:

- every **dataset** of a data provider is a named graph following the schema `https://id.kulturpool.at/dataset/[DATASET]#graph`, e.g. `https://id.kulturpool.at/dataset/oenb-abo#graph`, and
- every **record** is a named graph following the schema `https://id.kulturpool.at/[UUID]/aggregation#graph`.

The queries of the previous chapter don't mention any graph and still find all records; the `GRAPH` keyword lets a query narrow down where to look.

The first question is which datasets exist:

```sparql playground=kulturpool
prefix edm: <http://www.europeana.eu/schemas/edm/>

select distinct ?graph ?provider
where {
	graph ?graph {
		?aggregation edm:dataProvider ?provider .
	}
	filter (strstarts(str(?graph), "https://id.kulturpool.at/dataset/"))
}
```

---
<!-- highlight: 5-7 -->
## Matching Graphs
`graph ?graph { … }` matches the enclosed pattern in every named graph and binds the name of the graph to `?graph`.

See [Querying the Dataset](https://www.w3.org/TR/sparql12-query/#queryDataset) in the SPARQL 1.2 specification.

---
<!-- highlight: 6 -->
## A Selective Pattern
Every aggregation states its `edm:dataProvider`, so this pattern finds every graph that contains a record, along with the name of the provider.

Using a concrete predicate instead of `?s ?p ?o` also keeps the query fast; see the end of this chapter.

---
<!-- highlight: 8 -->
## Datasets Only
Each aggregation is part of both its dataset graph and its record graph. The FILTER keeps only graphs whose IRI starts with the dataset prefix.

---
<!-- highlight: 3 -->
## One Row per Dataset
DISTINCT collapses the many aggregations of a dataset into a single row. Some providers have more than one dataset, e.g. the Belvedere with `belvedere` and `belvedere-bibliothek`.

===

Once the name of a dataset is known, a query can be restricted to it:

```sparql playground=kulturpool
select *
where {
	graph <https://id.kulturpool.at/dataset/oenb-abo#graph> {
		?s ?p ?o .
	}
}
limit 100
```

---
<!-- highlight: 3 -->
## A Fixed Graph
Instead of a variable, the GRAPH clause names a graph IRI. Only triples in that graph can match: here, the *Austrian Books Online* dataset of the Austrian National Library.

---
<!-- highlight: 4 -->
## Any Pattern Will Do
Any graph pattern can be placed inside the GRAPH clause. Combined with the patterns from the previous chapter, it limits e.g. the creator statistics to a single dataset.

===

Record graphs contain everything that belongs to a single record:

```sparql playground=kulturpool
select *
where {
	graph <https://id.kulturpool.at/00000001-5cc4-4b18-b68b-a5c2a18337c5/aggregation#graph> {
		?s ?p ?o .
	}
}
```

---
<!-- highlight: 3 -->
## One Record
The graph name uses the record's UUID, just like the IRIs of its aggregation (`…/aggregation`) and CHO (`…/cho`).

---
<!-- highlight: 4 -->
## Contents of a Record
The graph contains the triples about the aggregation and the CHO, and also the contextual entities the record refers to, e.g. GND persons and subject headings with their `skos:prefLabel`.

===

## Good to Know: Slow DISTINCT GRAPH Queries

Asking for distinct graph names with an unrestricted pattern is very slow on the Kulturpool endpoint and runs into the service timeout:

```sparql
select distinct ?g
where {
	graph ?g {
		?s ?p ?o .
	}
}
limit 10
```

---
<!-- highlight: 1, 3-5 -->
## Avoid
Together, DISTINCT and the unrestricted `?s ?p ?o` pattern inside the GRAPH clause cause the timeout, even with a LIMIT of 10. It's currently not known in which queries, and why, grouping graphs with DISTINCT has this effect.

===

Restricting the pattern, e.g. to a predicate, helps where possible:

```sparql playground=kulturpool
prefix edm: <http://www.europeana.eu/schemas/edm/>

select distinct ?g
where {
	graph ?g {
		?s edm:aggregatedCHO ?o .
	}
}
limit 10
```

---
<!-- highlight: 6 -->
## A Concrete Predicate
With `edm:aggregatedCHO` in place of a variable, the same query returns in about a second. The query that lists datasets at the beginning of this chapter uses the same trick.
