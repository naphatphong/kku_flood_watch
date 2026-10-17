# Architecture and design decisions

How KKU Campus works and why it was designed this way. The overview, screenshots and setup are in the
[README](../README.md); every decision with its reasoning is in [PLAN.md](PLAN.md).

## 1. Rules first, data later

I didn't have historical flood data, so I couldn't train a model. Rather than fake one, I made two decisions:

1. **Phase 1 uses explainable rules.** A student should be able to see *why* a zone shows 72%.
2. **Every post saves a snapshot** (rain at that moment, ground elevation, tags, votes), so later there's
   enough labelled data to train a model. That includes "dry, passable" posts, because a model needs
   negative examples too.

I wrote every decision down in [PLAN.md](PLAN.md) (§0 overrides
the rest), and every tunable number lives in one file: [`lib/config.ts`](../lib/config.ts).

## 2. System architecture

```mermaid
flowchart LR
    subgraph Client["Browser (mobile-first)"]
        UI[Next.js pages<br/>MapLibre map]
    end
    subgraph Vercel["Next.js on Vercel"]
        API[API routes<br/>/api/reports · /api/route · /api/cron]
        DOM["lib/domain<br/>(pure rules, tested)"]
        DATA["lib/data<br/>(DB + external APIs)"]
        API --> DATA --> DOM
    end
    subgraph Supabase
        PG[(Postgres + PostGIS)]
        RT[pgRouting]
        RLS[Row Level Security]
        CRON[pg_cron + pg_net]
        REAL[Realtime]
        AUTH[Auth: Google / LINE]
    end
    EXT1[Open-Meteo<br/>rain + elevation]
    EXT2[TomTom<br/>traffic]
    EXT3[Claude API<br/>timetable OCR]

    UI <-->|fetch| API
    REAL -.->|changes| UI
    UI --> AUTH
    DATA --> PG & RT
    CRON -->|every 15 min| API
    DATA --> EXT1 & EXT2 & EXT3
    RLS -.-|guards| PG
```

**Layering rule:** `lib/domain/` only takes plain data and returns plain data. It never touches the
database. Because of that, the flood formula, spam check, route picking and turn list are all
unit-testable in under a second, and the import scripts reuse the same code.

## 3. Life of a flood report

```mermaid
sequenceDiagram
    actor U as Student
    participant API as POST /api/reports
    participant D as lib/domain
    participant DB as Supabase
    U->>API: tags + pin/road + photo + GPS
    API->>DB: rate limit (cooldown, posts/day)
    API->>DB: road posts: segments must join into one line, ≤ 500 m
    API->>API: poster within 2 km of the spot?
    par snapshot for training
        API->>DB: latest rain (r1, r3, r24, r72)
        API->>API: ground elevation (Open-Meteo DEM)
        API->>DB: poster history (approved / rejected)
    end
    API->>D: spamCheck() → score + reasons
    alt score < 50
        D-->>API: approved
    else 50–79
        D-->>API: pending (admin queue)
    else ≥ 80
        D-->>API: rejected
    end
    API->>API: photo: rotate, resize, strip EXIF/GPS
    API->>DB: insert report
    API->>DB: recompute clusters + road colours
    DB-->>U: Realtime: map updates for everyone
```

## 4. The flood-risk formula

Instead of fixed zones, **posts cluster themselves** (DBSCAN, posts within 300 m chain together). Each
cluster then gets a score:

```
rain   = 0.5·min(1, R3/50) + 0.3·min(1, R24/90) + 0.2·min(1, rainyDays/5)
low    = 0.6 | 1.0 | 1.3    ← elevation tercile of the posts vs. the whole area (Copernicus DEM)
base   = min(100, rain · low · 100)                     ← what the weather alone says

weight = 0.5^(hours/2) · votes                          ← half-life 2 h; "still flooded" ×1.2, "receded" ×0.6
report = Σ(wᵢ·scoreᵢ) / Σwᵢ                             ← what people on the ground say

c      = min(0.8, 0.16 · Σw)                            ← confidence grows with evidence
final  = (1 − c) · base + c · report
```

Why this shape: with **no posts**, the map still warns from rain + terrain. As **more people post**,
the score trusts them more, but never 100% (c ≤ 0.8), so one troll can't paint the map red. Before anyone
posts, "watch circles" appear on low ground pockets when it rains.

## 5. Routing that avoids floods

The graph search runs **inside Postgres** (pgRouting), so there's no separate routing server:

```
cost(segment, vehicle) = length / speed
                         × 3        if the road is "hard to pass" for this vehicle
                         × 1.5      if inside a flood circle with final ≥ 60%
                         removed    if "blocked" for this vehicle (or "hard", if the user chooses)
one-way streets: no driving backwards; walking ignores them
```

Then `pickRoutes()` decides which cards to show:

```mermaid
flowchart TB
    K[pgr_KSP: k safest paths] --> S[Safest = path 1]
    K --> B{Another safe path<br/>≥ 5% faster?}
    B -->|yes| BAL[Balanced]
    F[Traffic-aware path] --> T{≥ 5% faster than<br/>every card so far?}
    T -->|yes| TR[Avoid traffic]
    P[Plain shortest path] --> SH{≥ 5% faster?}
    SH -->|yes| SHORT[Shortest card]
    SH -->|no| LBL[Just label the matching card<br/>'shortest']
    S & BAL & TR & SHORT --> LIVE[Replace times with TomTom live times]
    LIVE --> KEEP["keepFaster(): drop any card that<br/>live traffic shows isn't faster"]
```

Each card is there because it's genuinely a different trade-off. If two routes are really the same, the
user only sees one card.

## 6. Security model

- **Guests** can view the map and navigate. Posting, voting and flagging need a login (Google / LINE).
- **RLS on every table:** anyone can read approved reports. Owners see their own pending ones, and admins
  see everything. Users can change only their own `display_name`, enforced with a column-level `GRANT`.
- Report creation, moderation and the cron refresh run on the server with the service role, so clients
  get almost no write policies.
- `supabase/tests/policies.test.sql` switches roles (`set role anon` / `authenticated` + JWT claims) and
  asserts what each one can see and do.
