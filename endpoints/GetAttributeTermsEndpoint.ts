import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { AttributeTermSchema } from "../schemas";
import attributesRepository from "../infrastructure/AttributesRepository";

export const GetAttributeTermsEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        id: z.string().transform((s) => parseInt(s))
    }),
    output: z.object({
        items: z.array(AttributeTermSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const terms = await attributesRepository.getTerms(input.id);

        return { items: terms };
    },
});
