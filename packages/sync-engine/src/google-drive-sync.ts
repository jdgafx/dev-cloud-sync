export class GoogleDriveSync {
    async connect(): Promise<void> {
        console.log('Connecting to Google Drive...');
    }

    async uploadFile(path: string): Promise<void> {
        console.log(`Uploading ${path} to Google Drive`);
    }
}
