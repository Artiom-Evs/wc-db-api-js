import { Post } from "../schemas";
import pool from "./DbConnectionPool";
import RepositoryBase from "./RepositoryBase";

const GET_ALL_QUERY = `
select ID AS id, post_author AS author, post_content AS content, post_title AS title, post_excerpt AS excerpt, post_status AS status, post_name AS slug, post_parent AS parent, menu_order, post_type AS type
from wp_posts
where post_type = "post";
`;
class PostsRepository extends RepositoryBase {
    public async getAll(): Promise<Post[]> {
        const [rows] = await this._pool.execute<any[]>(GET_ALL_QUERY, []);
        const posts = rows as Post[];
        return posts;
    }
}

const postsRepository = new PostsRepository(pool);
export default postsRepository;
