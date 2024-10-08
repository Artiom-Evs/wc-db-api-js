import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { ProductSchema, ProductsStatisticSchema } from "../schemas";
import productsCache from "../services/ProductsCacheService";

export type GetProductsQuery = z.infer<typeof GetProductsQuerySchema>;
export const GetProductsQuerySchema = z.object({
    page: z.string().transform((s) => parseInt(s)).optional(),
    per_page: z.string().transform((s) => parseInt(s)).optional(),
    order_by: z.enum(["date", "price", "quantity"]).optional(),
    order: z.enum(["desc", "asc"]).optional(),
    min_price: z.string().transform((s) => parseFloat(s)).optional(),
    max_price: z.string().transform((s) => parseFloat(s)).optional(),
    category: z.string().optional().transform(s => s?.toLowerCase() ?? s),
    pa_supplier: z.string().optional().transform<string[] | undefined>(s => !s ? undefined : s.split(",").map(s => s.trim().toLowerCase())),
    pa_color: z.string().optional().transform<string[] | undefined>(s => !s ? undefined : s.split(",").map(s => s.trim().toLowerCase())),
    pa_base_color: z.string().optional().transform<string[] | undefined>(s => !s ? undefined : s.split(",").map(s => s.trim().toLowerCase())),
    pa_size: z.string().optional().transform(s => !s ? undefined : s.split(",").map(s => s.trim().toLowerCase())),
    search: z.string().optional().transform(s => !s ? undefined : s.toLowerCase().trim()),
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
            const products = await productsCache.getProductsByIds(input.include);
            return { statistic: null, items: products as any };
        }
        else if (input.slugs && Array.isArray(input.slugs)) {
            const products = await productsCache.getProductsBySlugs(input.slugs);
            return { statistic: null, items: products as any };
        }
        
        const [products, statistic] = await productsCache.getProductsWithStatistic(input);

        return { statistic, items: products };
    },
});
