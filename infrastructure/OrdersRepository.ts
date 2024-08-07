import RepositoryBase from "./RepositoryBase";
import pool from "./DbConnectionPool";
import { OrderItemPriceCirculation } from "../schemas";
import { unserialize } from "php-serialize";

const GET_ORDER_ITEMS_PRICE_CIRCULATIONS_QUERY = `
SELECT op.product_id, op.variation_id, pm.meta_value AS price_circulations
FROM wp_wc_order_product_lookup AS op
left JOIN wp_postmeta AS pm ON pm.meta_key = "_price_circulations" AND ((op.variation_id = 0 AND op.product_id = pm.post_id) OR (op.variation_id != 0 AND op.variation_id = pm.post_id))
where op.order_id = ?;
`;

class OrdersRepository extends RepositoryBase {
    public async getOrderCirculations(orderId: number): Promise<OrderItemPriceCirculation[]>{
        const [rows] = await this._pool.execute<any[]>(GET_ORDER_ITEMS_PRICE_CIRCULATIONS_QUERY, [orderId]);

        rows.forEach(row => {
            if (row.price_circulations)
                row.price_circulations = unserialize(row.price_circulations);
        });
        
        return rows as OrderItemPriceCirculation[];
    }
}

const ordersRepository = new OrdersRepository(pool);
export default ordersRepository;
