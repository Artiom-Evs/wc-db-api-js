import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { PageInfo, PageInfoSchema } from "../schemas";
import pagesRepository from "../infrastructure/PagesRepository";

export const GetPageBySlugEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        slug: z.string()
    }),
    output: z.object({
        item: PageInfoSchema.nullable()
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const page = await pagesRepository.getBySlug(input.slug);

        return { item: page };
    },
});
