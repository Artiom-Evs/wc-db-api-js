import { z } from "zod";
import { defaultEndpointsFactory } from "express-zod-api";
import { Post, PostSchema } from "../schemas";
import postsRepository from "../infrastructure/PostsRepository";

export const GetPostBySlugEndpoint = defaultEndpointsFactory.build({
    method: "get",
    input: z.object({
        slug: z.string()
    }),
    output: z.object({
        item: PostSchema.nullable()
    }),
    handler: async ({ input, options, logger }) => {
        logger.debug("Requested parameters:", input);

        const post = await postsRepository.getBySlug(input.slug);

        return { item: post };
    },
});
