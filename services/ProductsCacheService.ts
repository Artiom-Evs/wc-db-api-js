import { isNumber } from "util";
import redis from "../infrastructure/RedisConnection";
import { MinimizedProduct, Product, ProductAttribute, ProductsStatistic, VariationAttribute } from "../schemas";
import { SchemaFieldTypes, SearchOptions } from "redis";

const INDEX_NAME = "idx:products";

interface StatisticResultItem {
    price: number;
    attributes: ProductAttribute[];
    "$.price": string;
    "$.attributes": string;
}

export interface GetCachedProductsOptions {
    page?: number,
    per_page?: number,
    order_by?: "date" | "price" | "quantity" | "name",
    order?: "asc" | "desc",
    min_price?: number,
    max_price?: number,
    category?: string,
    pa_supplier?: string[],
    pa_color?: string[],
    pa_base_color?: string[],
    pa_size?: string[],
    search?: string
}

// escapes special characters in the given string to correct inserting into RediSearch queries as a parameter
function escapeParam(param: string): string {
    const escapedParam = param.replace(/[-@|(){}[\]"~*^$:;,]/g, '\\$&');
    return escapedParam;
}

class ProductsCacheService {
    public async initialize(): Promise<void> {
        const indexes = await redis.ft._list();

        // TODO: estimate the time spent on recreating the index on a real data
        if (indexes.includes(INDEX_NAME))
            await redis.ft.dropIndex(INDEX_NAME);

        await redis.ft.create(INDEX_NAME, {
            "$.id": {
                type: SchemaFieldTypes.NUMERIC,
                SORTABLE: false,
                AS: "id"
            },
            "$.slug": {
                type: SchemaFieldTypes.TAG,
                AS: "slug"
            },
            "$.sku": {
                type: SchemaFieldTypes.TEXT,
                AS: "sku"
            },
            "$.name": {
                type: SchemaFieldTypes.TEXT,
                AS: "name"
            },
            "$.created": {
                type: SchemaFieldTypes.TAG,
                AS: "created"
            },
            "$.modified": {
                type: SchemaFieldTypes.TAG,
                AS: "modified"
            },
            "$.stock_quantity": {
                type: SchemaFieldTypes.NUMERIC,
                sortable: true,
                AS: "stock_quantity"
            },
            "$.price": {
                type: SchemaFieldTypes.NUMERIC,
                sortable: true,
                AS: "price"
            },
            "$.categories[*].slug": {
                type: SchemaFieldTypes.TAG,
                SORTABLE: true,
                AS: "categories"
            },
            "$.attributes[*].slug": {
                type: SchemaFieldTypes.TAG,
                SORTABLE: true,
                AS: "attributes"
            },
            "$.attributes[*].options[*].slug": {
                type: SchemaFieldTypes.TAG,
                SORTABLE: true,
                AS: "attributes_options"
            },
        }, {
            ON: "JSON",
            PREFIX: "product:",
        });
    }

    public async setProduct(product: Product): Promise<void> {
        await redis.json.set(`product:${product.id}`, "$", product);
    }

    public async setProducts(products: Product[]): Promise<void> {
        for (const product of products)
            await this.setProduct(product);
    }

    // getting products and statisting makes in one method to maximize performance
    public async getProductsWithStatistic(options: GetCachedProductsOptions): Promise<[products: Product[], statistic: ProductsStatistic]> {
        const productsQuery = this.buildRedisearchQuery(options);
        const productsSearchOptions = this.buildRedisearchOptions(options);

        const statisticQuery = this.buildRedisearchStatisticQuery(options);
        const statisticSearchOptions = {
            RETURN: ["$.price", "$.attributes"],
            // to get all results
            // 10000 is the maximum value for the LIMIT size with default configuration
            LIMIT: { from: 0, size: 10000 }
        };

        const productsTask = redis.ft.search(INDEX_NAME, productsQuery, productsSearchOptions);
        const statisticTask = redis.ft.search(INDEX_NAME, statisticQuery, statisticSearchOptions);
        const [productsResult, statisticResult] = await Promise.all([productsTask, statisticTask]);
        
        const products = productsResult.documents.map(d => d.value) as any as Product[];
        const products_count = productsResult.total;

        const statisticItems = statisticResult.documents.map(d => d.value) as any as StatisticResultItem[];

        // when RETURN option used, then selected fields are returned as strings
        statisticItems.forEach(item => {
            item.price = parseFloat(item["$.price"]);
            item.attributes = JSON.parse(item["$.attributes"]);
        });

        const filteredByPrice = statisticItems.filter(this.filterByPrice(options));
        const filteredByAttributes = statisticItems.filter(this.filterByAttributes(options));

        const attributes = this.getAttributesStatistic(filteredByPrice);
        const [min_price, max_price] = this.getMinAndMaxPrice(filteredByAttributes);

        const statistic = { products_count, min_price, max_price, attributes };

        return [products, statistic];
    }

    public async getProductsCount(): Promise<number> {
        const result = await redis.ft.search(INDEX_NAME, "*", { RETURN: ["id"] });
        return result.total;
    }

    public async getProductsByIds(productIds: number[]): Promise<Product[]> {
        if (productIds.length === 0)
            return [];

        const query = "(    " + productIds.map(id => `@id:[${id} ${id}]`).join(" | ") + ")";
        const options = { LIMIT: { from: 0, size: productIds.length } };
        const result = await redis.ft.search(INDEX_NAME, query, options);
        const products = result.documents.map(d => d.value) as any as Product[];

        return products;
    }

    public async getProductsBySlugs(slugs: string[]): Promise<Product[]> {
        if (slugs.length === 0)
            return [];

        const slugOptions = slugs.map(s => escapeParam(s)).join("|");
        const query = `@slug:{${slugOptions}}`;
        const options = { LIMIT: { from: 0, size: slugs.length } };
        const result = await redis.ft.search(INDEX_NAME, query, options);
        const products = result.documents.map(d => d.value) as any as Product[];

        return products;
    }

    public async getProductBySlug(slug: string): Promise<Product | null> {
        const query = `@slug:{${escapeParam(slug)}}`;
        const options = { LIMIT: { from: 0, size: 1 } };
        const result = await redis.ft.search(INDEX_NAME, query, options);
        const product = result.documents[0]?.value as any as Product ?? null;

        return product;
    }

    public async getProductById(id: number): Promise<Product | null> {
        const query = `@id:[${id} ${id}]`;
        const options = { LIMIT: { from: 0, size: 1 } };
        const result = await redis.ft.search(INDEX_NAME, query, options);
        const product = result.documents[0]?.value as any as Product ?? null;

        return product;
    }

    public async getMinimizedProducts(items: { product_id: number, variation_id?: number }[]): Promise<MinimizedProduct[]> {
        if (items.length === 0)
            return [];

        const tasks = items.map(async (item) => {
            const product = await this.getProductById(item.product_id);

            if (!product)
                return null;

            const variation = product.variations.find(v => v.id === item.variation_id);

            if (variation) {
                return {
                    id: variation.id,
                    parent_id: product.id,
                    sku: variation.sku,
                    slug: variation.slug,
                    name: variation.name,
                    stock_quantity: variation.stock_quantity,
                    price: variation.price,
                    price_circulations: variation.price_circulations,
                    image: variation.images[0],
                    attributes: variation.attributes
                } as MinimizedProduct;
            }
            else {
                const attributes: VariationAttribute[] = product.default_attributes.length > 0
                    ? product.default_attributes
                    : product.attributes.map(a => ({
                        id: a.id,
                        name: a.name,
                        slug: a.slug,
                        option: a.options[0].slug
                    }));

                return {
                    id: product.id,
                    parent_id: 0,
                    name: product.name,
                    slug: product.slug,
                    sku: product.sku,
                    stock_quantity: product.stock_quantity,
                    price: product.price,
                    price_circulations: product.price_circulations,
                    image: product.images[0],
                    attributes
                } as MinimizedProduct;
            }
        });

        const results = await Promise.all(tasks);
        const minimizedProducts = results.filter(p => p !== null) as MinimizedProduct[];

        return minimizedProducts;
    }

    private buildRedisearchQuery(options: GetCachedProductsOptions): string {
        const queryFilters: string[] = [
            options.category ? `@categories:{${escapeParam(options.category)}}` : "",
            isNumber(options.min_price) || isNumber(options.max_price) ? `@price:[${options.min_price ?? "-inf"} ${options.max_price ?? "+inf"}]` : "",
            options.pa_supplier ? `(@attributes:{supplier} and @attributes_options:{${options.pa_supplier.map(o => escapeParam(o)).join("|")}})` : "",
            options.pa_color ? `(@attributes:{color} and @attributes_options:{${options.pa_color.map(o => escapeParam(o)).join("|")}})` : "",
            options.pa_base_color ? `(@attributes:{base_color} and @attributes_options:{${options.pa_base_color.map(o => escapeParam(o)).join("|")}})` : "",
            options.pa_size ? `(@attributes:{size} and @attributes_options:{${options.pa_size.map(o => escapeParam(o)).join("|")}})` : "",
            (options.search && options.search.length >= 2) ? `@sku|name:'*${escapeParam(options.search)}*'` : ""
        ];

        const query = queryFilters.filter(f => f).join(" AND ") || "*";

        return query;
    }
    
    // use only category and search filters
    private buildRedisearchStatisticQuery(options: GetCachedProductsOptions): string {
        const queryFilters: string[] = [
            options.category ? `@categories:{${escapeParam(options.category)}}` : "",
            (options.search && options.search.length >= 2) ? `@sku|name:'*${escapeParam(options.search)}*'` : ""
        ];

        const query = queryFilters.filter(f => f).join(" AND ") || "*";

        return query;
    }

    private buildRedisearchOptions(options: GetCachedProductsOptions): SearchOptions {
        const page = options.page ?? 1;
        const perPage = options.per_page ?? 100;
        const direction = options.order === "asc" ? "ASC" : "DESC";
        let orderBy: string = options.order_by ?? "date";

        if (orderBy === "quantity")
            orderBy = "stock_quantity";
        else if (orderBy === "date")
            orderBy = "created";

        const searchOptions: SearchOptions = {
            LIMIT: {
                from: (page - 1) * perPage,
                size: perPage
            },
            SORTBY: {
                BY: orderBy,
                DIRECTION: direction
            }
        };

        return searchOptions;
    }

    private filterByAttributes(options: GetCachedProductsOptions): (p: StatisticResultItem) => boolean {
        const { pa_supplier, pa_color, pa_base_color, pa_size } = options;

        return (p) =>
            (!pa_supplier || p.attributes.some(a => a.slug === "supplier" && pa_supplier.includes(a.slug)))
            && (!pa_color || p.attributes.some(a => a.slug === "color" && pa_color.includes(a.slug)))
            && (!pa_base_color || p.attributes.some(a => a.slug === "base_color" && pa_base_color.includes(a.slug)))
            && (!pa_size || p.attributes.some(a => a.slug === "size" && pa_size.includes(a.slug)));
    }

    private filterByPrice(options: GetCachedProductsOptions): (p: StatisticResultItem) => boolean {
        return (p) =>
            (!options.min_price || p.price >= options.min_price)
            && (!options.max_price || p.price <= options.max_price);
    }

    private getAttributesStatistic(items: StatisticResultItem[]): ProductAttribute[] {
        const attributes: ProductAttribute[] = [];

        items.forEach(item => {
            item.attributes.forEach(attribute => {
                const existingAttribute = attributes.find(a => a.slug === attribute.slug);
                if (existingAttribute) {
                    attribute.options.forEach(option => {
                        if (!existingAttribute.options.some(o => o.slug === option.slug))
                            existingAttribute.options.push(option);
                    });
                } else {
                    attributes.push(attribute);
                }
            });
        });

        return attributes;
    }

    private getMinAndMaxPrice(items: StatisticResultItem[]): [min: number, max: number] {
        let min = items[0]?.price ?? 0;
        let max = items[0]?.price ?? 0;

        items.forEach(item => {
            if (item.price < min)
                min = item.price;
            if (item.price > max)
                max = item.price;
        });

        return [min, max];
    }
}

const productsCache = new ProductsCacheService();
export default productsCache;
