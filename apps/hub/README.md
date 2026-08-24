# Knowledge Hub

The hosted E Knowledge Hub is the public registry and landing product for
knowledge packs. It is an application, not an npm package.

The Hub provides pack discovery, publisher pages, verification state,
pack/version metadata, and archive or remote-provider distribution URLs.

Siduri consumes the Hub and performs installation. The Hub does not own
companion state, installation state, permissions, or `KnowledgeOrgan`
lifecycle.

The framework, database, authentication, and deployment are intentionally
undecided until the registry contract and publishing workflow are finalized.
