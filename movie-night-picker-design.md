# Movie Night Picker — Dreamforce Session Design

Demo covering: Batch Generation, Web Grounding, Structured Outputs (JSON/HTML),
Prompt Templates as Actions, Data Piping Between Actions.

## Premise
A single OTT catalog. A group of friends filters the catalog (Year/Genre/Runtime)
in an LWC, then triggers a real-time ranking pipeline across the filtered
shortlist (typically 4 movies) to decide what to watch tonight.

## Two-Pipeline Architecture

### Pipeline A — Overnight Batch Enrichment (Batch Generation feature)
- Trigger: nightly bulk feed of new catalog additions, or a list view of
  records where Plot_Summary__c is null.
- Runs `Plot_Vibe_Summarizer` prompt template in bulk across all unenriched titles.
- Non-grounded — relies on the model's own knowledge (fine for known titles).
- Writes back: Plot_Summary__c, Vibe_Tag__c.

**Plot_Vibe_Summarizer prompt:**
```
You are a movie-night assistant helping a friend group pick what to watch tonight.

Movie title: {{!Movie_Catalog__c.Title}}
Genre: {{!Movie_Catalog__c.Genre__c}}
Runtime: {{!Movie_Catalog__c.Runtime_Minutes__c}} minutes

1. Write a spoiler-free plot summary in exactly 2 sentences.
2. Describe the "vibe" in one short phrase (e.g. "cozy and low-effort",
   "great background watch", "loud group-hangout energy").
3. Note emotional tone in 2-3 words.

Keep total response under 80 words. No preamble.
```

### Pipeline B — Realtime Group Decision (LWC-triggered)
User filters catalog → sees shortlist instantly (plot/vibe already on record,
no AI latency) → clicks "Rank These For Tonight" → fires real-time pipeline,
once per movie, in parallel (4 movies = 4 independent template executions).

Piping only happens WITHIN one movie's execution chain, never across movies.

## Three-Template Structure (per movie, one master template called by LWC)

### 1. Review_Lookup_Template (called as an action)
- Output type: **JSON**
- Web Grounding action, domains: imdb.com, wikipedia.org (rottentomatoes.com
  failed — JS-rendered/anti-scrape; avoid). Streaming lookups: justwatch.com,
  themoviedb.org (not needed once single-catalog premise removes "which platform").
- IMPORTANT GOTCHA: well-known movies' ratings are memorized by the LLM already —
  grounding doesn't visibly prove itself unless you ask for genuinely time-sensitive
  facts (recent news, this-week buzz, award nomination) or use a recent/obscure
  title in the demo shortlist. Consider an explicit grounded-vs-ungrounded A/B
  on stage for one title as proof.
- Input: Title
- Output: `{"imdb_rating": 7.4, "critic_sentiment": "..."}`

### 2. Scoring_Synthesizer_Template (called as an action)
- Output type: Default (plain text)
- Inputs: Title, Genre, Runtime, PlotSummary (from catalog field, passed through),
  FilterContext (LWC filter string), ReviewData (**piped from Review_Lookup_Template's
  output — this is the load-bearing pipe**, since live review data can't come from
  anywhere else).
- Prompt asks for: score 1-10, 2-sentence reasoning referencing both filter fit
  and live review data, classification GO/SKIP/BACKUP. "Be decisive, do not hedge."

### 3. Movie_Card_Template (the master template, called by LWC via Apex)
- Output type: **HTML**
- Template inputs: Movie_Catalog__c record, FilterContext string
- Action A → Review_Lookup_Template (JSON out) → {{!ActionA.Output}}
- Action B → Scoring_Synthesizer_Template, passing ReviewData = {{!ActionA.Output}}
  → {{!ActionB.Output}} (second load-bearing pipe)
- Own generation step: builds final HTML card using {{!ActionB.Output}} +
  Title/Poster_URL__c merge fields. Poster thumbnail, colored score badge
  (green=GO/yellow=BACKUP/red=SKIP), reasoning text. Inline CSS only, <40 lines.

## Piping Rule of Thumb (for the talk track)
Ask: "Could this action's prompt have gotten this value from the record or
initial inputs, without needing another action to run first?"
- Plot summary, filter context → YES → NOT piping (merge field / template input)
- IMDb rating/sentiment, score/reasoning → NO, only exists after the prior
  action ran → genuine piping

Actions = Apex action / Flow action / another Prompt Template action ONLY.
There is no such thing as "inline steps within one template piping to each other" —
each hop requires a separate template invoked as an action.
A single prompt template has exactly ONE output type: Default, JSON, or HTML —
never both JSON and HTML from the same template.

## Object Model: Movie_Catalog__c

| Field | API Name | Type | Populated by |
|---|---|---|---|
| Title | Title (Name field) | Text | Seed data |
| Year | Year__c | Number | Seed data |
| Genre | Genre__c | Picklist | Seed data |
| Runtime Minutes | Runtime_Minutes__c | Number | Seed data |
| Poster URL | Poster_URL__c | Text/URL | Seed data (or TMDB API via Apex action) |
| Plot Summary | Plot_Summary__c | Long Text Area | Overnight batch |
| Vibe Tag | Vibe_Tag__c | Text(255) | Overnight batch |

Only 6-7 fields total. Pick_Score__c, Recommendation__c, One_Line_Reason__c,
HTML_Brief__c are deliberately NOT persisted on the object — they're
per-session, per-filter-context outputs (ephemeral), not intrinsic movie
properties. They live only in LWC component state, returned directly from
the Apex call, never written back. Persisting them would cause one group's
session to silently overwrite/corrupt another's.

Talk-track line: "Not everything an LLM generates belongs in a database field.
Batch-generated content is durable and worth persisting because it's a
property of the movie itself. Realtime-generated content is a property of
this specific ask, and belongs in application state, not the object model."

## Poster Image Gotcha
Web-grounding text search is unreliable for extracting image URLs (returns
page URLs, not direct assets, or hallucinated links). Better: store
Poster_URL__c directly in seed data, or use a real API call (TMDB
`/search/movie` → poster_path → `https://image.tmdb.org/t/p/w500` + path)
via an Apex/External Service action — a good candidate example for
"non-prompt actions in the piping chain" if you want a 4th action type
demoed live.

## UI Flow (LWC screens)
1. Filter panel: Year / Genre / Runtime, "Find Movies" button (plain SOQL
   query, no AI, instant).
2. Results grid: shows filtered shortlist immediately with plot/vibe blurb
   already visible (from batch) — no spinner needed for this part.
3. "Rank These For Tonight" button — fires the real-time pipeline, once per
   visible card, in parallel.
4. Per-card loading state — plot/vibe blurb stays visible, only score/badge
   area shows a spinner ("this part was already known, this part is being
   computed live").
5. Cards populate as each of the N real-time calls returns independently
   (they won't all land simultaneously) — sort/highlight top pick once all
   return (client-side JS sort, not a Prompt Builder feature).

Cap shortlist at 4 movies for demo — 4 real-time grounding+synthesis+structured
calls fire on click; keep wait time reasonable and visually staggered.

## Demo Timing (~5-6 min of a 20-min session)
- 30s: relatable setup (group chat can't decide what to watch)
- 60s: mention overnight batch ran (show list view / job history, don't run live)
- 60s: LWC filter → instant shortlist with plot/vibe
- 90s: click Rank → narrate the 3-template/2-pipe chain while spinners run
- 90s: cards populate, show JSON-esque score fields conceptually + HTML card
- 30s: punchline — map back to enterprise pattern (filter accounts → bulk
  score renewal risk → structured write-back → custom UI)

## Alternative domains considered (in case of pivot)
Constraint that killed several ideas: web grounding only proves value against
a PUBLIC, crawlable, frequently-updated website — many "live" data sources
(Salesforce/Dreamforce session capacity, internal inventory) simply aren't
public web content at all, so no prompt engineering fixes that.
- Stocks/portfolio watchlist — cleanest fit (price/news unmemorizable, public,
  crawlable), most enterprise-relatable.
- Fantasy sports lineup advisor — equally clean (injury reports/inactives
  public + daily + unmemorizable), most relatable for a general audience.
- Restaurant picker — decent, but live wait-time is often app-only, not
  crawlable.
- Flight/travel deals — risk of same JS-heavy/anti-scrape problem as
  Rotten Tomatoes.
- Dreamforce session picker — rejected, no public source for internal
  session capacity/room-change data.

Decision: proceeding with Movie Night, mitigating the memorization gotcha via
recent/obscure title choice and/or live grounded-vs-ungrounded A/B.
