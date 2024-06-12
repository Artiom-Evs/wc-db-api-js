import RepositoryBase from "./RepositoryBase";
import pool from "./DbConnectionPool";
import { Attribute } from "../schemas";

const GET_ALL_QUERY = `
SELECT attribute_id AS id, attribute_name AS name, attribute_label AS slug
FROM wp_woocommerce_attribute_taxonomies;
`;

const GET_BY_ID_QUERY = `
SELECT attribute_id AS id, attribute_name AS name, attribute_label AS slug
FROM wp_woocommerce_attribute_taxonomies
WHERE attribute_id = ?;
`;

class AttributesRepository extends RepositoryBase {
    public async getAll(): Promise<Attribute[]> {
        const [rows] = await this._pool.execute(GET_ALL_QUERY, []);
        const attributes = rows as Attribute[];
        
        return attributes;
    }

    public async getById(id: number): Promise<Attribute | null> {
        const [rows] = await pool.execute(GET_BY_ID_QUERY, [ id ]);
        const attributes = rows as Attribute[];
        const attribute = attributes && Array.isArray(attributes) && attributes.length > 0 ? attributes[0] : null;

        return attribute;
    }
}

const attributesRepository = new AttributesRepository(pool);
export default attributesRepository;
