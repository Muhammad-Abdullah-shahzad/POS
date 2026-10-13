export interface ProductPageQuery {
    page?: number;
    pageSize?: number;
    search?: string;
    /** Only products running low, emptiest first (the dashboard's restock list). */
    lowStock?: boolean;
}
export declare function registerProductHandlers(): void;
