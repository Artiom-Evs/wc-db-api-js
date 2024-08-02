import pool from "./DbConnectionPool";
import { Product, ProductsStatistic } from "schemas";
import RepositoryBase from "./RepositoryBase";
import { GetProductsOptions } from "./ProductsRepository";
import productsCache, { ProductCacheItem } from "../services/ProductsCache";

class ProductsCachedRepository extends RepositoryBase {
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
        const products = (await productsCache.GetProducts())
            .filter(p => category === "" || p.product.categories.some(c => c.slug === category))
            .filter(p => min_price === -1 || (p.product.price && p.product.price >= min_price))
            .filter(p => max_price === -1 || (p.product.price && p.product.price < max_price))
            .filter(this.filterByAttribute(attribute, attribute_term))
            .filter(p => search === "" || p.product.sku.indexOf(search) > -1 || p.product.name.indexOf(search) > -1)
            .sort(this.getSorter(order_by, order))
            .slice(per_page * (page - 1), per_page * page)
            .map(item => item.product);
        
        return products;
    }

    public async getStatistic({
        min_price = -1,
        max_price = -1,
        category = "",
        attribute = "",
        attribute_term = "",
        search = ""
    }): Promise<ProductsStatistic> 
    {
        const products = (await productsCache.GetProducts())
        .filter(p => category === "" || p.product.categories.some(c => c.slug === category))
            .filter(p => min_price === -1 || (p.product.price && p.product.price >= min_price))
            .filter(p => max_price === -1 || (p.product.price && p.product.price < max_price))
            .filter(this.filterByAttribute(attribute, attribute_term))
            .filter(p => search === "" || p.product.sku.indexOf(search) > -1 || p.product.name.indexOf(search) > -1);
            
        const [min, max] = this.getMinAndMaxPrice(products);
        
        return {
            products_count: products.length,
            min_price: min,
            max_price: max
        };
    }

    private getSorter(orderBy: string, direction: "asc" | "desc"): (a: ProductCacheItem, b: ProductCacheItem) => number {
        switch (orderBy) {
            case "stock": 
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
                    ? (a, b) => a.created - b.created
                    : (a, b) => b.created - a.created;
        }
    }

    private async updateStocks(products: Product[]): Promise<void> {

    }

    private getMinAndMaxPrice(products: ProductCacheItem[]): [min: number, max: number] {
        let min = 1000000000;
        let max = 0;

        products.forEach(product => {
            product.product.variations.forEach(variation => {
                if (variation.price && variation.price < min)
                    min = variation.price;
                if (variation.price && variation.price > max)
                    max = variation.price;
            })
        });

        return [min, max];
    }

    private filterByAttribute(attribute: string, attribute_term: string): (p: ProductCacheItem) => boolean {
        return (p: ProductCacheItem) => {
            if (attribute === "" && attribute_term === "")
                return true;

            const existedAttribute = p.product.attributes.find(a => a.slug === attribute);

            if (!existedAttribute)
                return false;
            else if (attribute_term === "")
                return true;
            else 
            return existedAttribute.options.some(o => o.slug.indexOf(attribute_term) > -1);
        }
    }
}

const productsCachedRepository = new ProductsCachedRepository(pool);
export default productsCachedRepository;
