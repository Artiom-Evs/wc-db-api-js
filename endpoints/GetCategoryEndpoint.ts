import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Category, CategorySchema } from "../schemas";
import pool from "../infrastructure/DbConnectionPool";

const query = `
select tt.term_id AS id, tt.parent AS parent_id, t.name, t.slug, tt.description, tt.count
from wp_term_taxonomy as tt
join wp_terms as t on t.term_id = tt.term_id
where tt.taxonomy = "product_cat"
    AND tt.term_id = ?
`;

export const GetCategoryEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        id: z.string().transform((s) => parseInt(s))
    }),
    output: z.object({
        item: z.nullable(CategorySchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const [rows] = await pool.execute(query, [ input.id ]);
        const categories = rows as Category[];
        const category = categories && Array.isArray(categories) && categories.length > 0 ? categories[0] : null;
        return { item: category };
    },
});
