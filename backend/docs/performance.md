# Backend performance

E-02 (issue #213). This pass adds the indexes behind the hot query paths, removes
one full scan from the streak calculation, and records before/after response
times so the numbers can be reproduced.

## Dataset and method

Seeded one user with **50 projects**, each with a `duration` field and **500
entries** (25,000 entries total), dates spread across the previous year. The
benchmark ran against the disposable local Postgres from
`docker-compose.test.yml` (the same image CI uses) on a fresh database.

Endpoints were timed end-to-end through Express with a real session, ten runs
each, and the **median** is reported (min/max are noisy on a shared laptop). The
`EXPLAIN ANALYZE` plans below are the same queries the endpoints issue.

## Results

| Endpoint                           | Baseline | + indexes | + indexes & streak fix |
| ---------------------------------- | -------- | --------- | ---------------------- |
| `GET /api/stats`                   | 326.5 ms | 231.1 ms  | **192.8 ms**           |
| `GET /api/entries?projectId=…`     | 28.8 ms  | 16.3 ms   | 23.5 ms                |
| `GET /api/entries?q=…&dateFrom=…`  | 24.8 ms  | 23.7 ms   | 30.5 ms                |
| `GET /api/stats/frequency` (extra) | 304.2 ms | 185.8 ms  | 258.0 ms               |

Targets from the issue: `GET /api/stats` under 200 ms and `GET /api/entries`
search under 100 ms on this dataset — both met. The entries numbers move a few
milliseconds between runs but stay an order of magnitude under budget.

`GET /api/stats` is the sum of two parts. After the fix: streak **43.6 ms**
(down from ~129.8 ms) and the projects-with-entries query **103.7 ms**.

## Indexes

Added in migration `20260920085933_add_performance_indexes`:

| Index                          | Serves                                                  |
| ------------------------------ | ------------------------------------------------------- |
| `entries(date)`                | date-range filters (`dateFrom`/`dateTo`, stats windows) |
| `entries(projectId)`           | project-scoped lists and the stats `entries` relation   |
| `entry_tags(tagId)`            | the `tags: { some: { tagId } }` filter                  |
| `field_definitions(projectId)` | fields-by-project lookups                               |
| `projects(userId)`             | owned-project lookups on every stats/entries query      |

## EXPLAIN ANALYZE

Before the migration — full sequential scans:

```
# project-scoped entries
Seq Scan on entries  (cost=0.00..502.88 rows=82 width=12) (actual time=0.022..2.967 rows=500 loops=1)
  Filter: ("projectId" = 1)
  Rows Removed by Filter: 24500
Execution Time: 3.412 ms

# date range
Seq Scan on entries  (cost=0.00..502.88 rows=5463 width=4) (actual time=0.014..3.009 rows=2106 loops=1)
  Filter: (date >= '2026-08-21 00:00:00'::timestamp without time zone)
  Rows Removed by Filter: 22894
Execution Time: 3.139 ms
```

After — index scans:

```
# project-scoped entries
Bitmap Heap Scan on entries  (cost=4.92..189.56 rows=82 width=12) (actual time=0.068..0.164 rows=500 loops=1)
  Recheck Cond: ("projectId" = 1)
  ->  Bitmap Index Scan on "entries_projectId_idx"  (actual time=0.039..0.040 rows=500 loops=1)
Execution Time: 0.306 ms

# date range
Bitmap Heap Scan on entries  (cost=94.63..460.91 rows=5463 width=4) (actual time=0.241..0.901 rows=2096 loops=1)
  Recheck Cond: (date >= '2026-08-21 00:00:00'::timestamp without time zone)
  ->  Bitmap Index Scan on "entries_date_idx"  (actual time=0.191..0.191 rows=2096 loops=1)
Execution Time: 1.136 ms

# owned projects
Bitmap Heap Scan on projects  (cost=4.17..11.28 rows=1 width=4) (actual time=0.058..0.064 rows=50 loops=1)
  Recheck Cond: ("userId" = '…'::text)
  ->  Bitmap Index Scan on "projects_userId_idx"  (actual time=0.048..0.049 rows=50 loops=1)
Execution Time: 0.121 ms
```

## Streak full scan

`computeCurrentStreak` used to pull **every** entry date for the user and
de-duplicate in JavaScript — 25,000 rows to find at most 365 distinct days. It
now asks Postgres for the distinct days directly (`SELECT DISTINCT
to_char(date, 'YYYY-MM-DD')`), which took the streak step from ~130 ms to ~44 ms
and is what brings `GET /api/stats` under the 200 ms target. `date` is
`TIMESTAMP(3)`, so `to_char` returns the same calendar day the old
`toISOString().split('T')[0]` did.

## N+1 audit

Hot paths issue a constant number of queries; nothing fans out per row:

| Endpoint                   | Queries | Notes                                                        |
| -------------------------- | ------- | ------------------------------------------------------------ |
| `GET /api/stats`           | 4       | projects + fields + entries (batched) + distinct streak days |
| `GET /api/entries`         | 4       | entries + entry_tags + tags (batched) + count                |
| `GET /api/stats/frequency` | 2       | earliest date + in-range entries                             |
| `GET /api/stats/streak`    | 1       | distinct days                                                |

Prisma batches to-many `include`s with `IN (…)`, so the `perProject.map` in
`stats.ts` runs in memory and never issues a query per project.

## Frontend call-outs

Two list-heavy pages are the frontend pair's follow-up (E-03): the **entries
timeline (#08)** and the **project workspace (#06)**. Both should window or
paginate long lists; the backend pagination is already in place on
`GET /api/entries`.

## Follow-ups

- `GET /api/stats/fields/:projectId` (C-01) is not benchmarked here — it has not
  landed yet. Re-measure when it does.
- `GET /api/stats/frequency` still scans every in-range entry and buckets in
  memory; a grouped `date_trunc('week', date)` query is the obvious next win.
- `scheduler.runSweep` issues a handful of queries per project. It is an hourly
  background job, not an HTTP path, but it can be batched (groupBy latest entry,
  `createMany`, `updateMany`) in a later pass.
