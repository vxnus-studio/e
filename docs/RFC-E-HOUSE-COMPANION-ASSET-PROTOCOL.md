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

---

## 6. Publisher Metrics & Social Signals Telemetry

To empower pack authors with actionable feedback and provide transparent community signals for discovery and ranking, É introduces a multi-tier telemetry and engagement specification.

```
                  ┌────────────────────────────────────────────────────────┐
                  │                 Consumer / Siduri Client               │
                  │ (Optional Opt-In Telemetry & Authenticated Star/Review)│
                  └──────────┬──────────────────────────┬──────────────────┘
                             │                          │
           Install Event /   │                          │ Star / Rating /
       Opt-in Retrieval Ping │                          │ Public Comment
                             ▼                          ▼
                  ┌────────────────────────────────────────────────────────┐
                  │                  É Hub Control Plane                   │
                  │                   (Supabase / API)                     │
                  ├─────────────────────────────┬──────────────────────────┤
                  │     Usage Telemetry Aggs    │ Social & Review System   │
                  │  - Total Installs           │ - Stars / Likes          │
                  │  - Retrieval Volume/Latency │ - Ratings (1-5★)         │
                  │  - Active Installations     │ - Authenticated Reviews  │
                  └─────────────────────────────┴──────────────────────────┘
                                                │
                                                ▼
                               ┌─────────────────────────────────┐
                               │   Publisher Control Dashboard   │
                               │  (`/publish` Analytics Overview)│
                               └─────────────────────────────────┘
```

### 6.1 Core Metrics

1. **Total Installed Count (`total_installs`)**
   - **Definition:** The cumulative count of package installations initiated and successfully verified via CLI (`siduri pack add`) or desktop/web application clients.
   - **Granularity:** Global lifetime installs, per-version install breakdown, and 30-day trailing installation velocity.
   - **Deduplication:** Rate-limited and anonymized client instance tokens to prevent artificial volume manipulation.

2. **Total Retrieval Count (`total_retrievals`)**
   - **Definition:** Telemetry tracking knowledge retrieval queries served to Siduri agents at inference time.
   - **Opt-In & Intentionality:**
     - **Default Privacy:** Local-only retrieval telemetry is disabled by default or strictly aggregated on-device.
     - **Explicit Consent:** Companion owners who install a pack can opt into anonymous retrieval telemetry sharing (`siduri config set telemetry.retrieval true` or via UI toggle).
     - **Remote Provider Metrics:** For remote knowledge providers (HTTP endpoints), server-side request counts, chunk hit rates, and latency profiles are tracked directly by the provider or gateway proxy.
   - **Value to Publisher:** Highlights which knowledge domains, chunk subsets, or query vectors are frequently cited in real-world agent dialogues.

3. **Stars & Likes (`stars_count`, `likes_count`)**
   - **Definition:** Fast-engagement sentiment indicator (similar to GitHub Stars) allowing registered É Hub users to bookmark and endorse packs.
   - **Anti-Sybil Controls:** Restricted to verified Supabase user accounts with verified email addresses.

4. **Public Commenters, Reviews & Rating (`ratings_count`, `average_rating`)**
   - **Five-Star Rating Scale:** Aggregate score (1.0 to 5.0) computed with a Bayesian average to avoid skew on early releases.
   - **Verified User Comments:** Public discussion threads and formatted reviews.
   - **Verified Installer Badge:** Reviews posted by accounts with a verified installation history receive a `"Verified Inhabitant / Installer"` badge.
   - **Publisher Reply:** Authors can post pinned official replies to clarify compatibility or acknowledge bug reports.

5. **Extended Operational & Health Signals (Proposed)**
   - **Active Installations / Weekly Active Vessels (WAV):** Optional heartbeat reporting packs currently mounted in active Siduri runtime profiles.
   - **Citation Quality & Helpful Rate:** Agent feedback loop where users can flag if a retrieved context citation hallucinated or successfully answered their prompt.
   - **Bundle Inclusion Count:** Tracks how many composite Persona Sanctuary bundles reference this specific pack as an upstream dependency.
   - **Retention / Uninstalls:** Count of pack removals (`siduri pack remove`) to measure long-term satisfaction.

### 6.2 Schema & Control Plane Integration

Control-plane tables added to Supabase:

```sql
-- Aggregated metric cache for fast discovery queries
create table if not exists public.publisher_pack_metrics (
  package_id text primary key,
  total_installs bigint not null default 0,
  active_installs bigint not null default 0,
  total_retrievals bigint not null default 0,
  stars_count integer not null default 0,
  ratings_count integer not null default 0,
  rating_average numeric(3, 2) not null default 0.00,
  updated_at timestamptz not null default now()
);

-- User social endorsements (stars / likes)
create table if not exists public.publisher_pack_stars (
  package_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (package_id, user_id)
);

-- Public reviews, ratings, and comments
create table if not exists public.publisher_pack_reviews (
  id uuid primary key default gen_random_uuid(),
  package_id text not null,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating smallint check (rating between 1 and 5),
  title text,
  comment text,
  is_verified_installer boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (package_id, user_id)
);
```

---

## 7. Implementation Roadmap

- [ ] **Phase 1: Manifest & Spec Refactor** (`packages/protocol`)
  - Introduce `BaseEPackManifest` and polymorphic manifest validation for `knowledge`, `body`, `voice`, `behavior`, and `bundle`.
- [ ] **Phase 2: Pack Packaging Tooling**
  - Implement CLI utilities for creating, validating, and extracting `.epack` archive bundles with checksum verification.
- [ ] **Phase 3: Organ Ingestion Adapters** (`siduri-x`)
  - Update `@siduri-x/body` and `@siduri-x/voice` to load local `.epack` unpacked assets.
- [ ] **Phase 4: É Hub & Marketplace** (`apps/web`)
  - Implement R2 storage pipeline, user authentication, asset listings, category browsing, and presigned delivery.
- [ ] **Phase 5: Publisher Analytics & Social Graph**
  - Implement Supabase metric tables (`publisher_pack_metrics`, `publisher_pack_stars`, `publisher_pack_reviews`).
  - Add client opt-in retrieval/install telemetry hooks in Siduri CLI.
  - Surface visual graphs and engagement metrics in the `/publish` dashboard.

