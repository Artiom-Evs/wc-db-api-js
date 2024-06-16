import RepositoryBase from "./RepositoryBase";
import pool from "./DbConnectionPool";
import { Attribute, AttributeTerm, VariationAttribute } from "../schemas";

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



const createGetProductsAttributeTermsQuery = (ids: number[]) => `
SELECT 
    A.product_or_parent_id AS parent_id, 
    A.taxonomy AS attribute_slug, 
    T.term_id AS id,
    T.name,
    T.slug
FROM wp_wc_product_attributes_lookup AS A 
JOIN wp_terms AS T ON A.term_id = T.term_id
WHERE product_or_parent_id IN (${ids.map(() => "?").join(", ")});;
`;

const createGetVariationsAttributesQuery= (ids: number[]) => `
SELECT
	post_id AS parent_id,
    SUBSTRING(meta_key, 11) AS slug,
    meta_value AS "option"
FROM wp_postmeta
WHERE post_id IN (${ids.map(() => "?").join(", ")}) AND meta_key LIKE "attribute_%";
`;

export interface DBProductAttributeTerm {
    id: number,
    name: string, 
    slug: string,
    parent_id: number,
    attribute_slug: string,
}

export interface DBVariationAttribute {
    parent_id: number,
    slug: string,
    option: string
}

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

    public async getProductsAttributeTerms(productIds: number[]): Promise<DBProductAttributeTerm[]> {
        if (productIds.length === 0)
            return [];

        const query = createGetProductsAttributeTermsQuery(productIds);
        const [rows] = await this._pool.execute(query, productIds);

        return rows as DBProductAttributeTerm[];
    }

    public async getVariationsAttributes(variationIds: number[]): Promise<DBVariationAttribute[]> {
        if (variationIds.length === 0)
            return [];

        const query = createGetVariationsAttributesQuery(variationIds);
        const [attributeRows] = await this._pool.execute(query, variationIds);

        return attributeRows as DBVariationAttribute[];
    }
}

const attributesRepository = new AttributesRepository(pool);
export default attributesRepository;
