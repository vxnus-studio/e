# @vxnus/e-provider

Server-side SDK for building an E-compatible remote knowledge provider.
It validates the manifest and retrieval contract, and provides the ownership
verification behavior required by the Knowledge Hub.

## Usage

```ts
import { createKnowledgeProvider } from "@vxnus/e-provider";

export const provider = createKnowledgeProvider({
  manifest,
  verificationKey: process.env.E_PUBLISHER_API_KEY!,
  retrieve: async (request) => searchKnowledge(request.query),
});
```

Expose the handlers through your framework:

```ts
provider.handlers.manifest();
provider.handlers.retrieve(requestBody);
provider.handlers.verify(request.headers.authorization);
```

The SDK validates every incoming retrieval request and every outgoing response.
It rejects unsupported semantic or hybrid modes based on the manifest. The
verification key remains in the provider process and is never returned.

The package intentionally does not include HTTP framework adapters, database
access, Hub authentication, or publishing workflows.
