import { GetAttributeEndpoint } from "./endpoints/GetAttributeEndpoint";
import { GetAttributesEndpoint } from "./endpoints/GetAttributesEndpoint";
import { GetAttributeTermsEndpoint } from "./endpoints/GetAttributeTermsEndpoint";
import { GetCategoryEndpoint } from "./endpoints/GetCategoryEndpoint";
import { GetCategoriesEndpoint } from "./endpoints/GetCategoriesEndpoint";
import { GetProductEndpoint } from "./endpoints/GetProductEndpoint";
import { GetProductsEndpoint } from "./endpoints/GetProductsEndpoint";
import { createConfig } from "express-zod-api";
import { Routing } from "express-zod-api";
import { createServer } from "express-zod-api";

const config = createConfig({
    server: {
        listen: 8090
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
    }
};

createServer(config, routing);