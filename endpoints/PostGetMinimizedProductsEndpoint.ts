import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { MinimizedProduct, MinimizedProductSchema } from "../schemas";
import productsRepository from "../infrastructure/ProductsRepository";

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

        const minimizedProducts = await productsRepository.getMinimized(productIds, variationIds);

        const sortedMinimizedProducts: MinimizedProduct[] = [];
        input.products.forEach(p => {
            const id = p.variation_id && p.variation_id !== 0 ? p.variation_id : p.product_id;
            const mp = minimizedProducts.find(mp => mp.id === id);
            if (mp)
                sortedMinimizedProducts.push(mp);
        });

        return { items: sortedMinimizedProducts };
    }
});
