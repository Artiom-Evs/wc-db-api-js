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

const GetProductsResponseSchema = z.object({
    statistic: z.object({
        products_count: z.number(),
        min_price: z.number(),
        max_price: z.number()
    }),
    items: z.array(ProductSchema)
});

export const GetProductsEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: GetProductsQuerySchema,
    output: GetProductsResponseSchema,
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const products = await productsRepository.getAll(input);
        const statistic = await productsRepository.getProductsStatistic(input);
        
        return { statistic, items: products };
    },
});
