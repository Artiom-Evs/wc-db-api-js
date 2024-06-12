import RepositoryBase from "./RepositoryBase";
import pool from "./DbConnectionPool";
import { Attribute, AttributeTerm } from "../schemas";

const GET_ALL_QUERY = `
SELECT attribute_id AS id, attribute_name AS name, attribute_label AS slug
FROM wp_woocommerce_attribute_taxonomies;
`;

const GET_BY_ID_QUERY = `
SELECT attribute_id AS id, attribute_name AS name, attribute_label AS slug
FROM wp_woocommerce_attribute_taxonomies
WHERE attribute_id = ?;
`;

const GET_TERMS_QUERY = `
SELECT t.term_id AS id, t.name, t.slug
FROM wp_terms AS t 
INNER JOIN wp_term_taxonomy AS tt ON t.term_id = tt.term_id
WHERE tt.taxonomy = CONCAT("pa_",
    (SELECT attribute_label
    FROM wp_woocommerce_attribute_taxonomies
    WHERE attribute_id = ?
    LIMIT 1))
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
    
    public async getTerms(attributeId: number): Promise<AttributeTerm[]> {
        const [rows] = await pool.execute(GET_TERMS_QUERY, [ attributeId ]);
        const terms = rows as AttributeTerm[];        

        return terms;
    }
}

const attributesRepository = new AttributesRepository(pool);
export default attributesRepository;
