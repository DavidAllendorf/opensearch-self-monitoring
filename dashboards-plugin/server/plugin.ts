import { schema } from '@osd/config-schema';
import type { CoreSetup, Plugin } from '../../../src/core/server';
import type { Metric, MetricKind, Overview, SeriesPoint } from '../common/types';
import { historyQuery } from './queries';
import { HISTORY_FIELDS } from '../common/types';

const INDEX = '.stack-monitoring-*';
type HistoryBucket = { key: number } & Record<typeof HISTORY_FIELDS[number], { value: number | null }>;
interface SearchResult {
  hits: { hits: Array<{ _source: Metric }> };
  aggregations?: { timeline?: { buckets: HistoryBucket[] } };
}

export class StackMonitoringServerPlugin implements Plugin {
  public setup(core: CoreSetup) {
    core.http.createRouter().get({
      path: '/api/stack_monitoring/overview',
      validate: { query: schema.object({
        minutes: schema.number({ defaultValue: 15, min: 1, max: 10080 }),
        kind: schema.oneOf([schema.literal('cluster'), schema.literal('node'), schema.literal('index'), schema.literal('pipeline'), schema.literal('logstash')], { defaultValue: 'cluster' }),
        entity: schema.maybe(schema.string({ minLength: 1, maxLength: 1024 })),
      }) },
    }, async (context, request, response) => {
      const { minutes, kind, entity } = request.query;
      if (kind !== 'cluster' && kind !== 'logstash' && !entity) return response.badRequest({ body: 'An entity is required for detail history.' });
      // Never use asInternalUser: a monitoring role controls access to the metrics index.
      const client = context.core.opensearch.client.asCurrentUser;
      const now = Date.now();
      const search = async (body: object): Promise<SearchResult> => (await client.search({
        index: INDEX, ignore_unavailable: true, allow_no_indices: true,
        expand_wildcards: ['open', 'hidden'], body,
      })).body as SearchResult;
      try {
        const latestResult = await search({ size: 1, sort: [{ timestamp: 'desc' }], query: { term: { kind: 'cluster' } } });
        const latest = latestResult.hits.hits[0]?._source as Metric | undefined;
        if (!latest) return response.ok({ body: { latest: null, nodes: [], indices: [], pipelines: [], logstashNodes: [], series: [], intervalMs: 10000, serverTime: now } });
        const sampleQuery = (sampleKind: MetricKind) => ({
          size: sampleKind === 'index' || sampleKind === 'pipeline' ? 10000 : 1000,
          query: { bool: { filter: [{ term: { kind: sampleKind } }, { term: { timestamp: latest.timestamp } }, { term: { cluster_uuid: latest.cluster_uuid } }] } },
        });
        const [nodes, indices, pipelines, logstashNodes, history] = await Promise.all([
          search(sampleQuery('node')), search(sampleQuery('index')),
          search(sampleQuery('pipeline')), search(sampleQuery('logstash')),
          search(historyQuery(minutes, kind, entity, now, latest.interval_ms, latest.cluster_uuid)),
        ]);
        const buckets = history.aggregations?.timeline?.buckets || [];
        const series: SeriesPoint[] = buckets.map((bucket) => ({
          timestamp: bucket.key,
          ...Object.fromEntries(HISTORY_FIELDS
            .map(field => [field, bucket[field]?.value ?? null])),
        } as SeriesPoint));
        const overview: Overview = {
          latest, nodes: nodes.hits.hits.map(hit => hit._source as Metric),
          indices: indices.hits.hits.map(hit => hit._source as Metric), series,
          pipelines: pipelines.hits.hits.map(hit => hit._source), logstashNodes: logstashNodes.hits.hits.map(hit => hit._source),
          intervalMs: latest.interval_ms || 10000, serverTime: now,
        };
        return response.ok({ body: overview });
      } catch (error) {
        const clientError = error as { statusCode?: number; meta?: { statusCode?: number } };
        const status = clientError.statusCode ?? clientError.meta?.statusCode;
        if (status === 401) return response.unauthorized();
        if (status === 403) return response.forbidden({ body: 'Missing read access to .stack-monitoring-*.' });
        return response.customError({ statusCode: 503, body: 'Monitoring data is temporarily unavailable. Check the OpenSearch and Dashboards logs.' });
      }
    });
  }
  public start() {}
  public stop() {}
}
