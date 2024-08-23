import pool from "./DbConnectionPool";
import { Attribute, AttributeTerm, Product, ProductAttribute, ProductsStatistic } from "schemas";
import RepositoryBase from "./RepositoryBase";
import productsCache, { ProductCacheItem } from "../services/ProductsCache";

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

class ProductsCachedRepository extends RepositoryBase {
    public async getAll({
        page = 1,
        per_page = 100,
        min_price = -1,
        max_price = -1,
        order_by = "quantity",
        order = "desc",
        category = "",
        pa_supplier,
        pa_color,
        pa_base_color,
        pa_size,
        search
    }: GetCachedProductsOptions): Promise<Product[]>
    {
        const products = (await productsCache.GetProducts())
            .filter(p => !category || p.product.categories.some(c => c.slug === category))
            .filter(p => min_price === -1 || (p.product.price && p.product.price >= min_price))
            .filter(p => max_price === -1 || (p.product.price && p.product.price < max_price))
            .filter(this.filterByAttribute(pa_supplier, pa_color, pa_base_color, pa_size))
            .filter(p => !search || p.product.sku.toLowerCase().indexOf(search) > -1 || p.product.name.toLowerCase().indexOf(search) > -1 || p.product.variations.some(v => v.sku.toLowerCase().indexOf(search) > -1 || v.name.toLowerCase().indexOf(search) > -1))
            .sort(this.getSorter(order_by, order))
            .slice(per_page * (page - 1), per_page * page)
            .map(item => item.product);
        
        return products;
    }

    public async getStatistic({
        min_price = -1,
        max_price = -1,
        category,
        pa_supplier,
        pa_color,
        pa_base_color,
        pa_size,
        search
    }: GetCachedProductsOptions): Promise<ProductsStatistic> 
    {
        const generalFilter = (products: ProductCacheItem[]) => products
            .filter(p => !category || p.product.categories.some(c => c.slug === category))
            .filter(p => !search || p.product.sku.toLowerCase().indexOf(search) > -1 || p.product.name.toLowerCase().indexOf(search) > -1 || p.product.variations.some(v => v.sku.toLowerCase().indexOf(search) > -1 || v.name.toLowerCase().indexOf(search) > -1));
        const attributeFilter = (products: ProductCacheItem[]) => products
        .filter(this.filterByAttribute(pa_supplier, pa_color, pa_base_color, pa_size));
        const priceFilter = (products: ProductCacheItem[]) => products
            .filter(p => min_price === -1 || (p.product.price && p.product.price >= min_price))
            .filter(p => max_price === -1 || (p.product.price && p.product.price < max_price))
        
        const products = generalFilter((await productsCache.GetProducts()));
        const products_count = attributeFilter(priceFilter(products)).length;
        const [min, max] = this.getMinAndMaxPrice(attributeFilter(products));
        const attributes = this.getAttributesStatistic(priceFilter(products));
        
        return {
            products_count,
            min_price: min,
            max_price: max,
            attributes
        };
    }

    private getAttributesStatistic(products: ProductCacheItem[]): ProductAttribute[] {
        const attributes: ProductAttribute[] = [];
        const termsMap: Map<number, Map<string, AttributeTerm>> = new Map();

        products.forEach(prod => {
            prod.product.attributes.forEach(attr => {
                if (!termsMap.has(attr.id)) {
                    attributes.push(attr);
                    termsMap.set(attr.id, new Map());
                }

                const attrTermsMap = termsMap.get(attr.id);
                attr.options.forEach(term => {
                    if (attrTermsMap  && !attrTermsMap.has(term.slug))
                        attrTermsMap.set(term.slug, term);
                });
            });
        });

        attributes.forEach(attr => {
            const terms = termsMap.get(attr.id)?.values() ?? [];
            attr.options = [...terms];
        });
        
        return attributes;
    }

    private getSorter(orderBy: string, direction: "asc" | "desc"): (a: ProductCacheItem, b: ProductCacheItem) => number {
        switch (orderBy) {
            case "quantity": 
                return direction === "asc" 
                    ? (a, b) => (a.product.stock_quantity ?? 0) - (b.product.stock_quantity ?? 0)
                    : (a, b) => (b.product.stock_quantity ?? 0) - (a.product.stock_quantity ?? 0);
            case "price": 
                return direction === "asc" 
                    ? (a, b) => (a.product.price ?? 0) - (b.product.price ?? 0)
                    : (a, b) => (b.product.price ?? 0) - (a.product.price ?? 0);
            case "name":
                return direction === "asc" 
                    ? (a, b) => a.product.name.localeCompare(b.product.name, undefined, { sensitivity: "base" })
                    : (a, b) => b.product.name.localeCompare(a.product.name, undefined, { sensitivity: "base" });
            default:
                return direction === "asc" 
                    ? (a, b) => (a.product.stock_quantity ?? 0) - (b.product.stock_quantity ?? 0)
                    : (a, b) => (b.product.stock_quantity ?? 0) - (a.product.stock_quantity ?? 0);
        }
    }

    private getMinAndMaxPrice(products: ProductCacheItem[]): [min: number, max: number] {
        let min = 1000000000;
        let max = 0;

        if (products.length === 0)
            return [0, 0];

        products.forEach(product => {
            if (product.product.price && product.product.price < min)
                min = product.product.price;
            if (product.product.price && product.product.price > max)
                max = product.product.price;

            product.product.variations.forEach(variation => {
                if (variation.price && variation.price < min)
                    min = variation.price;
                if (variation.price && variation.price > max)
                    max = variation.price;
            })
        });

        return [min, max];
    }

    private filterByAttribute(pa_supplier: string[] | undefined, pa_color: string[] | undefined, pa_base_color: string[] | undefined, pa_size: string[] | undefined): (p: ProductCacheItem) => boolean {
        const multipleInclude = (slug: string, options: string[] | undefined) =>
            !options || options.some(o => slug.indexOf(o) > -1);

        return (p) =>
        (!pa_supplier || p.product.attributes.some(a => a.slug === "supplier" && (pa_supplier.length === 0 || a.options.some(o => multipleInclude(o.slug, pa_supplier)))))
        && (!pa_color || p.product.attributes.some(a => a.slug === "color" && (pa_color.length === 0 || a.options.some(o => multipleInclude(o.slug, pa_color)))))
        && (!pa_base_color || p.product.attributes.some(a => a.slug === "base_color" && (pa_base_color.length === 0 || a.options.some(o => multipleInclude(o.slug, pa_base_color))))
        && (!pa_size || p.product.attributes.some(a => a.slug === "size" && (pa_size.length === 0 || a.options.some(o => multipleInclude(o.slug, pa_size))))));

        
    }
}

const productsCachedRepository = new ProductsCachedRepository(pool);
export default productsCachedRepository;
