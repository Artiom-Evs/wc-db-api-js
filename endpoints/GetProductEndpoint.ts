import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Product, ProductSchema } from "../schemas";

export type GetProductQuery = z.infer<typeof GetProductQuerySchema >;
export const GetProductQuerySchema = z.object({
    id: z.string().transform((s) => parseInt(s))
});

export const GetProductEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: GetProductQuerySchema,
    output: z.object({
        item: z.nullable(ProductSchema)
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

        const product = products.find(p => p.id == input.id) ?? null;
        return { item: product };
    },
});
