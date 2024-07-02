import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { AttributeTermSchema } from "../schemas";
import attributesRepository from "../infrastructure/AttributesRepository";

export const GetAttributeTermsBySlugEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        slug: z.string()
    }),
    output: z.object({
        items: z.array(AttributeTermSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const terms = await attributesRepository.getTermsBySlug(input.slug);

        return { items: terms };
    },
});
