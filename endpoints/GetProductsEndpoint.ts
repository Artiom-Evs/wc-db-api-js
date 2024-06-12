import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Product, ProductSchema } from "../schemas";

export type GetProductsQuery = z.infer<typeof GetProductsQuerySchema >;
export const GetProductsQuerySchema = z.object({
    page: z.number().default(1),
    per_page: z.number().default(100),
    order_by: z.enum([ "date", "price", "quantity" ]).default("date"),
    order: z.enum([ "desc", "asc" ]).optional().default("desc"),
    min_price: z.number().optional(),
    max_price: z.number().optional(),
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

        const products: Product[] = [
            {
                id: 1, 
                sku: "someid",
                name: "Test product 1", 
                slug: "test-product-1",
                description: "",
                type: "simple",
                price: 24.95,
                stock_quantity: 10,
                created: "2024-01-01",
                modified: "2024-01-01",
                categories: [],
                images: [],
                attributes: [],
                default_attribute: [],
                variations: []
            }
        ];

        return { items: products };
    },
});
