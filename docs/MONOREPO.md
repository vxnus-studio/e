# E Monorepo Architecture

E is the contract layer for a hosted Knowledge Hub/Registry and its clients.
The monorepo keeps shared protocol types close to the implementations that
consume them without coupling the protocol to hosting infrastructure.

| Package | Responsibility | Must not own |
| --- | --- | --- |
| `@vxnus/e` (`packages/protocol`) | Pack manifests, content, revisions, capabilities, retrieval | HTTP, database, auth, Siduri lifecycle |
| `@vxnus/e-registry` | Registry entries, discovery, distribution metadata, verification state | Web framework, persistence, credentials |
| `@vxnus/e-client` | Transport-neutral registry and provider client wrappers | Retry policy, auth, local storage, UI |

The future Hub application should provide the concrete API, persistence,
publisher workflows, and deployment. A client should be usable by Siduri,
CLI tools, and other consumers without importing the Hub application.

## Dependency direction

```text
@vxnus/e
   ↑
@vxnus/e-registry
   ↑
@vxnus/e-client
```

Applications may depend on any package. Packages must not depend on an
application, a database driver, or a specific transport.

## Hosting boundary

The registry contract describes what can be discovered. It does not decide
where records are stored or how endpoints are deployed. The Hub application
will eventually implement:

- publisher registration and verification;
- pack/version indexing;
- archive and provider distribution URLs;
- search, pagination, and health policy;
- authentication, rate limits, moderation, and audit logs.

Those concerns remain replaceable and are intentionally absent from this
initial monorepo layer.
