import { Post } from "../schemas";
import categoriesRepository from "./CategoriesRepository";
import pool from "./DbConnectionPool";
import RepositoryBase from "./RepositoryBase";

const GET_ALL_QUERY = `
select ID AS id, post_author AS author, post_content AS content, post_title AS title, post_excerpt AS excerpt, post_status AS status, post_name AS slug, post_parent AS parent, menu_order, post_type AS type
from wp_posts
where post_type = "post" AND post_name != "";
`;

const GET_BY_SLUG_QUERY = `
select ID AS id, post_author AS author, post_content AS content, post_title AS title, post_excerpt AS excerpt, post_status AS status, post_name AS slug, post_parent AS parent, menu_order, post_type AS type
from wp_posts
where post_type = "post"
    AND post_name = ?
LIMIT 1;
`;

class PostsRepository extends RepositoryBase {
    public async getAll(): Promise<Post[]> {
        const [rows] = await this._pool.execute<any[]>(GET_ALL_QUERY, []);
        const posts = rows as Post[];

        const postIds = posts.map(p => p.id);
        const categories = await categoriesRepository.getPostsCategories(postIds);

        posts.forEach(post => {
            post.categories = categories.filter(c => c.object_id == post.id);
        });

        return posts;
    }

    public async getBySlug(slug: string): Promise<Post | null> {
        const [[row]] = await this._pool.execute<any[]>(GET_BY_SLUG_QUERY, [slug]);
        const post = row as Post ?? null;

        if (!post)
            return null;

        const categories = await categoriesRepository.getPostsCategories([post.id]);
        post.categories = categories;

        return post;
    }
}

const postsRepository = new PostsRepository(pool);
export default postsRepository;
