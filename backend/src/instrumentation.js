const { NodeSDK } = require("@opentelemetry/sdk-node");
const {
  getNodeAutoInstrumentations,
} = require("@opentelemetry/auto-instrumentations-node");
const {
  OTLPTraceExporter,
} = require("@opentelemetry/exporter-trace-otlp-http");
let sdk;
if (process.env.OTEL_ENABLED === "true") {
  sdk = new NodeSDK({
    serviceName: "ops-incident-api",
    traceExporter: new OTLPTraceExporter({
      url:
        process.env.OTEL_EXPORTER_OTLP_TRACES_ENDPOINT ||
        "http://localhost:4318/v1/traces",
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        "@opentelemetry/instrumentation-fs": { enabled: false },
        "@opentelemetry/instrumentation-pg": {
          enhancedDatabaseReporting: false,
        },
      }),
    ],
  });
  sdk.start();
}
module.exports = {
  shutdown: async () => {
    if (sdk) await sdk.shutdown();
  },
};
