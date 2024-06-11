import { z } from "zod";
import { createConfig, defaultEndpointsFactory } from "express-zod-api";
import { Routing } from "express-zod-api";
import { createServer } from "express-zod-api";

const config = createConfig({
    server: {
        listen: 8090, // port, UNIX socket or options
    },
    cors: true,
    logger: { level: "debug", color: true },
});


const helloApi = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        name: z.string().default("anonimous")
    }),
    output: z.object({
        message: z.string()
    }),
    handler: async ({ input: { name }, options, logger }) => {
        logger.debug("Options:", options);
        return { message: `Hello, ${name || "World"}. Happy coding!` };
    },
});

const routing: Routing = {
    v1: {
        hello: helloApi
    }
};

createServer(config, routing);
