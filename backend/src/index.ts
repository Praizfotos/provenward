import { config } from "./config";
import { logger } from "./logger";
import { createApp } from "./app";

const app = createApp();

app.listen(config.PORT, config.HOST, () => {
  logger.info(
    { host: config.HOST, port: config.PORT, contractId: config.CONTRACT_ID },
    "provenward backend listening",
  );
});