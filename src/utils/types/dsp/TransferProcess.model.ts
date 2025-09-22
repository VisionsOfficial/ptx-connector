import { connection, Schema } from 'mongoose';

const TransferProcessSchema = new Schema(
    {
        providerPid: {
            type: String,
        },
        consumerPid: {
            type: String,
        },
        state: {
            type: String,
        },
    },
    { timestamps: true }
);

export const TransferProcessModel = connection.model(
    'TransferProcess',
    TransferProcessSchema
);
