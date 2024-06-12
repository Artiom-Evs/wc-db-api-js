import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { ProductAttribute, ProductAttributeSchema } from "../schemas";

export const GetAttributesEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({}),
    output: z.object({
        items: z.array(ProductAttributeSchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const attributes: ProductAttribute[] = [
            {
                id: 1,
                name: "Supplier",
                slug: "pa_supplier",
                visible: true,
                variation: false,
                options: []
            },
            {
                id: 2,
                name: "Color",
                slug: "pa_color",
                visible: true,
                variation: true,
                options: []
            }
        ]

        return { items: attributes };
    },
});
