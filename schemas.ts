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
    slug: z.string().min(1)
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

export const VariationSchema = z.object({
    id: z.number(),
    parent_id: z.number(),
    sku: z.string().min(1),
    name: z.string().min(1),
    slug: z.string().min(1),
    description: z.string(),
    stock_quantity: z.number().nullable(),
    price: z.number().nullable(),
    created: ez.dateOut(),
    modified: ez.dateOut(),
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
    stock_quantity: z.number().nullable(),
    price: z.number().nullable(),
    created: ez.dateOut(),
    modified: ez.dateOut(),
    categories: z.array(CategorySchema),
    images: z.array(ImageSchema),
    attributes: z.array(ProductAttributeSchema),
    default_attributes: z.array(VariationAttributeSchema),
    variations: z.array(VariationSchema)
});
