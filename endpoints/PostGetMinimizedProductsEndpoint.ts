import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { MinimizedProduct, MinimizedProductSchema } from "../schemas";
import productsCache from "../services/ProductsCacheService";

export const PostGetMinimizedProductsEndpoint = defaultEndpointsFactory.build({
    method: "post",
    input: z.object({
        products: z.array(z.object({
            product_id: z.number(),
            variation_id: z.number().optional()
        }))
    }),
    output: z.object({
        items: z.array(MinimizedProductSchema)
    }),
    handler: async ({ input, logger }) => {
        const productIds = input.products.filter(p => !p.variation_id).map(p  => p.product_id);
        const variationIds = input.products.filter(p => p.variation_id).map(p  => p.variation_id ?? 0);
        
        const minimizedProducts = await productsCache.getMinimizedProducts(input.products)

        return { items: minimizedProducts };
    }
});
