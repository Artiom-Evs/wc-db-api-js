import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { ProductSchema, ProductsStatisticSchema } from "../schemas";
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
    search: z.string().optional(),
    include: z.string().optional().transform(v => v?.split(",").map(s => parseInt(s)).filter(n => n)),
    slugs: z.string().optional().transform(v => v?.split(",").map(s => s.trim().toLowerCase()).filter(n => n))
});

const GetProductsResponseSchema = z.object({
    statistic: ProductsStatisticSchema.nullable(),
    items: z.array(ProductSchema)
});

export const GetProductsEndpoint = defaultEndpointsFactory.build({
    method: "get",
    description: `"include" parameter takes list of a numbers as a string with "," separators. "slugs" parameter takes list of a product slugs separated by ",". When "include" or "slugs" parameter is used, then all other parameters are ignored.`,
    input: GetProductsQuerySchema,
    output: GetProductsResponseSchema,
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        if (input.include && Array.isArray(input.include)) {
            const products = await productsRepository.GetByIds(input.include);
            return { statistic: null, items: products as any };
        }
        else if (input.slugs && Array.isArray(input.slugs)) {
            const products = await productsRepository.GetBySlugs(input.slugs);
            return { statistic: null, items: products as any };
        }
        
        const products =await productsRepository.getAll(input);
        const statistic = await productsRepository.getProductsStatistic(input);

        // the products variable is converted to type any to avoid a type mismatch error. 
        // The ProductSchema and VariationSchema ZOD schemas for the created and modified fields use a ZOD type dateOut(), which is converted to a string type in the output type, but the input type is still to require value of a Date type before conversion.
        return { statistic, items: products as any };
    },
});
