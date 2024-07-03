import { Category, PageInfo } from "../schemas";
import pool from "./DbConnectionPool";
import RepositoryBase from "./RepositoryBase";

const GET_ALL_QUERY = `
select ID AS id, post_author AS author, post_content AS content, post_title AS title, post_status AS status, post_name AS slug, post_parent AS parent, menu_order, post_type AS type
from wp_posts
where post_type = "page";
`;
class PagesRepository extends RepositoryBase {
    public async getAll(): Promise<PageInfo[]> {
        const [rows] = await this._pool.execute<any[]>(GET_ALL_QUERY, []);
        console.debug("PAGES:", rows);
        const pages = rows as PageInfo[];

        pages.forEach(p => {
            p.meta = [];
        });

        return pages;
    }
}

const pagesRepository = new PagesRepository(pool);
export default pagesRepository;
