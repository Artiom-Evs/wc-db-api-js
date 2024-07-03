import { Category, PageInfo } from "../schemas";
import pool from "./DbConnectionPool";
import RepositoryBase from "./RepositoryBase";

const GET_ALL_QUERY = `
select ID AS id, post_author AS author, post_content AS content, post_title AS title, post_status AS status, post_name AS slug, post_parent AS parent, menu_order, post_type AS type
from wp_posts
where post_type = "page";
`;

const GET_BY_SLUG_QUERY = `
select ID AS id, post_author AS author, post_content AS content, post_title AS title, post_status AS status, post_name AS slug, post_parent AS parent, menu_order, post_type AS type
from wp_posts
where post_type = "page"
    AND post_name = ?
LIMIT 1;
`;

class PagesRepository extends RepositoryBase {
    public async getAll(): Promise<PageInfo[]> {
        const [rows] = await this._pool.execute<any[]>(GET_ALL_QUERY, []);
        const pages = rows as PageInfo[];

        pages.forEach(p => {
            p.meta = [];
        });

        return pages;
    }

    public async getBySlug(slug: string): Promise<PageInfo | null> {
        const [[row]] = await this._pool.execute<any[]>(GET_BY_SLUG_QUERY, [slug]);
        const page = row as PageInfo ?? null;

        if (page)
            page.meta = [];

        return page;
    }
}

const pagesRepository = new PagesRepository(pool);
export default pagesRepository;
