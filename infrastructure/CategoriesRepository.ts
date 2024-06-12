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
`;

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
}

const categoriesRepository = new CategoriesRepository(pool);
export default categoriesRepository;
