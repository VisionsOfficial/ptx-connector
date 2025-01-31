import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import { config } from '../../config/environment';
import { Logger } from '../../libs/loggers';
import routes from '../../libs/loaders/routes';
import { globalErrorHandler } from '../../routes/middlewares/errorHandler.middleware';
import { AppServer } from '../../server';

export const startTestServer = async (port?: number) => {
    const app = express();

    // Basic middleware setup
    app.use(cors({ origin: true, credentials: true }));
    app.use(cookieParser());
    app.use(express.json({ limit: config.limit }));
    app.use(express.urlencoded({ limit: config.limit, extended: true }));

    // Setup routes
    routes(app);

    // Error handling
    app.use(globalErrorHandler);

    const PORT = port || config.port;
    const server = app.listen(PORT, () => {
        // eslint-disable-next-line no-console
        Logger.info({ message: 'Server running on: http://localhost:' + PORT });
    });

    return { app, server } as AppServer;
};
