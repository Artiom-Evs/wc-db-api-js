import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Category, CategorySchema } from "../schemas";
import categoriesRepository from "../infrastructure/CategoriesRepository";

export const GetCategoryEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        id: z.string().transform((s) => parseInt(s))
    }),
    output: z.object({
        item: z.nullable(CategorySchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const category = await categoriesRepository.getById(input.id);
        
        return { item: category };
    },
});
