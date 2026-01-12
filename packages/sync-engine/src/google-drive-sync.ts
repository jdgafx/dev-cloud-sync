import logger from '@dev-cloud-sync/api-server/utils/logger';

export class GoogleDriveSync {
    async connect(): Promise<void> {
        logger.info('Connecting to Google Drive...');
    }

    async uploadFile(path: string): Promise<void> {
        logger.info(`Uploading ${path} to Google Drive`);
    }
}
}
