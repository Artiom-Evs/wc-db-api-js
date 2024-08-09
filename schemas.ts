import { ez } from "express-zod-api";
import { z } from "zod";

export type Product = z.infer<typeof ProductSchema>;
export type Variation = z.infer<typeof VariationSchema>;
export type Image = z.infer<typeof ImageSchema>;
export type Category = z.infer<typeof CategorySchema>;
export type Attribute = z.infer<typeof AttributeSchema>;
export type AttributeTerm = z.infer<typeof AttributeTermSchema>;
export type ProductAttribute = z.infer<typeof ProductAttributeSchema>;
export type VariationAttribute = z.infer<typeof VariationAttributeSchema>;
export type PriceCirculations = z.infer<typeof PriceCirculationsSchema>;
export type ProductsStatistic = z.infer<typeof ProductsStatisticSchema>;
export type PageInfo = z.infer<typeof PageInfoSchema>;
export type MenuItem = z.infer<typeof MenuItemSchema>;
export type Menu = z.infer<typeof MenuSchema>;
export type Post = z.infer<typeof PostSchema>;
export type ProductPriceCirculation = z.infer<typeof ProductPriceCirculationSchema>;

export const ImageSchema = z.object({
    id: z.number(),
    name: z.string(),
    src: z.string().url()
});

export const CategorySchema = z.object({
    id: z.number(),
    parent_id: z.number(),
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string(),
    count: z.number()
});

export const AttributeSchema = z.object({
    id: z.number(),
    name: z.string().min(1),
    slug: z.string().min(1)
});

export const AttributeTermSchema = z.object({
    id: z.number(),
    name: z.string().min(1),
    slug: z.string().min(1),
    menu_order: z.number().optional()
});

export const VariationAttributeSchema = z.object({
    id: z.number(),
    name: z.string().min(1),
    option: z.string().min(1)
});

export const ProductAttributeSchema = z.object({
    id: z.number(),
    name: z.string().min(1),
    slug: z.string().min(1),
    visible: z.boolean(),    
    variation: z.boolean(),
    options: z.array(AttributeTermSchema)
});

export const PriceCirculationsSchema = z.object({
    type: z.enum([ "relative", "direct" ]),
    circulations: z.record(z.string(), z.number())
});

export const VariationSchema = z.object({
    id: z.number(),
    parent_id: z.number(),
    sku: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string(),
    created: z.union([ ez.dateOut(), z.string().datetime() ]),
    modified: z.union([ ez.dateOut(), z.string().datetime() ]),
    stock_quantity: z.number().nullable(),
    price: z.number().nullable(),
    price_circulations: PriceCirculationsSchema.nullable(),
    images: z.array(ImageSchema),
    attributes: z.array(VariationAttributeSchema)
});

export const ProductSchema = z.object({
    id: z.number(),
    sku: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string(),
    type: z.enum([ "simple", "variable" ]),
    created: z.union([ ez.dateOut(), z.string().datetime() ]),
    modified: z.union([ ez.dateOut(), z.string().datetime() ]),
    stock_quantity: z.number().nullable(),
    price: z.number().nullable(),
    price_circulations: PriceCirculationsSchema.nullable(),
    categories: z.array(CategorySchema),
    images: z.array(ImageSchema),
    attributes: z.array(ProductAttributeSchema),
    default_attributes: z.array(VariationAttributeSchema),
    variations: z.array(VariationSchema)
});

export const ProductsStatisticSchema = z.object({
    products_count: z.number(),
    min_price: z.number(),
    max_price: z.number(),
    attributes: z.array(ProductAttributeSchema).optional()
});

export const PageInfoSchema = z.object({
    id: z.number(),
    slug: z.string(),
    status: z.string(),
    type: z.string(),
    parent: z.number(),
    title: z.string(),
    content: z.string(),
    menu_order: z.number(),
    sections: z.array(z.any())
});

export const MenuItemSchema = z.object({
    title: z.string(),
    type: z.string(),
    menu_order: z.number(),
    parent_id: z.number(),
    url: z.string(),
    is_button: z.boolean(),
    fa_icon_code: z.string()
});

export const MenuSchema = z.object({
    id: z.number(),
    items: z.array(MenuItemSchema)
});

export const PostSchema = z.object({
    id: z.number(),
    slug: z.string(),
    status: z.string(),
    type: z.string(),
    parent: z.number(),
    title: z.string(),
    content: z.string(),
    excerpt: z.string(),
    menu_order: z.number(),
    categories: z.array(CategorySchema)
});

export const ProductPriceCirculationSchema = z.object({
    product_id: z.number(),
    variation_id: z.number().optional(),
    stock_quantity: z.number().nullable(),
    price_circulations: z.nullable(PriceCirculationsSchema)
});
