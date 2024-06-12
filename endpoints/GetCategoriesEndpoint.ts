import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Category, CategorySchema } from "../schemas";
import pool from "../infrastructure/DbConnectionPool";

const query = `
select tt.term_id AS id, tt.parent AS parent_id, t.name, t.slug, tt.description, tt.count
from wp_term_taxonomy as tt
join wp_terms as t on t.term_id = tt.term_id
where tt.taxonomy = "product_cat";
`;

export const GetCategoriesEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({}),
    output: z.object({
        items: z.array(CategorySchema)
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const [rows] = await pool.execute(query, []);
        const categories = rows as Category[];
        
        return { items: categories };
    },
});
