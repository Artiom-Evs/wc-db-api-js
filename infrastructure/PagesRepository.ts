import { PageInfo } from "../schemas";
import pool from "./DbConnectionPool";
import seoDataRepository from "./SeoDataRepository";
import RepositoryBase from "./RepositoryBase";

const GET_ALL_QUERY = `
select ID AS id, post_author AS author, post_content AS content, post_title AS title, post_status AS status, post_name AS slug, post_parent AS parent, menu_order, post_type AS type,
    m1.meta_value AS sections
from wp_posts
LEFT JOIN wp_postmeta AS m1 ON wp_posts.ID = m1.post_id AND m1.meta_key = "sections_json"
where post_type = "page" AND post_status = "publish";
`;

const GET_BY_SLUG_QUERY = `
select ID AS id, post_author AS author, post_content AS content, post_title AS title, post_status AS status, post_name AS slug, post_parent AS parent, menu_order, post_type AS type,
    m1.meta_value AS sections
from wp_posts
LEFT JOIN wp_postmeta AS m1 ON wp_posts.ID = m1.post_id AND m1.meta_key = "sections_json"
where post_type = "page" AND post_status = "publish"
    AND post_name = ?
LIMIT 1;
`;

class PagesRepository extends RepositoryBase {
    public async getAll(): Promise<PageInfo[]> {
        const [rows] = await this._pool.execute<any[]>(GET_ALL_QUERY, []);
        const pages = rows as PageInfo[];
        const postsSeoData = await seoDataRepository.getPostsData(pages?.map(p => p.id) ?? []);

        pages.forEach(page => {
            page.sections = page.sections ? JSON.parse(page.sections as any) : [];
            page.seo_data = postsSeoData.find(psd => psd.post_id === page.id) ?? null;
        });

        return pages;
    }

    public async getBySlug(slug: string): Promise<PageInfo | null> {
        const [[row]] = await this._pool.execute<any[]>(GET_BY_SLUG_QUERY, [slug]);
        const page = row as PageInfo ?? null;

        if (!page)
            return null;

        page.sections = page.sections ? JSON.parse(page.sections as any) : [];
        page.seo_data = await seoDataRepository.getPostData(page.id);

        return page;
    }
}

const pagesRepository = new PagesRepository(pool);
export default pagesRepository;
