import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Category, CategorySchema } from "../schemas";

export const GetCategoriesEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({}),
    output: z.object({
        items: z.array(CategorySchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const categories: Category[] = [
            {
                id: 1,
                parent_id: 0,
                name: "Some Category 1", 
                slug: "some-categories-1",
                description: "",
                count: 10
            },
            {
                id: 2,
                parent_id: 1,
                name: "Some Parent Category 1", 
                slug: "some-parent-categories-1",
                description: "",
                count: 10
            }
        ];
        
        return { items: categories };
    },
});
