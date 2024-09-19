# EwaGifts REST API #

## Overview #

The application is designed to provide API access to data from an online store running on the CMS WordPress with the WooCommerce plugin and some custom modifications. 

The need to write a custom API application is caused by the extremely slow performance of the standard WooCommerce REST API in a store with a large number of products (5000+). This application connects directly to the store's database (MySQL), which allows you to receive data at high speed.

The application provides a public API for accessing store data and does not provide data modification functionality. The only exception is the creation of service tables and triggers to track changes of store products.
## Application architecture #

The application consists of the following components:
* Endpoints - are the external interface of the application. Implement the logic for validating system input and output data. 
* Repositories - Contain the logic of interaction with the database and the logic of constructing domain objects from this data.
* Cache - implements the logic of caching and continuous updating of the product cache.

Logic of component interaction:
* API Endpoints receive and validate requests, retrieve data from repositories, and validate responses.
* Products are selected not directly from the product repository, but from the product cache service.
* The product cache synchronization service initializes the cache when the application starts, reloads the cache once a day, and also continuously monitors changes in prices and stocks of products in the main database. Changes in prices and stocks of products are monitored by triggers and logged into a custom table; the product cache synchronization service monitors this table and reloads updated products.

Libraries/technologies used:
* Node.JS/TypeScript/Express.JS - the main application stack.
* express-zod-api - validates all input and output data from API endpoints.
* Redis with RediSearch module - provides caching functionality and fast selection/search of products.

## Deployment #

Deployment is done using GitHub Actions and Docker containers.
