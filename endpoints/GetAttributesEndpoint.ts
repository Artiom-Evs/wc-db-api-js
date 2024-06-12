import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Attribute, AttributeSchema } from "../schemas";
import attributesRepository from "../infrastructure/AttributesRepository";

export const GetAttributesEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({}),
    output: z.object({
        items: z.array(AttributeSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const attributes: Attribute[] = await attributesRepository.getAll();

        return { items: attributes };
    },
});
