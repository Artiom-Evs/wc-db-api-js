import { GetRootEndpoint } from "./endpoints/GetRootEndpoint";
import { GetAttributeEndpoint } from "./endpoints/GetAttributeEndpoint";
import { GetAttributesEndpoint } from "./endpoints/GetAttributesEndpoint";
import { GetAttributeTermsEndpoint } from "./endpoints/GetAttributeTermsEndpoint";
import { GetCategoryEndpoint } from "./endpoints/GetCategoryEndpoint";
import { GetCategoriesEndpoint } from "./endpoints/GetCategoriesEndpoint";
import { GetProductEndpoint } from "./endpoints/GetProductEndpoint";
import { GetProductsEndpoint } from "./endpoints/GetProductsEndpoint";
import { Documentation, createConfig } from "express-zod-api";
import { Routing } from "express-zod-api";
import { createServer } from "express-zod-api";
import swaggerUI from "swagger-ui-express";

const port = process.env.APP_HTTP_PORT ? parseInt(process.env.APP_HTTP_PORT) : null;
if (!port)
    throw new Error(`"APP_HTTP_PORT" environment variable should be defined.`);

const config = createConfig({
    server: {
        listen: port
    },
    cors: true,
    logger: { 
        level: "debug", 
        color: true 
    }
});

const routing: Routing = {
    api: {
        v1: {
            products: {
                ":id": GetProductEndpoint,
                "": GetProductsEndpoint
            },
            categories: {
                ":id": GetCategoryEndpoint,
                "": GetCategoriesEndpoint
            },
            attributes: {
                ":id": {
                    terms: GetAttributeTermsEndpoint,
                    "": GetAttributeEndpoint
                },
                "": GetAttributesEndpoint
            }
        }
    },
    "": GetRootEndpoint
};

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
