import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Category, CategorySchema } from "../schemas";
import categoriesRepository from "../infrastructure/CategoriesRepository";

export const GetCategoryBySlugEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        slug: z.string().min(1)
    }),
    output: z.object({
        item: z.nullable(CategorySchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const category = await categoriesRepository.getBySlug(input.slug);
        
        return { item: category };
    },
});
