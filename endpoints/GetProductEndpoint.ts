import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { ProductSchema } from "../schemas";
import productsRepository from "../infrastructure/ProductsRepository";

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
        
        const product = await productsRepository.getById(input.id);

        // the product variable is converted to type any to avoid a type mismatch error. 
        // The ProductSchema and VariationSchema ZOD schemas for the created and modified fields use a ZOD type dateOut(), which is converted to a string type in the output type, but the input type is still to require value of a Date type before conversion.        
        return { item: product as any };
    },
});
