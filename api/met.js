import { proxyMetRequest } from "./_metProxy.js";

export default {
  async fetch(request) {
    return proxyMetRequest(request);
  }
};
