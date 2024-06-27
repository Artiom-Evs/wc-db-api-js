import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Attribute, AttributeSchema } from "../schemas";
import attributesRepository from "../infrastructure/AttributesRepository";

export const GetAttributeBySlugEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        slug: z.string().min(1)
    }),
    output: z.object({
        item: z.nullable(AttributeSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const attribute = await attributesRepository.getBySlug(input.slug);

        return { item: attribute };
    },
});
