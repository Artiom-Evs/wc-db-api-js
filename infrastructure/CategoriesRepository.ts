import { Category } from "../schemas";
import pool from "./DbConnectionPool";
import RepositoryBase from "./RepositoryBase";

const GET_ALL_QUERY = `
select tt.term_id AS id, tt.parent AS parent_id, t.name, t.slug, tt.description, tt.count
from wp_term_taxonomy as tt
join wp_terms as t on t.term_id = tt.term_id
where tt.taxonomy = "product_cat";
`;

const GET_BY_ID_QUERY = `
select tt.term_id AS id, tt.parent AS parent_id, t.name, t.slug, tt.description, tt.count
from wp_term_taxonomy as tt
join wp_terms as t on t.term_id = tt.term_id
where tt.taxonomy = "product_cat"
    AND tt.term_id = ?
LIMIT 1;
`;

const GET_BY_SLUG_QUERY = `
select tt.term_id AS id, tt.parent AS parent_id, t.name, t.slug, tt.description, tt.count
from wp_term_taxonomy as tt
join wp_terms as t on t.term_id = tt.term_id
where tt.taxonomy = "product_cat"
    AND t.slug = ?
LIMIT 1;
`;

const createGetProductsCategoriesQuery = (ids: number[]) => `
SELECT
    TR.object_id, 
    T.term_id AS id, 
    T.name, 
    T.slug, 
    TT.parent AS parent_id, 
    TT.description, 
    TT.count
FROM wp_term_relationships AS TR
JOIN wp_term_taxonomy AS TT 
    ON TR.term_taxonomy_id = TT.term_taxonomy_id
JOIN wp_terms AS T 
	ON TT.term_id = T.term_id
WHERE TR.object_id IN (${ids.map(() => "?").join(", ")}) AND TT.taxonomy = "product_cat";
`;

export interface DBCategory {
    object_id: number,
    id: number,
    parent_id: number,
    name: string,
    slug: string,
    description: string,
    count: number
}

class CategoriesRepository extends RepositoryBase {
    public async getAll(): Promise<Category[]> {
        const [rows] = await this._pool.execute(GET_ALL_QUERY, []);
        const categories = rows as Category[];
        
        return categories;
    }

    public async getById(id: number): Promise<Category | null> {
        const [rows] = await pool.execute(GET_BY_ID_QUERY, [ id ]);
        const categories = rows as Category[];
        const category = categories && Array.isArray(categories) && categories.length > 0 ? categories[0] : null;

        return category;
    }

    public async getBySlug(slug: string): Promise<Category | null> {
        const [rows] = await pool.execute(GET_BY_SLUG_QUERY, [ slug]);
        const categories = rows as Category[];
        const category = categories && Array.isArray(categories) && categories.length > 0 ? categories[0] : null;

        return category;
    }

    public async getProductsCategories(productIds: number[]): Promise<DBCategory[]> {
        if (productIds.length === 0)
            return [];

        const query = createGetProductsCategoriesQuery(productIds);
        const [categoryRows] = await this._pool.execute(query, productIds);

        return categoryRows as DBCategory[];
    }
}

const categoriesRepository = new CategoriesRepository(pool);
export default categoriesRepository;
