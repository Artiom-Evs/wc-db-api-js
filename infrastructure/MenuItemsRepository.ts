import { MenuItem } from "../schemas";
import pool from "./DbConnectionPool";
import RepositoryBase from "./RepositoryBase";

const GET_ITEMS_BY_MENU_ID_QUERY = `
SELECT 
    p.post_title AS title,
    p.menu_order,
    m1.meta_value AS type,
    m2.meta_value AS parent_id,
    m3.meta_value AS url,
    m4.meta_value AS is_button,
    m5.meta_value AS fa_icon_code
FROM wp_posts AS p
LEFT JOIN wp_postmeta AS m1 ON p.ID = m1.post_id AND m1.meta_key = "_menu_item_type"
LEFT JOIN wp_postmeta AS m2 ON p.ID = m2.post_id AND m2.meta_key = "_menu_item_menu_item_parent"
LEFT JOIN wp_postmeta AS m3 ON p.ID = m3.post_id AND m3.meta_key = "_menu_item_url"
LEFT JOIN wp_postmeta AS m4 ON p.ID = m4.post_id AND m4.meta_key = "_is_button"
LEFT JOIN wp_postmeta AS m5 ON p.ID = m5.post_id AND m5.meta_key = "_fa_icon_code"
WHERE post_type = "nav_menu_item" AND ID IN
    (SELECT object_id
    FROM wp_term_relationships
    WHERE term_taxonomy_id = 
        (SELECT term_taxonomy_id
        FROM wp_term_taxonomy
        WHERE taxonomy = "nav_menu" AND term_id = ?
        LIMIT 1))
`;

class MenuItemsRepository extends RepositoryBase {
    public async getByMenuId(id: number): Promise<MenuItem[]> {
        const [rows] = await this._pool.execute<any[]>(GET_ITEMS_BY_MENU_ID_QUERY, [id]);
        const items = rows as MenuItem[];

        items.forEach(i => {
            i.parent_id = parseInt(i.parent_id as any ?? "0");
            i.url = i.url ?? "";
            i.is_button = i.is_button as any == "yes";
            i.fa_icon_code = i.fa_icon_code ?? "";
        });
        
        return items;
    }
}

const menuItemsRepository = new MenuItemsRepository(pool);
export default menuItemsRepository;
