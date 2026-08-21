# Domain Extensions

E Core provides no hardcoded presets. Domains like Teyvat or Schale are implemented as extensions.

## Principles

- **Ontology is Data:** E Core treats entity `kind`s (e.g., `character`, `student`, `service`) as raw strings. The ontology is governed by the ingestion pipeline of the domain dataset, not E Core.
- **Namespacing:** All entities must define a `namespace`. This allows a unified E query engine to serve queries across multiple domains (e.g., `e.query({ type: "resolve", alias: "Zhongli", namespace: "teyvat" })`).
- **Domain Tables:** If a domain requires highly specific tables (like Genshin's `banner_phases`), these are created and maintained entirely within the domain's own infrastructure or database schema layer. E Core does not validate them. Domain-specific APIs can sit alongside the E Core API to serve this specific data.
