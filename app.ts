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
            }
        }
    }
};

createServer(config, routing);
