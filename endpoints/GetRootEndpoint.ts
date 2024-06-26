import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";

export const GetRootEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({}),
    output: z.object({
        message: z.string()
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        return { message: `Hello from test ewagifts API! Swagger UI API documentation page serving at "http://<domain>/doc".` };
    },
});
