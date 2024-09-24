import { Routing } from "express-zod-api";
import { GetRootEndpoint } from "./endpoints/GetRootEndpoint";
import { GetAttributeEndpoint } from "./endpoints/GetAttributeEndpoint";
import { GetAttributesEndpoint } from "./endpoints/GetAttributesEndpoint";
import { GetAttributeTermsEndpoint } from "./endpoints/GetAttributeTermsEndpoint";
import { GetCategoryEndpoint } from "./endpoints/GetCategoryEndpoint";
import { GetCategoriesEndpoint } from "./endpoints/GetCategoriesEndpoint";
import { GetProductEndpoint } from "./endpoints/GetProductEndpoint";
import { GetProductsEndpoint } from "./endpoints/GetProductsEndpoint";
import { GetProductBySlugEndpoint } from "./endpoints/GetProductBySlugEndpoint";
import { GetCategoryBySlugEndpoint } from "./endpoints/GetCategoryBySlugEndpoint";
import { GetAttributeBySlugEndpoint } from "./endpoints/GetAttributeBySlugEndpoint";
import { GetAttributeTermsBySlugEndpoint } from "./endpoints/GetAttributeTermsBySlugEndpoint copy";
import { GetPagesEndpoint } from "./endpoints/GetPagesEndpoint";
import { GetPageBySlugEndpoint } from "./endpoints/GetPageBySlugEndpoint";
import { GetMenuItemsByMenuIdEndpoint } from "./endpoints/GetMenuItemsByMenuIdEndpoint";
import { GetMenuItemsEndpoint } from "./endpoints/GetMenuItemsEndpoint";
import { GetPostsEndpoint } from "./endpoints/GetPostsEndpoint";
import { GetPostBySlugEndpoint } from "./endpoints/GetPostBySlugEndpoint";
import { PostGetProductsCirculationsEndpoint } from "./endpoints/PostGetProductsCirculationsEndpoint";
import { PostGetMinimizedProductsEndpoint } from "./endpoints/PostGetMinimizedProductsEndpoint";

export const appRouting: Routing = {
    api: {
        v1: {
            products: {
                ":id": GetProductEndpoint,
                "": GetProductsEndpoint
            },
            categories: {
                ":id": GetCategoryEndpoint,
                "": GetCategoriesEndpoint
            },
            attributes: {
                ":id": {
                    terms: GetAttributeTermsEndpoint,
                    "": GetAttributeEndpoint
                },
                "": GetAttributesEndpoint
            }
        },
        v2: {
            products: {
                minimized: PostGetMinimizedProductsEndpoint,
                circulations: PostGetProductsCirculationsEndpoint,
                ":slug": GetProductBySlugEndpoint,
                "": GetProductsEndpoint
            },
            categories: {
                ":slug": GetCategoryBySlugEndpoint,
                "": GetCategoriesEndpoint
            },
            attributes: {
                ":slug": {
                    terms: GetAttributeTermsBySlugEndpoint,
                    "": GetAttributeBySlugEndpoint
                },
                "": GetAttributesEndpoint
            },
            pages: {
                ":slug": GetPageBySlugEndpoint,
                "": GetPagesEndpoint
            },
            "menu-items": {
                "": GetMenuItemsEndpoint,
                ":id": GetMenuItemsByMenuIdEndpoint
            },
            posts: {
                ":slug": GetPostBySlugEndpoint,
                "": GetPostsEndpoint
            }
        }
    },
    "": GetRootEndpoint
};
