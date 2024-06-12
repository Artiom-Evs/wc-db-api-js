import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Category, CategorySchema } from "../schemas";
import categoriesRepository from "../infrastructure/CategoriesRepository";

export const GetCategoriesEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({}),
    output: z.object({
        items: z.array(CategorySchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const categories = await categoriesRepository.getAll();

        return { items: categories };
    },
});
