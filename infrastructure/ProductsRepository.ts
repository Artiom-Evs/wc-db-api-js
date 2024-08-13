import { Attribute, VariationAttribute, Category, Image, Product, Variation, ProductPriceCirculation, PriceCirculations } from "../schemas";
import pool from "./DbConnectionPool";
import RepositoryBase from "./RepositoryBase";
import { unserialize } from "php-serialize";
import attributesRepository, { DBProductAttributeTerm, DBVariationAttribute } from "./AttributesRepository";
import categoriesRepository from "./CategoriesRepository";
import imagesRepository, { DBImage, ImageSizes } from "./ImagesRepository";

const GET_ALL_QUERY = `
CALL GetProductsV3(?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
`;

const GET_STATISTIC_QUERY = `
CALL GetProductsStatisticV2(?, ?, ?, ?, ?, ?);
`;

const GET_BY_ID_QUERY = `
CALL GetProductByID(?);
`;

const GET_BY_SLUG_QUERY = `
CALL GetProductBySlug(?);
`;

const createGetProductsByIdsQuery = (ids: number[]) => `
SELECT 
    ID AS id,
    post_title AS name, 
    post_name AS slug, 
    post_content AS description, 
    post_date AS created, 
    post_modified AS modified, 
    CAST(m1.meta_value AS DECIMAL(10, 2)) AS price,
    CAST(m2.meta_value AS INT) AS stock_quantity,
    m3.meta_value AS sku,
    m4.meta_value AS attributes,
    m5.meta_value AS default_attributes,
    m6.meta_value AS price_circulations
FROM wp_posts
LEFT JOIN wp_postmeta AS m1 ON wp_posts.ID = m1.post_id AND m1.meta_key = "_price"
LEFT JOIN wp_postmeta AS m2 ON wp_posts.ID = m2.post_id AND m2.meta_key = "_stock"
LEFT JOIN wp_postmeta AS m3 ON wp_posts.ID = m3.post_id AND m3.meta_key = "_sku"
LEFT JOIN wp_postmeta AS m4 ON wp_posts.ID = m4.post_id AND m4.meta_key = "_product_attributes"
LEFT JOIN wp_postmeta AS m5 ON wp_posts.ID = m5.post_id AND m5.meta_key = "_default_attributes"
LEFT JOIN wp_postmeta AS m6 ON wp_posts.ID = m6.post_id AND m6.meta_key = "_price_circulations"
WHERE ID IN (${ids.map(() => "?").join(", ")})
    AND post_type = "product" 
    AND post_status = "publish"
LIMIT ${ids.length};
`;

const createGetProductsBySlugsQuery = (slugs: string[]) => `
SELECT 
    ID AS id,
    post_title AS name, 
    post_name AS slug, 
    post_content AS description, 
    post_date AS created, 
    post_modified AS modified, 
    CAST(m1.meta_value AS DECIMAL(10, 2)) AS price,
    CAST(m2.meta_value AS INT) AS stock_quantity,
    m3.meta_value AS sku,
    m4.meta_value AS attributes,
    m5.meta_value AS default_attributes,
    m6.meta_value AS price_circulations
FROM wp_posts
LEFT JOIN wp_postmeta AS m1 ON wp_posts.ID = m1.post_id AND m1.meta_key = "_price"
LEFT JOIN wp_postmeta AS m2 ON wp_posts.ID = m2.post_id AND m2.meta_key = "_stock"
LEFT JOIN wp_postmeta AS m3 ON wp_posts.ID = m3.post_id AND m3.meta_key = "_sku"
LEFT JOIN wp_postmeta AS m4 ON wp_posts.ID = m4.post_id AND m4.meta_key = "_product_attributes"
LEFT JOIN wp_postmeta AS m5 ON wp_posts.ID = m5.post_id AND m5.meta_key = "_default_attributes"
LEFT JOIN wp_postmeta AS m6 ON wp_posts.ID = m6.post_id AND m6.meta_key = "_price_circulations"
WHERE post_type = "product" 
    AND post_status = "publish"
    AND post_name IN (${slugs.map(() => "?").join(", ")})
LIMIT ${slugs.length};
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
    CAST(m2.meta_value AS INT) AS stock_quantity,
    m3.meta_value AS sku,
    m4.meta_value AS variation_image_gallery,
    m5.meta_value AS description,
    m6.meta_value AS price_circulations
FROM wp_posts
LEFT JOIN wp_postmeta AS m1 ON wp_posts.ID = m1.post_id AND m1.meta_key = "_price"
LEFT JOIN wp_postmeta AS m2 ON wp_posts.ID = m2.post_id AND m2.meta_key = "_stock"
LEFT JOIN wp_postmeta AS m3 ON wp_posts.ID = m3.post_id AND m3.meta_key = "_sku"
LEFT JOIN wp_postmeta AS m4 ON wp_posts.ID = m4.post_id AND m4.meta_key = "variation_image_gallery"
LEFT JOIN wp_postmeta AS m5 ON wp_posts.ID = m5.post_id AND m5.meta_key = "_variation_description"
LEFT JOIN wp_postmeta AS m6 ON wp_posts.ID = m6.post_id AND m6.meta_key = "_price_circulations"
WHERE post_parent IN (${ids.map(() => "?").join(", ")}) 
    AND post_type = "product_variation" 
    AND post_status = "publish";
`;

const createGetProductsOrVariationsPriceCirculationsQuery = (productOrVariationIds: number[]) => `
SELECT 
    pm.post_id AS product_or_variation_id,
    CAST(pa_stock.meta_value AS INT) AS stock_quantity,
    CAST(pa_price.meta_value AS DECIMAL(10, 2)) AS price,
    pm.meta_value AS price_circulations
FROM wp_postmeta AS pm
LEFT JOIN wp_postmeta AS pa_stock ON pm.post_id = pa_stock.post_id AND pa_stock.meta_key = "_stock"
LEFT JOIN wp_postmeta AS pa_price ON pm.post_id = pa_price.post_id AND pa_price.meta_key = "_price"
WHERE pm.meta_key = "_price_circulations" AND pm.post_id IN (${productOrVariationIds.map(() => "?").join(", ")});
`;

export interface GetProductsOptions {
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

export interface ProductsStatistic {
    products_count: number,
    min_price: number,
    max_price: number
}

interface DbProductOrVariationPriceCirculation {
    product_or_variation_id: number,
    stock_quantity: number,
    price: number,
    price_circulations: PriceCirculations
}

class ProductsRepository extends RepositoryBase {
    public async getProductsStatistic({
        min_price = -1,
        max_price = -1,
        category = "",
        attribute = "",
        attribute_term = "",
        search = ""
    }): Promise<ProductsStatistic> {

        const [[[result]]] = await this._pool.execute<[any[]]>(GET_STATISTIC_QUERY, [
            min_price,
            max_price,
            category,
            attribute,
            attribute_term,
            search
        ]);

        const statistic = result as ProductsStatistic;

        // this parsing is required, because mysql2 returns min_price and max_price fields as a strings
        statistic.min_price = parseFloat(statistic.min_price as any ?? "0");
        statistic.max_price = parseFloat(statistic.max_price as any ?? "0");

        return statistic;
    }

    public async getAll({
        page = 1,
        per_page = 100,
        min_price = -1,
        max_price = -1,
        order_by = "quantity",
        order = "desc",
        category = "",
        attribute = "",
        attribute_term = "",
        search = ""
    }: GetProductsOptions): Promise<Product[]> 
    {
        if (attribute != "" && !attribute.startsWith("pa_"))
            attribute = "pa_" + attribute;

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
        const variations = await this.getProductsVariations(productIds);
        const variationIds = variations.map(v => v.id);
        const images = await imagesRepository.getProductsImages([...productIds, ...variationIds], "medium");
        const variationsImages = await this.getVariationsImages(variations, "medium");

        const globalAttributes: Attribute[] = await attributesRepository.getAll();
        const attributesTerms = await attributesRepository.getProductsAttributeTerms(productIds);
        const variationsAttributes = await attributesRepository.getVariationsAttributes(variationIds);
        const categories = await categoriesRepository.getProductsCategories(productIds);

        products.forEach(product => {
            this.initProductAttributes(product, globalAttributes, attributesTerms);
            this.initProductDefaultAttributes(product, globalAttributes, attributesTerms);

            product.categories = categories.filter(c => c.object_id === product.id) as Category[];
            product.images = images.filter(i => i.parent_id === product.id) as Image[];
            product.variations = variations.filter(v => v.parent_id === product.id);

            product.type = product.variations.length === 0 ? "simple" : "variable";
            product.price = product.price != null ? parseFloat(product.price as any) : null;
            product.stock_quantity = product.stock_quantity != null ? parseInt(product.stock_quantity as any) : null;

            if (product.price_circulations)
                product.price_circulations = unserialize((product as any).price_circulations);
            
            product.variations.forEach(variation => {
                variation.price = variation.price != null ? parseFloat(variation.price as any) : null;
                variation.stock_quantity = variation.stock_quantity != null ? parseInt(variation.stock_quantity as any) : null;
                variation.images = variationsImages.filter(i => (variation as any).variation_image_gallery?.includes(i.id)) as Image[];

                this.initVariationAttributes(variation, globalAttributes, variationsAttributes);
            });
        });

        return products;
    }

    public async GetByIds(ids: number[]): Promise<Product[]> {
        if (ids.length === 0)
            return [];

        const query = createGetProductsByIdsQuery(ids);
        const [rows] = await this._pool.execute<any>(query, ids, );

        const products = rows as Product[];
        const variations = await this.getProductsVariations(ids);
        const variationIds = variations.map(v => v.id);
        const images = await imagesRepository.getProductsImages([...ids, ...variationIds], "medium");
        const variationsImages = await this.getVariationsImages(variations, "medium");

        const globalAttributes: Attribute[] = await attributesRepository.getAll();
        const attributesTerms = await attributesRepository.getProductsAttributeTerms(ids);
        const variationsAttributes = await attributesRepository.getVariationsAttributes(variationIds);
        const categories = await categoriesRepository.getProductsCategories(ids);

        products.forEach(product => {
            this.initProductAttributes(product, globalAttributes, attributesTerms);
            this.initProductDefaultAttributes(product, globalAttributes, attributesTerms);

            product.categories = categories.filter(c => c.object_id === product.id) as Category[];
            product.images = images.filter(i => i.parent_id === product.id) as Image[];
            product.variations = variations.filter(v => v.parent_id === product.id);

            product.type = product.variations.length === 0 ? "simple" : "variable";
            product.price = product.price != null ? parseFloat(product.price as any) : null;
            product.stock_quantity = product.stock_quantity != null ? parseInt(product.stock_quantity as any) : null;

            if (product.price_circulations)
                product.price_circulations = unserialize((product as any).price_circulations);
            
            product.variations.forEach(variation => {
                variation.price = variation.price != null ? parseFloat(variation.price as any) : null;
                variation.stock_quantity = variation.stock_quantity != null ? parseInt(variation.stock_quantity as any) : null;
                variation.images = variationsImages.filter(i => (variation as any).variation_image_gallery?.includes(i.id)) as Image[];

                this.initVariationAttributes(variation, globalAttributes, variationsAttributes);
            });
        });

        return products;
    }

    public async GetBySlugs(slugs: string[]): Promise<Product[]> {
        if (slugs.length === 0)
            return [];

        const query = createGetProductsBySlugsQuery(slugs);
        const [rows] = await this._pool.execute<any>(query, slugs, );

        const products = rows as Product[];
        const productIds = products.map(p => p.id);
        const variations = await this.getProductsVariations(productIds);
        const variationIds = variations.map(v => v.id);
        const images = await imagesRepository.getProductsImages([...productIds, ...variationIds], "medium");
        const variationsImages = await this.getVariationsImages(variations, "medium");

        const globalAttributes: Attribute[] = await attributesRepository.getAll();
        const attributesTerms = await attributesRepository.getProductsAttributeTerms(productIds);
        const variationsAttributes = await attributesRepository.getVariationsAttributes(variationIds);
        const categories = await categoriesRepository.getProductsCategories(productIds);

        products.forEach(product => {
            this.initProductAttributes(product, globalAttributes, attributesTerms);
            this.initProductDefaultAttributes(product, globalAttributes, attributesTerms);

            product.categories = categories.filter(c => c.object_id === product.id) as Category[];
            product.images = images.filter(i => i.parent_id === product.id) as Image[];
            product.variations = variations.filter(v => v.parent_id === product.id);

            product.type = product.variations.length === 0 ? "simple" : "variable";
            product.price = product.price != null ? parseFloat(product.price as any) : null;
            product.stock_quantity = product.stock_quantity != null ? parseInt(product.stock_quantity as any) : null;

            if (product.price_circulations)
                product.price_circulations = unserialize((product as any).price_circulations);
            
            product.variations.forEach(variation => {
                variation.price = variation.price != null ? parseFloat(variation.price as any) : null;
                variation.stock_quantity = variation.stock_quantity != null ? parseInt(variation.stock_quantity as any) : null;
                variation.images = variationsImages.filter(i => (variation as any).variation_image_gallery?.includes(i.id)) as Image[];

                this.initVariationAttributes(variation, globalAttributes, variationsAttributes);
            });
        });

        return products;
    }

    public async getById(id: number): Promise<Product | null> {
        const [[productRows]] = await this._pool.execute<[any[]]>(GET_BY_ID_QUERY, [id]);
        const products = productRows as Product[];
        const product = products && Array.isArray(products) && products.length > 0 ? products[0] : null;

        if (!product)
            return null;

        const variations = await this.getProductsVariations([id]);
        const variationIds = variations.map(v => v.id);
        const images = await imagesRepository.getProductsImages([id, ...variationIds], "large");
        const variationsImages = await this.getVariationsImages(variations, "large");
        const categories = await categoriesRepository.getProductsCategories([id]);

        product.type = variations.length === 0 ? "simple" : "variable";
        product.price = product.price != null ? parseFloat(product.price as any) : null;
        product.stock_quantity = product.stock_quantity != null ? parseInt(product.stock_quantity as any) : null;

        if (product.price_circulations)
            product.price_circulations = unserialize((product as any).price_circulations);
        
        const globalAttributes: Attribute[] = await attributesRepository.getAll();
        const attributesTerms = await attributesRepository.getProductsAttributeTerms([product.id]);
        const variationsAttributes = await attributesRepository.getVariationsAttributes(variationIds);

        this.initProductAttributes(product, globalAttributes, attributesTerms);
        this.initProductDefaultAttributes(product, globalAttributes, attributesTerms);

        product.categories = categories as Category[];
        product.images = images.filter(i => i.parent_id === product.id) as Image[];
        product.variations = variations;

        product.variations.forEach(variation => {
            variation.price = variation.price != null ? parseFloat(variation.price as any) : null;
            variation.stock_quantity = variation.stock_quantity != null ? parseInt(variation.stock_quantity as any) : null;
            variation.images = variationsImages.filter(i => (variation as any).variation_image_gallery?.includes(i.id)) as Image[];

            this.initVariationAttributes(variation, globalAttributes, variationsAttributes);
        });

        return product;
    }

    public async getBySlug(slug: string): Promise<Product | null> {
        const [[productRows]] = await this._pool.execute<[any[]]>(GET_BY_SLUG_QUERY, [slug]);
        const products = productRows as Product[];
        const product = products && Array.isArray(products) && products.length > 0 ? products[0] : null;

        if (!product)
            return null;

const variations = await this.getProductsVariations([product.id]);
        const variationIds = variations.map(v => v.id);
        const images = await imagesRepository.getProductsImages([product.id, ...variationIds], "large");
        const variationsImages = await this.getVariationsImages(variations, "large");
        const categories = await categoriesRepository.getProductsCategories([product.id]);

        product.type = variations.length === 0 ? "simple" : "variable";
        product.price = product.price != null ? parseFloat(product.price as any) : null;
        product.stock_quantity = product.stock_quantity != null ? parseInt(product.stock_quantity as any) : null;

        if (product.price_circulations)
            product.price_circulations = unserialize((product as any).price_circulations);
        
        const globalAttributes: Attribute[] = await attributesRepository.getAll();
        const attributesTerms = await attributesRepository.getProductsAttributeTerms([product.id]);
        const variationsAttributes = await attributesRepository.getVariationsAttributes(variationIds);

        this.initProductAttributes(product, globalAttributes, attributesTerms);
        this.initProductDefaultAttributes(product, globalAttributes, attributesTerms);

        product.categories = categories as Category[];
        product.images = images.filter(i => i.parent_id === product.id) as Image[];
        product.variations = variations;

        product.variations.forEach(variation => {
            variation.price = variation.price != null ? parseFloat(variation.price as any) : null;
            variation.stock_quantity = variation.stock_quantity != null ? parseInt(variation.stock_quantity as any) : null;
            variation.images = variationsImages.filter(i => (variation as any).variation_image_gallery?.includes(i.id)) as Image[];

            this.initVariationAttributes(variation, globalAttributes, variationsAttributes);
        });

        return product;
    }

    private async getProductsVariations(productIds: number[]): Promise<Variation[]> {
        if (productIds.length === 0)
            return [];

        const query = createGetProductsVariationsQuery(productIds);
        const [variationRows] = await this._pool.execute(query, productIds);
        const variations = variationRows as Variation[];

        variations.map(v => {
            if (v.price_circulations)
                v.price_circulations = unserialize((v as any).price_circulations);
        });

        return variations;
    }

    public async getCirculations(productOrVariationIds: number[]): Promise<DbProductOrVariationPriceCirculation[]> {
        const query = createGetProductsOrVariationsPriceCirculationsQuery(productOrVariationIds);
        const [rows] = await this._pool.execute<any[]>(query, productOrVariationIds);

        rows.forEach(row => {
            if (row.price_circulations)
                row.price_circulations = unserialize(row.price_circulations);
            row.price = parseFloat(row.price) ?? null;
        });

        return rows as DbProductOrVariationPriceCirculation[];
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

            // variation and default attributes should have same IDs as related product attributes
            options.forEach(o => o.id = gAttribute.id);

            // list of the product attribute options should be unique
            const uniqueOptions: Map<string, DBProductAttributeTerm> = new Map();
            options.forEach(o => uniqueOptions.set(o.slug, o));

            return {
                id: gAttribute.id,
                name: gAttribute.name,
                slug: gAttribute.slug,
                visible: !!a.is_visible,
                variation: !!a.is_variation,
                options: [...uniqueOptions.values()]
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

    private async getVariationsImages(variations: Variation[], targetSize: ImageSizes): Promise<DBImage[]> {
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

        const images = imagesRepository.getImagesByIds(imageIds, targetSize);
        return images;
    }
}

const productsRepository = new ProductsRepository(pool);
export default productsRepository;
