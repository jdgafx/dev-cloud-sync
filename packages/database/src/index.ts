export const db = {
  query: (text: string, params?: any[]) => {
    // Query logged via logger

    return Promise.resolve({ rows: [] });
  },
};
