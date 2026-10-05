# Linking to PFP

The [Prosopographical Research Platform Austria (PFP)](https://www.oeaw.ac.at/de/acdh/forschung/dh-forschung-infrastruktur/aktivitaeten/dh-datenmodellierung/pfp-prosopographische-plattform-oesterreich) of the Austrian Centre for Digital Humanities brings together information about persons from several prosopographical databases, e.g. the *Österreichisches Biographisches Lexikon* (ÖBL) and the *PMB – Personen der Moderne*. Like Kulturpool, it refers to persons by their GND IRIs, so the two graphs can be joined on them, just like Kulturpool and Wikidata in the previous chapter.

The following query looks up persons named *Klimt* in PFP and finds the Kulturpool objects they created:

```sparql playground=kulturpool
prefix rdfs: <http://www.w3.org/2000/01/rdf-schema#>
prefix owl: <http://www.w3.org/2002/07/owl#>
prefix dc: <http://purl.org/dc/elements/1.1/>
prefix edm: <http://www.europeana.eu/schemas/edm/>
prefix crm: <http://www.cidoc-crm.org/cidoc-crm/>
prefix pfp: <https://pfp-schema.acdh.oeaw.ac.at/schema#>

select ?cho ?title ?gndCreator ?person ?label ?pfp
where {
	?aggregation edm:aggregatedCHO ?cho .
	?cho a edm:ProvidedCHO ;
		dc:title ?title ;
		dc:creator ?gndCreator .

	{
		select (sample(?gndCreator_pre) as ?gndCreator) (sample(?person_pre) as ?person) (sample(?label_pre) as ?label) ?pfp
		where {
			service <https://pfp-ts-backend.acdh-dev.oeaw.ac.at> {
				?person_pre a crm:E21_Person ;
					rdfs:label ?label_pre ;
					owl:sameAs ?gndCreator_pre ;
					pfp:proxy_for ?pfp_uuid .
				filter (contains(?label_pre, "Klimt"))
				filter (strstarts(str(?gndCreator_pre), "https://d-nb.info/gnd/"))
				bind (uri(concat("https://pfp-api.acdh-dev.oeaw.ac.at/person/", str(?pfp_uuid), "/")) as ?pfp)
			}
		}
		group by ?pfp
	}
}
limit 50
```

---
<!-- highlight: 10-13 -->
## Kulturpool Objects
The first part is a familiar pattern: every CHO in Kulturpool with its title and creator.

On its own, this pattern would match a huge number of objects. It's the join with PFP part below that narrows it down.

---
<!-- highlight: 15-29 -->
## A Subquery for PFP
The second part is a subquery. SPARQL evaluates subqueries on their own, so PFP part produces a small table of persons, which is then joined with the Kulturpool objects.

Unlike in the Wikidata chapter, the selection happens on the remote side here: PFP decides which persons are of interest, Kulturpool contributes their objects.

---
<!-- highlight: 18 -->
## Federation
The SERVICE clause sends the enclosed pattern to the triple store of PFP.

See [SPARQL 1.1 Federated Query](https://www.w3.org/TR/sparql11-federated-query/).

---
<!-- highlight: 19-22 -->
## Persons in PFP
PFP describes persons with [CIDOC CRM](https://cidoc-crm.org), where a person is a `crm:E21_Person`.

Each source database contributes its own record of a person, a so-called *proxy*. Proxies carry a name (`rdfs:label`), links to other identifiers (`owl:sameAs`: GND, Wikidata, DOIs, …) and, with `pfp:proxy_for`, the UUID of the PFP person they stand for. Gustav Klimt, for example, has proxies from both the ÖBL and the PMB, which share one UUID.

---
<!-- highlight: 23 -->
## Finding Persons by Name
The FILTER keeps proxies whose label contains `"Klimt"`. Next to Gustav, this also matches other members of the family, such as his brothers Ernst and Georg.

---
<!-- highlight: 24 -->
## GND Links Only
A proxy usually has several `owl:sameAs` links. Only GND IRIs can be joined with the creators in Kulturpool, so the FILTER drops all others.

---
<!-- highlight: 25 -->
## Building IRIs
`BIND` assigns the result of an expression to a new variable. Here, `concat` puts the PFP UUID into a URL of the PFP API, and `uri` turns the string into an IRI. Opening it returns everything PFP knows about the person, as JSON.

See [Assignment](https://www.w3.org/TR/sparql12-query/#assignment) in the SPARQL 1.2 specification.

---
<!-- highlight: 16, 28 -->
## One Row per Person
Since every proxy of a person matches the pattern, a person would appear once per proxy and GND link. `group by ?pfp` merges these rows into one per PFP person.

All other variables have to be aggregated in a grouped query. `sample` picks any one value of the group, so `?label` may be `Gustav Klimt` (from the ÖBL) or `Klimt, Gustav` (from the PMB).

---
<!-- highlight: 13, 16 -->
## Joining on the GND
`?gndCreator` occurs in both parts of the query, so a Kulturpool object only matches if its `dc:creator` is the GND IRI of one of the persons found in PFP.

Objects whose creator is given as plain text can't match. That's why this query finds no works from the Belvedere, which, as seen in the introduction, gives its creators as names.

---
<!-- highlight: 31 -->
## Limit
The query finds about 300 objects, almost all of them by Gustav Klimt and most of them held by the Albertina. LIMIT returns the first 50.
