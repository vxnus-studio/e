# RFC: É (𒂍) — The Companion Asset Protocol & Marketplace Architecture

> **Status:** Draft / RFC  
> **Origin:** Sumerian *É* (𒂍), meaning *"House / Temple / Dwelling"*.  
> **Role:** The asset standard, package specification, distribution protocol, and marketplace for Siduri companion artifacts.

---

## 1. Vision & Conceptual Lore

In Sumerian tradition, **Siduri** represents wisdom, hospitality, and life. **É** (𒂍) is the **House**, the **Sanctuary**, and the **Vessel** in which the spirit dwells.

- **Siduri (`@siduri-x/*`)** is the **Consciousness**: The runtime, memory, action gating, and sensory processing engine.
- **É (`@vxnus/e*`)** is the **House**: The portable, installable furnishings, body, voice, behavior, and knowledge that give Siduri form and substance.

```
       ┌────────────────────────────────────────────────────────┐
       │                       SIDURI                           │
       │     (Consciousness, Memory, Reasoning, Truth Gate)      │
       └───────────────────────────▲────────────────────────────┘
                                   │ Inhabits / Equips
       ┌───────────────────────────┴────────────────────────────┐
       │                        É (𒂍)                           │
       │                   The House / Vessel                   │
       ├──────────────┬──────────────┬─────────────┬────────────┤
       │     BODY     │    VOICE     │  BEHAVIOR   │ KNOWLEDGE  │
       │  (Live2D/3D) │  (RVC/TTS)   │  (Direct.)  │ (Docs/Idx) │
       └──────────────┴──────────────┴─────────────┴────────────┘
```

---

## 2. The 4 É Pack Domains

É generalizes pack distribution across 4 core asset kinds plus composite persona bundles:

```mermaid
graph TD
    Hub[É Marketplace / Hub] -->|Distributes| EPack[É Pack Bundle .epack / .tar.gz]
    
    EPack --> K[kind: knowledge]
    EPack --> B[kind: body]
    EPack --> V[kind: voice]
    EPack --> P[kind: behavior]
    EPack --> U[kind: bundle]

    K -.->|Bound to| OK[@siduri-x/knowledge]
    B -.->|Bound to| OB[@siduri-x/body]
    V -.->|Bound to| OV[@siduri-x/voice]
    P -.->|Bound to| OP[@siduri-x/behavior]
    U -.->|Composes| EPack
```

### A. `kind: "knowledge"` (The Archives)
- **Target Organ:** `@siduri-x/knowledge`
- **Payload:** Documents, source chunking, provenance revision trees, vector indices (SQLite / LanceDB / Parquet), citations.
- **Runtime:** Grounded, provenance-tracked context injection.

### B. `kind: "body"` (The Vessel)
- **Target Organ:** `@siduri-x/body`
- **Payload:** Live2D Cubism (`.model3.json`, textures, physics, motions, expression maps) or 3D/VRM models.
- **Runtime:** Loaded into client renderers (Electron, Web, OBS overlays) with motion and expression triggers wired to Siduri's state machine.

### C. `kind: "voice"` (The Resonance)
- **Target Organ:** `@siduri-x/voice`
- **Payload:** RVC (Retrieval-based Voice Conversion) `.pth` weights + `.index` feature files, VOICEVOX speaker configurations, or Piper/XTTS checkpoints.
- **Runtime:** Synthesizes and styles companion vocal output.

### D. `kind: "behavior"` (The Ethos)
- **Target Organ:** `@siduri-x/behavior`
- **Payload:** Directives, stance rules, personality spectrum vectors (formality, warmth, sarcasm), guardrail filters, and dialogue style shots.
- **Runtime:** Compiles into prompt steering and dynamic behavior state machines.

### E. `kind: "bundle"` (The Sanctuary)
- **Composite Pack:** A manifest referencing a curated combination of Body + Voice + Behavior + Knowledge packs into an all-in-one installable companion persona.

---

## 3. Polymorphic Manifest Specification (`e.manifest.json`)

```typescript
export type EPackKind = 'knowledge' | 'body' | 'voice' | 'behavior' | 'bundle';

export interface BaseEPackManifest {
  specVersion: '1.0.0';
  id: string;               // e.g. "vxnus/elena-live2d" or "creator/cyber-lore"
  name: string;
  version: string;          // SemVer e.g. "1.2.0"
  description?: string;
  author: {
    name: string;
    url?: string;
    walletOrAccountId?: string;
  };
  license: string;          // e.g. "Apache-2.0", "CC-BY-NC-4.0", "commercial-siduri"
  kind: EPackKind;
  tags?: string[];
  signature?: string;       // Cryptographic author signature
  checksum: string;        // SHA-256 integrity hash of tarball payload
  sizeBytes: number;
}

// 1. Knowledge Pack
export interface EKnowledgePackManifest extends BaseEPackManifest {
  kind: 'knowledge';
  capabilities: {
    lexicalSearch?: boolean;
    vectorSearch?: boolean;
    graphRetrieval?: boolean;
  };
  sourcesCount: number;
  documentsCount: number;
}

// 2. Body Pack
export interface EBodyPackManifest extends BaseEPackManifest {
  kind: 'body';
  format: 'live2d-v3' | 'vrm-v1' | 'custom-2d';
  entrypoint: string;                      // e.g., "model.model3.json"
  previewImage?: string;
  expressions: Record<string, string>;     // e.g. { "blush": "exp/blush.exp3.json" }
  motions: Record<string, string[]>;       // e.g. { "idle": ["motions/idle.motion3.json"] }
}

// 3. Voice Pack
export interface EVoicePackManifest extends BaseEPackManifest {
  kind: 'voice';
  engine: 'rvc-v2' | 'voicevox' | 'piper' | 'custom';
  weightsFile: string;                     // e.g., "weights/voice.pth"
  indexFile?: string;                      // e.g., "weights/voice.index"
  defaultPitchShift?: number;
  sampleAudioUrl?: string;
}

// 4. Behavior Pack
export interface EBehaviorPackManifest extends BaseEPackManifest {
  kind: 'behavior';
  directives: string[];
  personalityTraits: Record<string, number>; // 0.0 to 1.0
  guardrails?: string[];
  styleExamples?: Array<{ user: string; assistant: string }>;
}

// 5. Persona Bundle
export interface EPersonaBundleManifest extends BaseEPackManifest {
  kind: 'bundle';
  components: {
    body?: string;                         // Pack ID + SemVer range
    voice?: string;
    behavior?: string;
    knowledge?: string[];
  };
}
```

---

## 4. Storage & Marketplace Infrastructure

```
                               ┌────────────────────────┐
                               │   Creator / Publisher  │
                               └───────────┬────────────┘
                                           │ Upload Pack (.epack)
                                           ▼
                               ┌────────────────────────┐
                               │   É Registry / Hub     │
                               │   (apps/web + API)     │
                               └─────┬────────────┬─────┘
                                     │            │
          Metadata, Pricing, Licenses│            │ Artifact Upload (S3 Protocol)
                                     ▼            ▼
                   ┌───────────────────┐        ┌───────────────────┐
                   │    Database       │        │   Cloudflare R2   │
                   │ (PostgreSQL/Meta) │        │ (Storage Bucket)  │
                   └───────────────────┘        └─────────┬─────────┘
                                                          │
                                     Direct Presigned URL │ Zero Egress CDN
                                                          ▼
                               ┌────────────────────────┐
                               │  Buyer / Siduri CLI    │
                               │  (`siduri pack add`)   │
                               └────────────────────────┘
```

### Storage Architecture (Cloudflare R2)
- **Zero Egress Fees**: Binary heavy assets (Live2D at 20-50MB, RVC at 50-150MB) are served to users without egress cost penalties.
- **Presigned URLs**: Users receive time-limited, cryptographically signed R2 download links upon authorization / payment.
- **Content Addressable Storage (CAS)**: Files indexed by SHA-256 checksum to ensure tamper-proof, deduplicated storage.

### Marketplace Monetization Models (To Be Refined)
1. **Platform Revenue Cut**: Standard 10%–20% fee on creator sales.
2. **Storage Tiering**: Free quota for standard creators, nominal fee/subscription for multi-gigabyte asset portfolios.
3. **One-Time Purchase & Subscriptions**: One-time asset licensing or ongoing knowledge/behavior feed subscriptions.

---

## 5. Siduri CLI Integration Flow

```bash
# Search the É Marketplace
siduri pack search "cyberpunk live2d"

# Install individual packs directly into respective organ directories
siduri pack add vxnus/elena-live2d      # Installs to .siduri/packs/body/
siduri pack add vxnus/elena-rvc          # Installs to .siduri/packs/voice/
siduri pack add vxnus/tsundere-behavior  # Installs to .siduri/packs/behavior/
siduri pack add vxnus/solana-dev-guide   # Installs to .siduri/packs/knowledge/

# Or install a complete Persona Sanctuary Bundle
siduri pack add vxnus/elena-companion-bundle
```

---

## 6. Implementation Roadmap

- [ ] **Phase 1: Manifest & Spec Refactor** (`packages/protocol`)
  - Introduce `BaseEPackManifest` and polymorphic manifest validation for `knowledge`, `body`, `voice`, `behavior`, and `bundle`.
- [ ] **Phase 2: Pack Packaging Tooling**
  - Implement CLI utilities for creating, validating, and extracting `.epack` archive bundles with checksum verification.
- [ ] **Phase 3: Organ Ingestion Adapters** (`siduri-x`)
  - Update `@siduri-x/body` and `@siduri-x/voice` to load local `.epack` unpacked assets.
- [ ] **Phase 4: É Hub & Marketplace** (`apps/web`)
  - Implement R2 storage pipeline, user authentication, asset listings, category browsing, and presigned delivery.
