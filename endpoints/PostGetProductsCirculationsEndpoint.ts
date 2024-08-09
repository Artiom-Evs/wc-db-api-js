import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { ProductPriceCirculation, ProductPriceCirculationSchema } from "../schemas";
import productsRepository from "../infrastructure/ProductsRepository";

export const PostGetProductsCirculationsEndpoint = defaultEndpointsFactory.build({
    method: "post",
    
    input: z.object({
        products: z.array(z.object({
            product_id: z.number(),
            variation_id: z.number()
        }))
    }),
    output: z.object({
        items: z.array(ProductPriceCirculationSchema)
    }),
    handler: async ({ input, options, logger }) => {
        const productOrVariationIds = input.products.map(({ product_id, variation_id }) => {
            return variation_id && variation_id != 0 ? variation_id : product_id;
        });
        const circulations = await productsRepository.getCirculations(productOrVariationIds);
        const items: ProductPriceCirculation[] = input.products.map(p => {
            const dbCirculations = p.variation_id && p.variation_id != 0
                ? circulations.find(c => c.product_or_variation_id === p.variation_id)
                : circulations.find(c => c.product_or_variation_id === p.product_id);

            return {
                product_id: p.product_id, 
                variation_id: p.variation_id,
                stock_quantity: dbCirculations?.stock_quantity ?? null,
                price_circulations: dbCirculations?.price_circulations ?? null
            };
        });
        
        return { items };
    },
});
