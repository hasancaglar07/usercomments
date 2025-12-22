import { app } from "./app";
import { env } from "./env";

const server = app.listen(env.PORT, () => {
  console.log(`API listening on port ${env.PORT}`);
});

server.requestTimeout = env.SERVER_TIMEOUT_MS;
server.headersTimeout = env.SERVER_HEADERS_TIMEOUT_MS;
server.keepAliveTimeout = env.SERVER_KEEP_ALIVE_TIMEOUT_MS;
