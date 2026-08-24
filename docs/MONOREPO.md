# E Monorepo Architecture

E is the contract layer for a hosted Knowledge Hub/Registry. The monorepo
keeps shared protocol types close to the hosted Hub without coupling the
protocol to hosting infrastructure.

| Package | Responsibility | Must not own |
| --- | --- | --- |
| `@vxnus/e` (`packages/protocol`) | Pack manifests, content, revisions, capabilities, retrieval | HTTP, database, auth, Siduri lifecycle |
| `@vxnus/e-registry` | Registry entries, discovery, distribution metadata, verification state | Web framework, persistence, credentials |
| `@vxnus/e-pack` | Portable filesystem pack loading, validation, hashing, local retrieval | Hub hosting, Siduri lifecycle, remote transport |
| `apps/hub` | Hosted npm-like Knowledge Hub: landing page, registry API, pack distribution | Siduri runtime, companion memory |

The Hub application provides the concrete API, persistence, publisher
workflows, landing page, and deployment. Siduri and CLI tools call the hosted
Hub directly and do not import the Hub application.

## Dependency direction

```text
@vxnus/e
   ↑
@vxnus/e-registry
   ↑
apps/hub
```

The Hub application depends on the protocol and registry packages. Packages
must not depend on the Hub, a database driver, or a specific transport.

## Hosting boundary

The registry contract describes what can be discovered. It does not decide
where records are stored or how endpoints are deployed. The Hub application
will eventually implement:

- publisher registration and verification;
- pack/version indexing;
- archive and provider distribution URLs;
- search, pagination, and health policy;
- authentication, rate limits, moderation, and audit logs.

Those concerns remain replaceable and are intentionally isolated in the Hub
application rather than added to the protocol packages.

## Installation flow

Siduri is the installer and runtime consumer:

```text
publisher → Hub registry → Siduri discovers pack
                         → Siduri downloads/connects to pack
                         → Siduri installs and manages KnowledgeOrgan
```

The Hub never owns companion installation state or memory. It advertises and
serves knowledge; Siduri decides what to install, where it runs, and how it is
scoped to a companion.
