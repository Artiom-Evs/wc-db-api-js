import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { ProductSchema } from "../schemas";
import productsRepository from "../infrastructure/ProductsRepository";

export type GetProductsQuery = z.infer<typeof GetProductsQuerySchema >;
export const GetProductsQuerySchema = z.object({
    page: z.string().transform((s) => parseInt(s)).optional(),
    per_page: z.string().transform((s) => parseInt(s)).optional(),
    order_by: z.enum([ "date", "price", "quantity" ]).optional(),
    order: z.enum([ "desc", "asc" ]).optional(),
    min_price: z.string().transform((s) => parseInt(s)).optional(),
    max_price: z.string().transform((s) => parseInt(s)).optional(),
    category: z.string().optional(),
    attribute: z.string().optional(),
    attribute_term: z.string().optional(),
    search: z.string().optional()
});

export const GetProductsEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: GetProductsQuerySchema,
    output: z.object({
        items: z.array(ProductSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const products = await productsRepository.getAll(input, logger);
        
        return { items: products };
    },
});
