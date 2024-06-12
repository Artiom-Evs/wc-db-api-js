import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Attribute, AttributeSchema } from "../schemas";
import attributesRepository from "../infrastructure/AttributesRepository";

export const GetAttributeEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        id: z.string().transform((s) => parseInt(s))
    }),
    output: z.object({
        item: z.nullable(AttributeSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const attribute = await attributesRepository.getById(input.id);

        return { item: attribute };
    },
});
