import moment from "moment";
import { Attribute, VariationAttribute, Category, Image, Product, Variation } from "../schemas";
import pool from "./DbConnectionPool";
import RepositoryBase from "./RepositoryBase";
import { unserialize } from "php-serialize";
import attributesRepository, { DBProductAttributeTerm, DBVariationAttribute } from "./AttributesRepository";

const GET_ALL_QUERY = `
CALL GetProductsV2(?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

const GET_BY_ID_QUERY = `
CALL GetProductByID(?);
`;

const createGetImagesByIdsQuery = (ids: number[]) => `
SELECT 
    ID AS id, 
    post_parent AS parent_id, 
    post_title AS name, 
    guid AS src
FROM wp_posts
WHERE ID IN (${ids.map(() => "?").join(", ")}) AND post_mime_type LIKE "image/%";
`;
const createGetProductsImagesQuery = (ids: number[]) => `
SELECT 
    ID AS id, 
    post_parent AS parent_id, 
    post_title AS name, 
    guid AS src
FROM wp_posts
WHERE post_parent IN (${ids.map(() => "?").join(", ")}) AND post_mime_type LIKE "image/%";
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

const createGetProductsVariationsQuery = (ids: number[]) => `
SELECT 
    ID AS id, 
    post_parent AS parent_id, 
    post_title AS name, 
    post_name AS slug, 
    post_date AS created, 
    post_modified AS modified,
    CAST(m1.meta_value AS DECIMAL(10, 2)) AS price,
    CAST(m2.meta_value AS DECIMAL(4)) AS stock_quantity,
    m3.meta_value AS sku,
    m4.meta_value AS variation_image_gallery,
    m5.meta_value AS description
FROM wp_posts
LEFT JOIN wp_postmeta AS m1 ON wp_posts.ID = m1.post_id AND m1.meta_key = "_price"
LEFT JOIN wp_postmeta AS m2 ON wp_posts.ID = m2.post_id AND m2.meta_key = "_stock"
LEFT JOIN wp_postmeta AS m3 ON wp_posts.ID = m3.post_id AND m3.meta_key = "_sku"
LEFT JOIN wp_postmeta AS m4 ON wp_posts.ID = m4.post_id AND m4.meta_key = "variation_image_gallery"
LEFT JOIN wp_postmeta AS m5 ON wp_posts.ID = m5.post_id AND m5.meta_key = "_variation_description"
WHERE post_parent IN (${ids.map(() => "?").join(", ")}) 
    AND post_type = "product_variation" 
    AND post_status = "publish";
`;

interface GetProductsOptions {
    page?: number,
    per_page?: number,
    order_by?: "date" | "price" | "quantity" | "name",
    order?: "asc" | "desc",
    min_price?: number,
    max_price?: number,
    category?: string,
    attribute?: string,
    attribute_term?: string,
    search?: string
}

interface DBImage {
    id: number,
    parent_id: number,
    name: string,
    src: string
}

class ProductsRepository extends RepositoryBase {
    public async getAll({
        page = 1,
        per_page = 100,
        min_price = -1,
        max_price = -1,
        order_by = "date",
        order = "desc",
        category = "",
        attribute = "",
        attribute_term = "",
        search = ""
    }: GetProductsOptions): Promise<Product[]> {

        const [[rows]] = await this._pool.execute<[any[]]>(GET_ALL_QUERY, [
            per_page,
            per_page * (page - 1),
            min_price,
            max_price,
            order_by,
            order,
            category,
            attribute,
            attribute_term,
            search
        ]);

        const products = rows as Product[];
        const productIds = products.map(p => p.id);
        const [categoryRows] = await this._pool.execute<any[]>(createGetProductsCategoriesQuery(productIds), productIds);
        const [variationRows] = await this._pool.execute<any[]>(createGetProductsVariationsQuery(productIds), productIds);
        const variations = variationRows as Variation[];
        const variationIds = variations.map(v => v.id);
        const [imageRows] = await this._pool.query<any[]>(createGetProductsImagesQuery([...productIds, ...variationIds]), [...productIds, ...variationIds]);
        const variationsImages = await this.getVariationsImages(variations);

        const globalAttributes: Attribute[] = await attributesRepository.getAll();
        const attributesTerms = await attributesRepository.getProductsAttributeTerms(productIds);
        const variationsAttributes = await attributesRepository.getVariationsAttributes(variationIds);

        products.forEach(product => {
            this.initProductAttributes(product, globalAttributes, attributesTerms);
            this.initProductDefaultAttributes(product, globalAttributes, attributesTerms);
            
            product.categories = categoryRows.filter(c => c.object_id === product.id) as Category[];
            product.images = imageRows.filter(i => i.parent_id === product.id) as Image[];
            product.variations = variations.filter(v => v.parent_id === product.id);

            product.type = product.variations.length === 0 ? "simple" : "variable";
            product.price = product.price != null ? parseInt(product.price as any) : null;
            product.stock_quantity = product.stock_quantity != null ? parseInt(product.stock_quantity as any) : null;
            
            product.variations.forEach(variation => {
                variation.price = variation.price != null ? parseInt(variation.price as any) : null;
                variation.stock_quantity = variation.stock_quantity != null ? parseInt(variation.stock_quantity as any) : null;
                variation.images = variationsImages.filter(i => (variation as any).variation_image_gallery?.includes(i.id)) as Image[];

                this.initVariationAttributes(variation, globalAttributes, variationsAttributes);
            });
        });

        return products;
    }

    public async getById(id: number): Promise<Product | null> {
        const [[productRows]] = await this._pool.execute<[any[]]>(GET_BY_ID_QUERY, [id]);
        const [categoryRows] = await this._pool.execute<any[]>(createGetProductsCategoriesQuery([id]), [id]);
        const [variationRows] = await this._pool.execute<any[]>(createGetProductsVariationsQuery([id]), [id]);
        const variations = variationRows as Variation[];
        const variationIds = variations.map(v => v.id);
        const [imageRows] = await this._pool.execute<any[]>(createGetProductsImagesQuery([id, ...variationIds]), [id, ...variationIds]);
        const variationsImages = await this.getVariationsImages(variations);

            console.log(variationsImages);

        const products = productRows as Product[];
        const product = products && Array.isArray(products) && products.length > 0 ? products[0] : null;

        if (product) {
            product.type = variationRows.length === 0 ? "simple" : "variable";
            product.price = product.price != null ? parseInt(product.price as any) : null;
            product.stock_quantity = product.stock_quantity != null ? parseInt(product.stock_quantity as any) : null;

            const globalAttributes: Attribute[] = await attributesRepository.getAll();
            const attributesTerms = await attributesRepository.getProductsAttributeTerms([product.id]);
            const variationsAttributes = await attributesRepository.getVariationsAttributes(variationIds);

            this.initProductAttributes(product, globalAttributes, attributesTerms);
            this.initProductDefaultAttributes(product, globalAttributes, attributesTerms);

            product.categories = categoryRows as Category[];
            product.images = imageRows.filter(i => i.parent_id === product.id) as Image[];
            product.variations = variations;

            product.variations.forEach(variation => {
                variation.price = variation.price != null ? parseInt(variation.price as any) : null;
                variation.stock_quantity = variation.stock_quantity != null ? parseInt(variation.stock_quantity as any) : null;
                variation.images = variationsImages.filter(i => (variation as any).variation_image_gallery?.includes(i.id)) as Image[];

                this.initVariationAttributes(variation, globalAttributes, variationsAttributes);
            });
        }

        return product;
    }

    private initProductAttributes(product: Product, globalAttributes: Attribute[], attributesTerms: DBProductAttributeTerm[]): void {
        if (!product.attributes) {
            product.attributes = [];
            return;
        }

        const attributes = Object.values(unserialize((product as any).attributes));

        product.attributes = attributes.map((a: any) => {
            const gAttribute = globalAttributes.find(ga => `pa_${ga.slug}` === a.name);
            const options = attributesTerms.filter(t => t.parent_id === product.id && t.attribute_slug === a.name);

            if (!gAttribute)
                throw new Error(`Product with ID ${product.id} contains unexisted attribute "${a.name}".`);

            return {
                id: gAttribute.id,
                name: gAttribute.name,
                slug: gAttribute.slug,
                visible: !!a.is_visible,
                variation: !!a.is_variation,
                options
            }
        });
    }

    private initProductDefaultAttributes(product: Product, globalAttributes: Attribute[], attributesTerms: DBProductAttributeTerm[]): void {
        if (!product.default_attributes) {
            product.default_attributes = [];
            return;
        }
            
        const defaultAttributes = unserialize((product as any).default_attributes);
        product.default_attributes = [];
        
        for (const [attrSlug, termSlug] of Object.entries(defaultAttributes)) {
            const pAttribute = product.attributes.find(a => `pa_${a.slug}` === attrSlug);
            if (!pAttribute)
                throw new Error(`"${attrSlug}" default attribute does not have related attribute in the product with ID ${product.id}.in the the de`);

            const aTerm = pAttribute?.options.find(t => t.slug === termSlug);
            if (!aTerm)
                throw new Error(`"${termSlug}" default attribute does not found in options of the "${attrSlug}" attribute of the the product with ID ${product.id}.in the the de`);

            product.default_attributes.push({
                id: aTerm.id,
                name: aTerm.name,
                option: aTerm.slug
            });
        }
    }

    private initVariationAttributes(variation: Variation, globalAttributes: Attribute[], variationsAttributes: DBVariationAttribute[]): void {
        variation.attributes = variationsAttributes.filter(a => a.parent_id === variation.id)
        .map(a => {
            const gAttribute = globalAttributes.find(ga => `pa_${ga.slug}` === a.slug);
            
            if (!gAttribute)
                throw new Error(`"${a.slug}" variation attribute does not found in the list of the global attributes.`);

            return {
                id: gAttribute.id,
                name: gAttribute.name,
                option: a.option
            };
        })
    }

    private async getVariationsImages(variations: Variation[]): Promise<DBImage[]> {
        if (variations.length === 0)
            return [];

        let imageIds: number[] = [];

        variations.forEach((v: any) => {
            const imageGallery = v.variation_image_gallery as string | null;
            if (!imageGallery)
                return;

            const ids = imageGallery.split(";").map(i => parseInt(i));
            
            imageIds = [...imageIds, ...ids];
            v.variation_image_gallery = ids;
        });

        if (imageIds.length === 0)
            return [];

        const query = createGetImagesByIdsQuery(imageIds);
        const [imageRows] = await this._pool.execute(query, imageIds);
        return imageRows as DBImage[];
    }
}

const productsRepository = new ProductsRepository(pool);
export default productsRepository;
