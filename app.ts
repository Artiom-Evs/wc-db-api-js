import { Documentation, createConfig } from "express-zod-api";
import { createServer } from "express-zod-api";
import swaggerUI from "swagger-ui-express";
import { GetProductBySlugEndpoint } from "./endpoints/GetProductBySlugEndpoint";
import synchronizationService from "./services/ProductsCacheSynchronizationService";
import { appRouting as routing } from "./AppRouting";

synchronizationService.initialize();

const port = process.env.APP_HTTP_PORT ? parseInt(process.env.APP_HTTP_PORT) : null;
if (!port)
    throw new Error(`"APP_HTTP_PORT" environment variable should be defined.`);

const config = createConfig({
    server: {
        listen: port
    },
    startupLogo: false,
    cors: true,
    logger: { 
        level: "debug", 
        color: true 
    }
});

// create OpenAPI documentation with Swagger UI web page
const doc = new Documentation({
    routing,
    config,
    serverUrl: "",
    title: "Hello from Swagger UI!",
    version: "1.0.0"
});
const openapiSchema = doc.getSpecAsJson();
const openapiSchemaObj = JSON.parse(openapiSchema);

config.server.beforeRouting = ({ app, logger }) => {
    logger.info("Serving documentation at: /doc");
    app.use("/doc", swaggerUI.serve, swaggerUI.setup(openapiSchemaObj));
};

createServer(config, routing);
