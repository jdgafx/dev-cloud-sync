export const db = {
    query: (text: string, params?: any[]) => {
        console.log('Query executed:', text, params);
        return Promise.resolve({ rows: [] });
    }
};
