import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { PageInfo, PageInfoSchema } from "../schemas";
import pagesRepository from "../infrastructure/PagesRepository";

export const GetPagesEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({}),
    output: z.object({
        items: z.array(PageInfoSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const pages = await pagesRepository.getAll();

        return { items: pages };
    },
});
