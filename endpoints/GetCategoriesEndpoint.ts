import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Category, CategorySchema } from "../schemas";
import categoriesRepository from "../infrastructure/CategoriesRepository";

export const GetCategoriesEndpoint = defaultEndpointsFactory.build({
    method: "get",
    description: `"Slugs" parameter takes string with "," separators.`,
    input: z.object({
        slugs: z.string().optional()
    }),
    output: z.object({
        items: z.array(CategorySchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const slugs = input.slugs 
        ? input.slugs?.split(",").map(s => s.trim())
        : [];

        const categories = slugs.length > 0
        ? await categoriesRepository.getBySlugs(slugs)
        : await categoriesRepository.getAll();

        return { items: categories };
    },
});
