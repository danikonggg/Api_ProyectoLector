import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { resourceFromAttributes } from '@opentelemetry/resources';
import { ATTR_SERVICE_NAME } from '@opentelemetry/semantic-conventions';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';

let sdk: NodeSDK | null = null;

function tracesEndpoint(): string {
  if (process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT?.trim()) {
    return process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT.trim();
  }
  const base = process.env.OTEL_EXPORTER_OTLP_ENDPOINT?.trim();
  if (base) {
    return `${base.replace(/\/$/, '')}/v1/traces`;
  }
  return 'http://127.0.0.1:4318/v1/traces';
}

/**
 * OTLP HTTP (puerto típico 4318). Jaeger all-in-one / collector.
 * OTEL_ENABLED=true
 */
export async function initOpenTelemetry(): Promise<void> {
  if (process.env.OTEL_ENABLED !== 'true') {
    return;
  }
  if (sdk) {
    return;
  }

  const serviceName =
    process.env.OTEL_SERVICE_NAME?.trim() || 'api-lector';

  sdk = new NodeSDK({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: serviceName,
    }),
    traceExporter: new OTLPTraceExporter({
      url: tracesEndpoint(),
      headers: process.env.OTEL_EXPORTER_OTLP_HEADERS
        ? Object.fromEntries(
            process.env.OTEL_EXPORTER_OTLP_HEADERS.split(',').map((p) => {
              const [k, ...v] = p.split('=');
              return [k.trim(), v.join('=').trim()];
            }),
          )
        : undefined,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  });

  await sdk.start();
}
