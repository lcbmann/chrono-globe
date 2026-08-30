# Territory source expansion catalog

Chrono Globe expands by adding independently attributable territory assertions, not by treating every downloadable map as an equally reliable vote. This catalog records the current ingestion order and licensing blockers.

## Integrated

| Dataset | Coverage and role | Terms | Status |
| --- | --- | --- | --- |
| [Historical Basemaps](https://github.com/aourednik/historical-basemaps) | Broad global political and cultural fallback, 123,000 BCE–2010 CE, 53 snapshots | GPL-3.0 | Integrated and pinned |
| [Seshat Cliopatria](https://github.com/Seshat-Global-History-Databank/cliopatria) | Worldwide polities, 3400 BCE–2024 CE, 13,765 interval assertions and 508 change dates | CC BY 4.0 | Integrated globally and pinned |

## Open candidates

| Priority | Dataset | Best use | Integration constraint |
| --- | --- | --- | --- |
| P0 | [Newberry Atlas of Historical County Boundaries](https://publications.newberry.org/ahcb/downloads/index.html) | Detailed US states, territories, and counties from the colonial era through 2000 | Use generalized runtime geometry; retain exact-day source dates and statutory provenance |
| P1 | [OpenHistoricalMap](https://www.openhistoricalmap.org/export) | Audited local gaps, boundary relations, infrastructure, and uncertainty tags worldwide | Preserve element/version and per-feature license; coverage is uneven and includes imported source families |
| P1 | [Ancient World Mapping Center](https://github.com/AWMC/geodata) | Specialist ancient extents and administrative/provincial detail | ODbL packaging and Barrington-derived lineage must remain separate |
| P1 | [Historical Atlas of the Low Countries](https://datasets.iisg.amsterdam/dataset.xhtml?persistentId=hdl:10622/PGFYTM) | Very detailed 1500 CE Low Countries local units | CC BY-SA 4.0; currently one completed cross-section rather than a continuous chronology |
| P2 | [geoBoundaries gbOpen](https://www.geoboundaries.org/api.html) | Modern endpoint and administrative topology checks | Modern anchor only; never back-project current borders into earlier periods |
| P2 | [US State Department LSIB](https://data.geodata.state.gov/LSIB.gpkg) | Current international linework and topology QA | Modern endpoint only |

## Permission or policy decision required

These sources are publicly accessible but not automatically safe to redistribute in this repository:

| Dataset | Value | Blocker |
| --- | --- | --- |
| [CShapes 2.0](https://beta.icr.ethz.ch/data/cshapes/) | Exact-date world states and colonies, 1886–2019 | CC BY-NC-SA 4.0; obtain permission or explicitly commit to compatible noncommercial use |
| REGIS / REThM | European national and internal boundaries, 1870–2020 | Dataset appendix is CC BY-NC 4.0 |
| [Significant Administrative Units](https://andreasjuon.com/datasets/SAU/) | Near-global first-order units, 1945–2018 | CC BY-NC 4.0 and very large geometry |
| [HGIS de las Indias](https://www.hgis-indias.net/downloads/) | Spanish Americas administrative detail, 1701–1808 | Confirm archive-specific redistribution terms in writing |
| [SUNGEO SHGIS](https://www.sungeo.org/sungeo-historical-gis-boundaries) | Historical country and administrative boundaries | Official data license is not clearly stated |

## Verification-only sources

UN SALB, Harvard CHGIS, IPUMS/MPIDR Mosaic, and proprietary atlases can help reviewers check geometry, but their current terms do not permit ordinary third-party bundling. They must not be copied into `public/data` without new permission.

## Required ingestion fields

Every adapter should preserve dataset and source-family IDs, immutable revision/checksum, source feature ID, inclusive or exact validity dates, date precision, boundary precision, territorial definition, administrative level, license and source URLs, review status, and source lineage. Competing assertions remain independently selectable; visual transitions never create a new historical claim.

## Combined-view reconciliation

The combined atlas enforces one ordinary filled assertion per reviewed polity phase. Exact feature-name matches and a small time-scoped identity registry allow a detailed assertion to replace its broad counterpart. Because a replacement can cross the retained neighbours of the broad source, its display geometry is cut around those neighbours before it receives a fill. The tooltip identifies this derived overlap resolution. Up to four of the largest matched detail groups are promoted in one frame so dense modern packs and playback stay responsive. Unmatched, unsafe, or deferred assertions remain interactive source-colored outlines instead of translucent caps, so disagreement stays inspectable without producing a false stack of territories; Detailed polities continues to show the full source as fills.

Source-internal hierarchy is resolved separately from identity. A Cliopatria composite and its declared members are never filled simultaneously: the combined overview uses the composite, while Detailed polities exposes the components. The runtime clipping is display-only and never changes either bundled source record or claims independent corroboration. If clipping is unsafe, including at the antimeridian or for an invalid ring, the broad polygon stays filled and the detailed assertion falls back to an outline. The same fallback applies to an entire detailed patch when two replacement groups still intersect after neighbour clipping, avoiding an arbitrary winner.
