export interface RegisterInput {
    companyName: string;
    name: string;
    email: string;
    password: string;
    phone?: string;
}
export declare function registerAuthHandlers(): void;
