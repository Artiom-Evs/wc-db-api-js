import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Category, CategorySchema } from "../schemas";

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

        const category = categories.find(c => c.id == input.id) ?? null;
        return { item: category };
    },
});
