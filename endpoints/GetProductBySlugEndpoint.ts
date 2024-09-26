import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { ProductSchema } from "../schemas";
import productsCache from "../services/ProductsCacheService";

export type GetProductBySlugQuery = z.infer<typeof GetProductBySlugQuerySchema >;
export const GetProductBySlugQuerySchema = z.object({
    slug: z.string().min(1)
});

export const GetProductBySlugEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: GetProductBySlugQuerySchema,
    output: z.object({
        item: z.nullable(ProductSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);
        
        const product = await productsCache.getProductBySlug(input.slug);

        // the product variable is converted to type any to avoid a type mismatch error. 
        // The ProductSchema and VariationSchema ZOD schemas for the created and modified fields use a ZOD type dateOut(), which is converted to a string type in the output type, but the input type is still to require value of a Date type before conversion.        
        return { item: product as any };
    },
});
