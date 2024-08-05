
DROP PROCEDURE IF EXISTS GetProductBySlug;
DROP PROCEDURE IF EXISTS GetProductByID;
DROP PROCEDURE IF EXISTS GetProductsV3;
DROP PROCEDURE IF EXISTS GetProductsStatisticV2;
DROP PROCEDURE IF EXISTS CreateFTIndex;

DELIMITER $$



CREATE PROCEDURE GetProductBySlug
(
    productSlug VARCHAR(255)
)
BEGIN
    SELECT 
        ID AS id, 
        post_title AS name, 
        post_name AS slug, 
        post_content AS description, 
        post_date AS created, 
        post_modified AS modified,
        CAST(m1.meta_value AS DECIMAL(10, 2)) AS price,
        CAST(m2.meta_value AS INT) AS stock_quantity,
        m3.meta_value AS sku,
        m4.meta_value AS attributes,
        m5.meta_value AS default_attributes,
        m6.meta_value AS price_circulations
    FROM wp_posts
    LEFT JOIN wp_postmeta AS m1 ON wp_posts.ID = m1.post_id AND m1.meta_key = "_price"
    LEFT JOIN wp_postmeta AS m2 ON wp_posts.ID = m2.post_id AND m2.meta_key = "_stock"
    LEFT JOIN wp_postmeta AS m3 ON wp_posts.ID = m3.post_id AND m3.meta_key = "_sku"
    LEFT JOIN wp_postmeta AS m4 ON wp_posts.ID = m4.post_id AND m4.meta_key = "_product_attributes"
    LEFT JOIN wp_postmeta AS m5 ON wp_posts.ID = m5.post_id AND m5.meta_key = "_default_attributes"
    LEFT JOIN wp_postmeta AS m6 ON wp_posts.ID = m6.post_id AND m6.meta_key = "_price_circulations"
    WHERE post_name = productSlug COLLATE utf8mb4_unicode_ci 
        AND post_type = "product";
END $$



CREATE PROCEDURE GetProductByID
(
    productId INT
)
BEGIN
    SELECT 
        ID AS id, 
        post_title AS name, 
        post_name AS slug, 
        post_content AS description, 
        post_date AS created, 
        post_modified AS modified,
        CAST(m1.meta_value AS DECIMAL(10, 2)) AS price,
        CAST(m2.meta_value AS INT) AS stock_quantity,
        m3.meta_value AS sku,
        m4.meta_value AS attributes,
        m5.meta_value AS default_attributes,
        m6.meta_value AS price_circulations
    FROM wp_posts
    LEFT JOIN wp_postmeta AS m1 ON wp_posts.ID = m1.post_id AND m1.meta_key = "_price"
    LEFT JOIN wp_postmeta AS m2 ON wp_posts.ID = m2.post_id AND m2.meta_key = "_stock"
    LEFT JOIN wp_postmeta AS m3 ON wp_posts.ID = m3.post_id AND m3.meta_key = "_sku"
    LEFT JOIN wp_postmeta AS m4 ON wp_posts.ID = m4.post_id AND m4.meta_key = "_product_attributes"
    LEFT JOIN wp_postmeta AS m5 ON wp_posts.ID = m5.post_id AND m5.meta_key = "_default_attributes"
    LEFT JOIN wp_postmeta AS m6 ON wp_posts.ID = m6.post_id AND m6.meta_key = "_price_circulations"
    WHERE ID = productId AND post_type = "product";
END $$



CREATE PROCEDURE GetProductsV3
(
    cLimit INT, 
    cOffset INT,
    minPrice DECIMAL(10, 2),
    maxPrice DECIMAL(10, 2),
    cOrder VARCHAR(20),
    direction VARCHAR(4),
    categoryName VARCHAR(100),
    attributeName VARCHAR(100),
    termName VARCHAR(100),
    searchText VARCHAR(100)

)
BEGIN
    IF direction = "asc" THEN
    
        SELECT 
            ID AS id, 
            post_title AS name, 
            post_name AS slug, 
            post_content AS description, 
            post_date AS created, 
            post_modified AS modified, 
            CAST(m1.meta_value AS DECIMAL(10, 4)) AS price,
            CAST(m2.meta_value AS INT) AS stock_quantity,
            m3.meta_value AS sku,
            m4.meta_value AS attributes,
            m5.meta_value AS default_attributes,
            m6.meta_value AS price_circulations
        FROM wp_posts
        LEFT JOIN wp_postmeta AS m1 ON wp_posts.ID = m1.post_id AND m1.meta_key = "_price"
        LEFT JOIN wp_postmeta AS m2 ON wp_posts.ID = m2.post_id AND m2.meta_key = "_stock"
        LEFT JOIN wp_postmeta AS m3 ON wp_posts.ID = m3.post_id AND m3.meta_key = "_sku"
        LEFT JOIN wp_postmeta AS m4 ON wp_posts.ID = m4.post_id AND m4.meta_key = "_product_attributes"
        LEFT JOIN wp_postmeta AS m5 ON wp_posts.ID = m5.post_id AND m5.meta_key = "_default_attributes"
        LEFT JOIN wp_postmeta AS m6 ON wp_posts.ID = m6.post_id AND m6.meta_key = "_price_circulations"
        WHERE post_type = "product" 
            AND post_status = "publish"
            AND (minPrice = -1 OR CAST(m1.meta_value AS DECIMAL(10, 2)) >= minPrice)
            AND (maxPrice = -1 OR CAST(m1.meta_value AS DECIMAL(10, 2)) <= maxPrice)
            AND (searchText = "" OR MATCH(post_title) AGAINST(CONCAT("*", searchText, "*")))
            AND (categoryName = "" OR ID IN
                (SELECT object_id
                FROM wp_term_relationships
                WHERE term_taxonomy_id IN
                    (SELECT term_taxonomy_id
                    FROM wp_term_taxonomy
                    WHERE taxonomy = "product_cat" COLLATE utf8mb4_unicode_ci  AND term_taxonomy_id IN
                        (SELECT term_id
                        FROM wp_terms
                        WHERE slug = categoryName COLLATE utf8mb4_unicode_ci))))
            AND (attributeName = "" OR ID IN
                (SELECT product_or_parent_id
                FROM wp_wc_product_attributes_lookup
                WHERE taxonomy = attributeName COLLATE utf8mb4_unicode_ci AND (termName = """" OR term_id IN
                    (SELECT term_id
                    FROM wp_terms
                    WHERE termName = "" OR slug LIKE CONCAT("%", termName, "%") COLLATE utf8mb4_unicode_ci))))
        ORDER BY 
            CASE
                WHEN cOrder = "date" THEN post_date
                WHEN cOrder = "name" THEN post_title
                WHEN cOrder = "price" THEN price
                WHEN cOrder = "quantity" THEN stock_quantity
            END 
        ASC
        LIMIT cLimit OFFSET cOffset;
    
    ELSEIF direction = "desc" THEN
        
        SELECT 
            ID AS id,
            post_title AS name, 
            post_name AS slug, 
            post_content AS description, 
            post_date AS created, 
            post_modified AS modified, 
            CAST(m1.meta_value AS DECIMAL(10, 4)) AS price,
            CAST(m2.meta_value AS INT) AS stock_quantity,
            m3.meta_value AS sku,
            m4.meta_value AS attributes,
            m5.meta_value AS default_attributes,
            m6.meta_value AS price_circulations
        FROM wp_posts
        LEFT JOIN wp_postmeta AS m1 ON wp_posts.ID = m1.post_id AND m1.meta_key = "_price"
        LEFT JOIN wp_postmeta AS m2 ON wp_posts.ID = m2.post_id AND m2.meta_key = "_stock"
        LEFT JOIN wp_postmeta AS m3 ON wp_posts.ID = m3.post_id AND m3.meta_key = "_sku"
        LEFT JOIN wp_postmeta AS m4 ON wp_posts.ID = m4.post_id AND m4.meta_key = "_product_attributes"
        LEFT JOIN wp_postmeta AS m5 ON wp_posts.ID = m5.post_id AND m5.meta_key = "_default_attributes"
        LEFT JOIN wp_postmeta AS m6 ON wp_posts.ID = m6.post_id AND m6.meta_key = "_price_circulations"
        WHERE post_type = "product" 
            AND post_status = "publish"
            AND (minPrice = -1 OR CAST(m1.meta_value AS DECIMAL(10, 2)) >= minPrice)
            AND (maxPrice = -1 OR CAST(m1.meta_value AS DECIMAL(10, 2)) <= maxPrice)
            AND (searchText = "" OR MATCH(post_title) AGAINST(CONCAT("*", searchText, "*")))
            AND (categoryName = "" OR ID IN
                (SELECT object_id
                FROM wp_term_relationships
                WHERE term_taxonomy_id IN
                    (SELECT term_taxonomy_id
                    FROM wp_term_taxonomy
                    WHERE taxonomy = "product_cat" COLLATE utf8mb4_unicode_ci  AND term_taxonomy_id IN
                        (SELECT term_id
                        FROM wp_terms
                        WHERE slug = categoryName COLLATE utf8mb4_unicode_ci))))
            AND (attributeName = "" OR ID IN
                (SELECT product_or_parent_id
                FROM wp_wc_product_attributes_lookup
                WHERE taxonomy = attributeName COLLATE utf8mb4_unicode_ci AND (termName = """" OR term_id IN
                    (SELECT term_id
                    FROM wp_terms
                    WHERE termName = "" OR slug LIKE CONCAT("%", termName, "%") COLLATE utf8mb4_unicode_ci))))
        ORDER BY 
            CASE
                WHEN cOrder = "date" THEN post_date
                WHEN cOrder = "name" THEN post_title
                WHEN cOrder = "price" THEN price
                WHEN cOrder = "quantity" THEN stock_quantity
            END
        DESC
        LIMIT cLimit OFFSET cOffset;
    END IF;    
END $$



CREATE PROCEDURE GetProductsStatisticV2
(
    minPrice DECIMAL(10, 4),
    maxPrice DECIMAL(10, 4),
    categoryName VARCHAR(100),
    attributeName VARCHAR(100),
    termName VARCHAR(100),
    searchText VARCHAR(100)
)
BEGIN
    SELECT 
    COUNT(1) AS products_count,
        MIN(CAST(m1.meta_value AS DECIMAL(10, 2))) AS min_price,
        MAX(CAST(m1.meta_value AS DECIMAL(10, 2))) AS max_price
    FROM wp_posts
    LEFT JOIN wp_postmeta AS m1 ON wp_posts.ID = m1.post_id AND m1.meta_key = "_price"
    LEFT JOIN wp_postmeta AS m2 ON wp_posts.ID = m2.post_id AND m2.meta_key = "_sku"
    WHERE post_type = "product" 
        AND post_status = "publish"
        AND (minPrice = -1 OR CAST(m1.meta_value AS DECIMAL(10, 4)) >= minPrice)
        AND (maxPrice = -1 OR CAST(m1.meta_value AS DECIMAL(10, 4)) <= maxPrice)
        AND (searchText = "" OR MATCH(post_title) AGAINST(CONCAT("*", searchText, "*")))
        AND (categoryName = "" OR ID IN
            (SELECT object_id
            FROM wp_term_relationships
            WHERE term_taxonomy_id IN
                (SELECT term_taxonomy_id
                FROM wp_term_taxonomy
                WHERE taxonomy = "product_cat" COLLATE utf8mb4_unicode_ci  AND term_taxonomy_id IN
                    (SELECT term_id
                    FROM wp_terms
                    WHERE slug = categoryName COLLATE utf8mb4_unicode_ci))))
        AND (attributeName = "" OR ID IN
            (SELECT product_or_parent_id
            FROM wp_wc_product_attributes_lookup
            WHERE taxonomy = attributeName COLLATE utf8mb4_unicode_ci AND (termName = "" OR term_id IN
                (SELECT term_id
                FROM wp_terms
                WHERE termName = "" OR slug LIKE CONCAT("%", termName, "%") COLLATE utf8mb4_unicode_ci))));
END $$



CREATE PROCEDURE CreateFTIndex()
BEGIN
    DECLARE exit HANDLER FOR SQLEXCEPTION 
    BEGIN
        ROLLBACK;
    END;

    START TRANSACTION;

    SET sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';
    ALTER TABLE wp_posts ADD FULLTEXT post_title_search (post_title (1000));
    SET sql_mode = 'ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_AUTO_CREATE_USER,NO_ENGINE_SUBSTITUTION';

    COMMIT;
END $$



DELIMITER ;



CALL CreateFTIndex();
