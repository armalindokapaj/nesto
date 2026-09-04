/**
 * Metrics — PRD §25.3.
 *
 * An in-process registry with a Prometheus text exposition. Deliberately small:
 * the OTLP exporter is off by default locally (deviation D-5), and the metric
 * *names* are the part that has to be right now, because dashboards and alerts
 * are defined against them and renaming one later breaks history.
 */

type Labels = Record<string, string | number | undefined>;

type Counter = { kind: "counter"; help: string; values: Map<string, number> };
type Histogram = { kind: "histogram"; help: string; buckets: number[]; values: Map<string, { counts: number[]; sum: number; count: number }> };

const registry = new Map<string, Counter | Histogram>();

function labelKey(labels: Labels): string {
  const entries = Object.entries(labels)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : 1));
  return entries.map(([k, v]) => `${k}="${String(v).replace(/"/g, "")}"`).join(",");
}

export function counter(name: string, help: string): (labels?: Labels, by?: number) => void {
  if (!registry.has(name)) registry.set(name, { kind: "counter", help, values: new Map() });
  const metric = registry.get(name) as Counter;
  return (labels = {}, by = 1) => {
    const key = labelKey(labels);
    metric.values.set(key, (metric.values.get(key) ?? 0) + by);
  };
}

const DEFAULT_BUCKETS = [5, 10, 25, 50, 100, 200, 400, 800, 1600, 3200];

export function histogram(name: string, help: string, buckets = DEFAULT_BUCKETS): (ms: number, labels?: Labels) => void {
  if (!registry.has(name)) registry.set(name, { kind: "histogram", help, buckets, values: new Map() });
  const metric = registry.get(name) as Histogram;
  return (ms, labels = {}) => {
    const key = labelKey(labels);
    let entry = metric.values.get(key);
    if (!entry) {
      entry = { counts: new Array(metric.buckets.length + 1).fill(0), sum: 0, count: 0 };
      metric.values.set(key, entry);
    }
    let placed = false;
    for (let i = 0; i < metric.buckets.length; i++) {
      if (ms <= (metric.buckets[i] as number)) {
        entry.counts[i] = (entry.counts[i] as number) + 1;
        placed = true;
        break;
      }
    }
    if (!placed) entry.counts[metric.buckets.length] = (entry.counts[metric.buckets.length] as number) + 1;
    entry.sum += ms;
    entry.count += 1;
  };
}

export function renderPrometheus(): string {
  const lines: string[] = [];
  for (const [name, metric] of registry) {
    lines.push(`# HELP ${name} ${metric.help}`);
    lines.push(`# TYPE ${name} ${metric.kind}`);
    if (metric.kind === "counter") {
      for (const [labels, value] of metric.values) {
        lines.push(labels ? `${name}{${labels}} ${value}` : `${name} ${value}`);
      }
    } else {
      for (const [labels, entry] of metric.values) {
        let cumulative = 0;
        metric.buckets.forEach((b, i) => {
          cumulative += entry.counts[i] as number;
          const l = labels ? `${labels},le="${b}"` : `le="${b}"`;
          lines.push(`${name}_bucket{${l}} ${cumulative}`);
        });
        cumulative += entry.counts[metric.buckets.length] as number;
        const lInf = labels ? `${labels},le="+Inf"` : `le="+Inf"`;
        lines.push(`${name}_bucket{${lInf}} ${cumulative}`);
        lines.push(labels ? `${name}_sum{${labels}} ${entry.sum}` : `${name}_sum ${entry.sum}`);
        lines.push(labels ? `${name}_count{${labels}} ${entry.count}` : `${name}_count ${entry.count}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}

// The metric names of §25.3. Declared centrally so an alert can be written
// against a name that will not quietly change.
export const httpRequests = counter("nesto_http_requests_total", "HTTP requests by route, method, status and audience.");
export const httpDuration = histogram("nesto_http_duration_ms", "HTTP server time in milliseconds.");
export const policyDenies = counter("nesto_policy_denies_total", "Authorization denials by permission key and audience.");
export const crossScopeAttempts = counter("nesto_cross_scope_attempts_total", "Writes or reads that named a scope the caller does not hold. Should be zero.");
export const dbQueryDuration = histogram("nesto_db_query_ms", "Database query latency.");
export const outboxLag = histogram("nesto_outbox_lag_ms", "Age of an outbox row when the relay published it.");
export const outboxPublished = counter("nesto_outbox_published_total", "Events published by the relay.");
export const outboxDeadLettered = counter("nesto_outbox_dead_lettered_total", "Events that exhausted their retries.");
export const workflowUnfinalized = counter("nesto_workflow_outcome_unfinalized_total", "Workflows that reached an outcome the source never confirmed. See ADR-0013.");
export const searchIndexLag = histogram("nesto_search_index_lag_ms", "Delay between a source change and its index update.");
export const fileScanFailures = counter("nesto_file_scan_failures_total", "Uploads rejected or failed during inspection.");
export const notificationDeliveries = counter("nesto_notification_deliveries_total", "Notification delivery attempts by channel and result.");

export function resetMetricsForTest(): void {
  registry.clear();
}
