# Linking to Wikidata

Many creators in Kulturpool are identified by GND IRIs. Wikidata records GND identifiers too, with the property [P227](https://www.wikidata.org/wiki/Property:P227), so the two graphs can be joined on them.

SPARQL 1.1 federated queries make that join possible in a single query: the Kulturpool endpoint sends part of the query to the Wikidata endpoint and combines the results.

The following query takes a few objects from Kulturpool whose creator has a GND IRI and looks up everything Wikidata knows about these creators:

```sparql playground=kulturpool
prefix dc: <http://purl.org/dc/elements/1.1/>
prefix dcterms: <http://purl.org/dc/terms/>
prefix edm: <http://www.europeana.eu/schemas/edm/>
prefix xsd: <http://www.w3.org/2001/XMLSchema#>
prefix wikibase: <http://wikiba.se/ontology#>
prefix bd: <http://www.bigdata.com/rdf#>

select ?cho ?title ?gndCreator ?wikidataObject ?wikidataSubjectLabel ?wikidataEntityLabel ?wikidataObjectLabel
where {
	{
		select ?cho ?title ?gndCreator
		where {
			?aggregation edm:aggregatedCHO ?cho .
			?cho a edm:ProvidedCHO ;
				dc:title ?title ;
				dc:creator ?gndCreator ;
				dcterms:created ?created .
			filter (isIRI(?gndCreator))
			filter (strstarts(str(?gndCreator), "https://d-nb.info/gnd/"))
			filter (xsd:integer(substr(str(?created), 1, 4)) >= 1920)
		}
		group by ?cho ?title ?gndCreator
		offset 123
		limit 10
	}
	service <https://query.wikidata.org/sparql> {
		?wikidataSubject <http://www.wikidata.org/prop/direct-normalized/P227> ?gndCreator .
		?wikidataSubject ?wikidataPredicate ?wikidataObject .
		{ ?wikidataEntity wikibase:directClaim ?wikidataPredicate }
		union
		{ ?wikidataEntity wikibase:claim ?wikidataPredicate }
		filter (strstarts(str(?wikidataObject), "http://www.wikidata.org/entity/Q"))

		# Wikidata label service
		service wikibase:label { bd:serviceParam wikibase:language "de" . }
		optional { ?wikidataSubjectLabel a <urn:something> } # hack to bind labels to the outer scope
		optional { ?wikidataEntityLabel a <urn:something> }
		optional { ?wikidataObjectLabel a <urn:something> }
	}
}
limit 50
```

---
<!-- highlight: 10-25 -->
## Kulturpool First
The query has two parts. The first one is a subquery that runs on Kulturpool and selects a handful of objects together with their title and GND creator.

Keeping this part small matters: its results are sent on to Wikidata, so every additional row means more work for the remote endpoint.

---
<!-- highlight: 18-19 -->
## GND Creators Only
Only creators that are IRIs in the GND namespace can be joined with Wikidata, so the FILTERs drop literals and IRIs from other namespaces.

---
<!-- highlight: 17, 20 -->
## Created Since 1920
`dcterms:created` is free text, e.g. `1925` or `[1695]`. The FILTER takes the first four characters, casts them to an integer and keeps objects created in 1920 or later.

Values that can't be cast, such as `[169`, cause an error inside the FILTER, which simply excludes the row.

---
<!-- highlight: 22-24 -->
## Paging
GROUP BY removes duplicate rows, e.g. from objects with more than one `dcterms:created` value. OFFSET and LIMIT then pick a page of ten objects.

Without an ORDER BY the order is arbitrary, so the page is just a sample. Change the OFFSET to see other objects.

---
<!-- highlight: 26 -->
## Federation
The SERVICE clause sends the enclosed pattern to the Wikidata endpoint. Variables shared with the rest of the query, here `?gndCreator`, join the remote results with the local ones.

See [SPARQL 1.1 Federated Query](https://www.w3.org/TR/sparql11-federated-query/).

---
<!-- highlight: 27 -->
## Joining on the GND
The `direct-normalized` variant of P227 gives the GND identifier as a full IRI (`https://d-nb.info/gnd/…`) instead of a string, so it matches Kulturpool's creator IRIs directly.

---
<!-- highlight: 28-32 -->
## Everything Wikidata Knows
The next pattern matches all statements about the Wikidata item. To get readable names for the predicates, the UNION looks up the Wikidata property entity (`?wikidataEntity`) behind each predicate, both for direct (`wdt:`) and full (`p:`) statements.

The FILTER keeps only statements whose value is another Wikidata item, e.g. *occupation: photographer*.

---
<!-- highlight: 34-38 -->
## Labels
The Wikidata label service adds a `…Label` variable for each variable of the pattern, here in German.

The label variables are only bound inside the SERVICE clause, though. The OPTIONAL patterns never match, but they mention the label variables, so they are passed back to the outer query.

---
<!-- highlight: 41 -->
## Limit
Each object can have dozens of Wikidata statements, so the final LIMIT keeps the result readable.
